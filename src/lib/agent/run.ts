import { classify } from "@/lib/agent/classify";
import { generate } from "@/lib/agent/generate";
import { updateMemory } from "@/lib/agent/memory";
import { createPlan } from "@/lib/agent/plan";
import { rewriteQuery } from "@/lib/agent/rewrite";
import { selectTools } from "@/lib/agent/select-tools";
import { evaluate } from "@/lib/agent/evaluate";
import {
  EMPTY_MEMORY,
  MAX_RETRIES,
  type AgentResponse,
  type AgentState,
  type Evidence,
  type Memory,
  type ToolName,
  type TraceEvent,
} from "@/lib/agent/types";
import { revise, verify } from "@/lib/agent/verify";
import { entityName } from "@/lib/kb/index";
import { executeTools } from "@/lib/retrieval/tools";
import { unique } from "@/lib/retrieval/text";

export function runAgent(question: string, memory: Memory = EMPTY_MEMORY): AgentResponse {
  const trace: TraceEvent[] = [];
  const classification = classify(question.trim(), memory);
  const selected = selectTools(classification);
  classification.recommendedTools = selected;
  const plan = createPlan(classification);

  trace.push({
    stage: "classify",
    title: "Question classification",
    detail: classification.rationale,
    payload: {
      questionType: classification.questionType,
      requiresPlanning: classification.requiresPlanning,
      recommendedTools: classification.recommendedTools,
      confidence: classification.confidence,
      entities: classification.entities.map(entityName),
      facets: classification.facets,
      ambiguous: classification.ambiguous,
      boundary: classification.boundary,
      hypotheses: classification.hypotheses,
      resolvedQuestion: classification.resolvedQuestion,
    },
  });

  if (classification.boundary !== "none") {
    trace.push({
      stage: "boundary",
      title: "Boundary check",
      detail:
        classification.boundary === "personal_data"
          ? "Personal contact details are out of scope. The agent will cite the data policy instead of searching for a number."
          : classification.boundary === "control_action"
            ? "Control actions and lockout bypasses are refused."
            : "Record changes are refused. SQL access is read-only.",
    });
  }

  trace.push({
    stage: "plan",
    title: "Retrieval plan",
    detail: plan.map((step) => `${step.id}. ${step.text}`).join("\n"),
    payload: plan.map((step) => step.text),
  });
  trace.push({
    stage: "select_tools",
    title: "Tool selection",
    detail: `${selected.join(", ")}. The first tool runs immediately; the others wait for a failed evidence check.`,
    payload: selected,
  });

  let evidence: Evidence[] = [];
  const toolCalls: AgentResponse["state"]["tool_calls"] = [];
  const rewrites: string[] = [];
  let retryCount = 0;
  let k = 5;
  let hops = 1;
  const used = new Set<ToolName>();
  let queries = boundaryQueries(classification.resolvedQuestion, classification.boundary);

  const firstTools = selected.slice(0, 1);
  const first = executeTools(firstTools, {
    queries,
    question: classification.resolvedQuestion,
    k,
    hops,
    entities: classification.entities,
    filters: classification.filters,
    attempt: 0,
  });
  evidence = mergeEvidence(evidence, first.evidence);
  toolCalls.push(...first.calls);
  firstTools.forEach((tool) => used.add(tool));
  trace.push(retrievalEvent(0, firstTools, queries, k, hops, first.evidence));

  let evaluation = evaluate(classification, evidence);
  trace.push(evaluationEvent(evaluation));

  while (!evaluation.sufficient && retryCount < MAX_RETRIES && shouldRetry(evaluation.recommendedAction, classification.boundary, used, retryCount)) {
    retryCount += 1;
    const names = classification.entities.map(entityName);
    const rewritten = rewriteQuery(classification.resolvedQuestion, names, retryCount, evaluation.missingInformation);
    rewrites.push(...rewritten);
    queries = rewritten;
    if (evaluation.recommendedAction === "search_graph") hops = Math.min(4, hops + 1);
    k = Math.min(12, k + 4);
    const nextTools = chooseRetryTools(selected, used, evaluation.recommendedAction, hops);
    trace.push({
      stage: "retry",
      title: `Retry ${retryCount} of ${MAX_RETRIES}`,
      detail: `${evaluation.rationale} Next tools: ${nextTools.join(", ")}. Graph depth ${hops}. Retrieval depth ${k}.`,
      payload: { missing: evaluation.missingInformation, action: evaluation.recommendedAction, hops, k },
    });
    trace.push({
      stage: "rewrite",
      title: "Rewritten queries",
      detail: rewritten.join("\n"),
      payload: rewritten,
    });
    const more = executeTools(nextTools, {
      queries,
      question: classification.resolvedQuestion,
      k,
      hops,
      entities: classification.entities,
      filters: classification.filters,
      attempt: retryCount,
    });
    evidence = mergeEvidence(evidence, more.evidence);
    toolCalls.push(...more.calls);
    nextTools.forEach((tool) => used.add(tool));
    trace.push(retrievalEvent(retryCount, nextTools, queries, k, hops, more.evidence));
    evaluation = evaluate(classification, evidence);
    trace.push(evaluationEvent(evaluation));
  }

  const generated = generate(classification, evidence);
  evidence = mergeEvidence(evidence, generated.extraEvidence);
  if (generated.extraEvidence.length) {
    toolCalls.push({
      tool: "calculator",
      input: { expression: generated.extraEvidence[0]?.expression ?? "" },
      resultCount: generated.extraEvidence.length,
      summary: generated.extraEvidence[0]?.text ?? "Calculated from retrieved figures.",
      attempt: retryCount,
    });
  }
  let draft = generated.draft;
  trace.push({
    stage: "generate",
    title: "Draft answer",
    detail: draft.answer,
    payload: { gaps: draft.gaps, recommendations: draft.recommendations },
  });

  let verification = verify(draft, classification, evidence);
  trace.push({
    stage: "verify",
    title: verification.approved ? "Verification passed" : "Verification failed",
    detail: verification.requiredRevision || verification.checks.map((check) => `${check.passed ? "Pass" : "Fail"}: ${check.name}. ${check.detail}`).join("\n"),
    payload: verification,
  });

  if (!verification.approved) {
    const revised = revise(draft, verification, classification, evidence);
    const again = verify(revised, classification, evidence);
    trace.push({
      stage: "revise",
      title: "Revision",
      detail: verification.requiredRevision || "Removed unsupported sentences.",
      payload: { unsupportedClaims: verification.unsupportedClaims },
    });
    draft = revised;
    verification = again;
    trace.push({
      stage: "verify",
      title: verification.approved ? "Revision verified" : "Revision still has gaps",
      detail: verification.requiredRevision || "The revised answer passed the citation checks.",
      payload: verification,
    });
  }

  const nextMemory = updateMemory(memory, classification, draft);
  trace.push({
    stage: "respond",
    title: "Final response",
    detail: `${draft.citations.length} citation${draft.citations.length === 1 ? "" : "s"}. ${retryCount} retr${retryCount === 1 ? "y" : "ies"}.`,
    payload: {
      citations: draft.citations,
      retryCount,
      evidenceSufficient: evaluation.sufficient,
      memory: { topic: nextMemory.topic, entities: nextMemory.entities.map(entityName) },
    },
  });

  const state: AgentState = {
    question: question.trim(),
    plan: plan.map((step) => step.text),
    selected_tools: selected,
    retrieved_context: evidence.map(presentEvidence),
    evidence_sufficient: evaluation.sufficient,
    retry_count: retryCount,
    answer: draft.answer,
    classification,
    evaluation,
    verification,
    citations: draft.citations,
    tool_calls: toolCalls,
    rewrites,
    gaps: draft.gaps,
    recommendations: draft.recommendations,
    trace,
  };

  return { state, memory: nextMemory, answer: draft.answer, trace };
}

function boundaryQueries(question: string, boundary: string): string[] {
  if (boundary === "personal_data") {
    return [question, "POL-DATA-011 personal phone numbers home addresses compensation"];
  }
  if (boundary === "control_action") {
    return [question, "POL-SAFE-003 must not bypass lockout tagout"];
  }
  if (boundary === "write_action") {
    return [question, "POL-DATA-011 must not change work orders or approve outages"];
  }
  return [question];
}

function shouldRetry(action: string, boundary: string, used: Set<ToolName>, retryCount: number): boolean {
  if (action === "stop") return false;
  if (boundary !== "none" && retryCount >= 1) return false;
  if (boundary !== "none" && used.has("keyword_search") && action !== "keyword_search") return false;
  return true;
}

function chooseRetryTools(
  selected: ToolName[],
  used: Set<ToolName>,
  action: string,
  hops: number,
): ToolName[] {
  const tools: ToolName[] = [];
  if (action === "search_graph") tools.push("graph_search");
  if (action === "widen_vector" || (action === "search_graph" && hops >= 3)) tools.push("vector_search", "hybrid_search");
  if (action === "keyword_search") tools.push("keyword_search");
  if (action === "metadata_filter") tools.push("metadata_search");
  if (action === "sql_query") tools.push("sql_query");
  if (action === "rewrite") tools.push("hybrid_search", "vector_search");
  for (const tool of selected) if (!used.has(tool)) tools.push(tool);
  if (tools.length === 0) tools.push("hybrid_search");
  return unique(tools).slice(0, 3);
}

function mergeEvidence(current: Evidence[], incoming: Evidence[]): Evidence[] {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const previous = map.get(item.id);
    if (!previous || item.score > previous.score) map.set(item.id, item);
  }
  return [...map.values()];
}

function retrievalEvent(attempt: number, tools: ToolName[], queries: string[], k: number, hops: number, evidence: Evidence[]): TraceEvent {
  const preview = [...evidence]
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map((item) => ({
      title: item.title,
      tool: item.tool,
      score: Number(item.score.toFixed(3)),
      locator: item.locator,
      excerpt: item.text.slice(0, 180),
    }));
  return {
    stage: "retrieve",
    title: attempt === 0 ? "Retrieval" : `Retrieval after retry ${attempt}`,
    detail: `${tools.join(", ")} · k=${k} · hops=${hops} · ${evidence.length} new result${evidence.length === 1 ? "" : "s"}.`,
    payload: { tools, queries, k, hops, results: preview },
  };
}

function evaluationEvent(evaluation: AgentResponse["state"]["evaluation"]): TraceEvent {
  return {
    stage: "evaluate",
    title: evaluation?.sufficient ? "Evidence is sufficient" : "Evidence is not sufficient",
    detail: evaluation?.rationale ?? "",
    payload: evaluation,
  };
}

function presentEvidence(item: Evidence): Evidence {
  return { ...item, text: item.text.slice(0, 700) };
}
