import type { Classification, Evaluation, Evidence, RecommendedAction } from "@/lib/agent/types";
import { overlapRatio } from "@/lib/retrieval/text";

export type Intent =
  | "leader"
  | "owner"
  | "dependencies"
  | "upstream"
  | "launch"
  | "purpose"
  | "status"
  | "incident"
  | "work_orders"
  | "lost_energy"
  | "generation"
  | "budget"
  | "calculation"
  | "personal"
  | "control"
  | "write"
  | "listing"
  | "general";

export interface FactHit {
  key: string;
  value: string;
  status: "current" | "superseded";
  sentence: string;
  evidenceId: string;
  evidence: Evidence;
}

export interface FacetAssessment {
  facetId: string;
  facet: string;
  intent: Intent;
  covered: boolean;
  missing: string | null;
  hits: FactHit[];
}

export function collectHits(evidence: Evidence[]): FactHit[] {
  const hits: FactHit[] = [];
  for (const item of evidence) {
    for (const claim of item.claims ?? []) {
      hits.push({
        key: claim.key,
        value: claim.value,
        status: claim.status,
        sentence: claim.sentence,
        evidenceId: item.id,
        evidence: item,
      });
    }
  }
  return hits;
}

export function detectIntent(facet: string, classification: Classification): Intent {
  if (classification.boundary === "personal_data") return "personal";
  if (classification.boundary === "control_action") return "control";
  if (classification.boundary === "write_action") return "write";
  if (classification.questionType === "calculation") return "calculation";
  if (
    classification.questionType === "exact_lookup" &&
    classification.filters.documentType &&
    /^(show|list)\b/i.test(classification.resolvedQuestion)
  ) {
    return "listing";
  }
  const text = facet.toLowerCase();
  if (/feed|upstream/.test(text)) return "upstream";
  if (/who leads|leader|led by|director/.test(text)) return "leader";
  if (/which department|owned by|owns|owning department/.test(text)) return "owner";
  if (/depend|what systems|which systems|systems support|connected technolog|infrastructure/.test(text)) {
    return "dependencies";
  }
  if (/launch|when did|when was|commissioned|start date/.test(text)) return "launch";
  if (/purpose|why |explain|what does|how should/.test(text)) return "purpose";
  if (/incident/.test(text)) return "incident";
  if (/status|how is|doing/.test(text)) return "status";
  if (/work order/.test(text)) return "work_orders";
  if (/lost/.test(text)) return "lost_energy";
  if (/generat|compare/.test(text)) return "generation";
  if (/budget/.test(text)) return "budget";
  if (/phone|home address|compensation|salary/.test(text)) return "personal";
  return "general";
}

export function assessFacets(classification: Classification, evidence: Evidence[]): FacetAssessment[] {
  const hits = collectHits(evidence);
  return classification.facets.map((facet, index) => {
    const intent = detectIntent(facet, classification);
    const matched = hitsForIntent(intent, hits, evidence, classification);
    const covered = isCovered(intent, matched, evidence, facet);
    return {
      facetId: `f${index}`,
      facet,
      intent,
      covered,
      missing: covered ? null : missingMessage(intent, facet),
      hits: matched,
    };
  });
}

export function evaluate(classification: Classification, evidence: Evidence[]): Evaluation {
  const assessments = assessFacets(classification, evidence);
  const missingInformation = assessments.flatMap((item) => (item.missing ? [item.missing] : []));
  const contradictions = findContradictions(collectHits(evidence));
  const coverage = assessments.length === 0 ? 0 : assessments.filter((item) => item.covered).length / assessments.length;
  const sufficient = missingInformation.length === 0 && coverage === 1;
  const uncoveredIntents = assessments.filter((item) => !item.covered).map((item) => item.intent);
  const recommendedAction = sufficient ? "stop" : actionFor(uncoveredIntents, classification);
  return {
    sufficient,
    missingInformation,
    contradictions,
    recommendedAction,
    coverage,
    uncoveredIntents,
    rationale: sufficient
      ? contradictions.length
        ? "Current evidence covers every part of the question. A superseded source conflicts with part of it and must stay labeled."
        : "Current evidence covers every part of the question."
      : `Missing: ${missingInformation.join(" ")}`,
  };
}

function hitsForIntent(
  intent: Intent,
  hits: FactHit[],
  evidence: Evidence[],
  classification: Classification,
): FactHit[] {
  const current = hits.filter((hit) => hit.status === "current");
  const projectId = classification.entities.find((id) => id.startsWith("project:"));
  const scoped = (suffix: string) =>
    current.filter((hit) => {
      if (!hit.key.endsWith(`|${suffix}`)) return false;
      if (!projectId) return true;
      if (hit.key.startsWith(`${projectId}|`)) return true;
      if (intent === "leader" || intent === "purpose" || intent === "personal") return true;
      return false;
    });

  if (intent === "leader") return current.filter((hit) => hit.key.endsWith("|led_by"));
  if (intent === "owner") return scoped("owned_by");
  if (intent === "dependencies") return scoped("depends_on");
  if (intent === "upstream") return current.filter((hit) => hit.key.endsWith("|fed_by") || hit.key.endsWith("|feeds"));
  if (intent === "launch") return [...scoped("launch"), ...scoped("launch_year")];
  if (intent === "purpose") return current.filter((hit) => hit.key.endsWith("|purpose"));
  if (intent === "status") return scoped("status");
  if (intent === "incident") return scoped("related_incident");
  if (intent === "work_orders" || intent === "lost_energy" || intent === "generation" || intent === "budget") {
    return [];
  }
  if (intent === "calculation") return current.filter((hit) => hit.key === "calc|result");
  return current.filter((hit) => evidence.some((item) => item.id === hit.evidenceId));
}

function isCovered(intent: Intent, hits: FactHit[], evidence: Evidence[], facet: string): boolean {
  if (intent === "leader") return hits.some((hit) => hit.key.endsWith("|led_by"));
  if (intent === "owner") return hits.some((hit) => hit.key.endsWith("|owned_by"));
  if (intent === "dependencies") return hits.some((hit) => hit.key.endsWith("|depends_on"));
  if (intent === "upstream") return hits.some((hit) => hit.key.endsWith("|fed_by") || hit.key.endsWith("|feeds"));
  if (intent === "launch") return hits.some((hit) => /\|launch/.test(hit.key));
  if (intent === "purpose") return hits.length > 0;
  if (intent === "status") return hits.length > 0;
  if (intent === "incident") return hits.length > 0;
  if (intent === "work_orders") return evidence.some((item) => item.sqlKind === "work_orders_open_high" && item.rows);
  if (intent === "lost_energy") return evidence.some((item) => item.sqlKind === "outage_loss" && (item.rows?.length ?? 0) > 0);
  if (intent === "generation") return evidence.some((item) => item.sqlKind === "generation" && (item.rows?.length ?? 0) > 0);
  if (intent === "budget") return evidence.some((item) => item.sqlKind === "budgets" && (item.rows?.length ?? 0) > 0);
  if (intent === "calculation") return evidence.some((item) => item.id === "calc:result");
  if (intent === "personal") return evidence.some((item) => /personal phone numbers/i.test(item.text));
  if (intent === "control") return evidence.some((item) => /must not provide steps that bypass/i.test(item.text));
  if (intent === "write") return evidence.some((item) => /must not change work orders/i.test(item.text));
  if (intent === "listing") return evidence.some((item) => item.tool === "metadata_search" && item.status !== "superseded");
  const current = evidence.filter((item) => item.status !== "superseded");
  return current.some((item) => overlapRatio(facet, `${item.title} ${item.text}`) >= 0.34);
}

function missingMessage(intent: Intent, facet: string): string {
  switch (intent) {
    case "leader":
      return "The leader of the department was not found.";
    case "owner":
      return "The owning department was not found.";
    case "dependencies":
      return "The systems this project depends on were not found.";
    case "upstream":
      return "The upstream system that feeds the forecast was not found.";
    case "launch":
      return "The launch date was not found in a current source.";
    case "purpose":
      return "A current statement of purpose was not found.";
    case "status":
      return "The current status was not found.";
    case "incident":
      return "No related incident was found.";
    case "work_orders":
      return "Open high-priority work orders were not found in the tables.";
    case "lost_energy":
      return "Lost MWh by site was not found in the tables.";
    case "generation":
      return "Generation totals were not found in the tables.";
    case "budget":
      return "Budget figures were not found in the tables.";
    case "calculation":
      return "The expression could not be calculated from the question.";
    case "personal":
      return "The data-boundary policy was not retrieved.";
    case "control":
      return "The lockout/tagout policy was not retrieved.";
    case "write":
      return "The read-only data policy was not retrieved.";
    case "listing":
      return "No documents matched the requested metadata filters.";
    default:
      return `No passage covered this part: ${facet}`;
  }
}

function actionFor(intents: string[], classification: Classification): RecommendedAction {
  if (classification.boundary !== "none") return "keyword_search";
  if (intents.some((intent) => ["leader", "owner", "dependencies", "upstream", "incident", "status"].includes(intent))) {
    return "search_graph";
  }
  if (intents.some((intent) => ["work_orders", "lost_energy", "generation", "budget"].includes(intent))) {
    return "sql_query";
  }
  if (intents.includes("listing")) return "metadata_filter";
  if (intents.includes("calculation")) return "rewrite";
  return "widen_vector";
}

function findContradictions(hits: FactHit[]): string[] {
  const groups = new Map<string, FactHit[]>();
  for (const hit of hits) {
    const bucket = groups.get(hit.key) ?? [];
    bucket.push(hit);
    groups.set(hit.key, bucket);
  }
  const notes: string[] = [];
  for (const [key, bucket] of groups) {
    const current = [...new Set(bucket.filter((hit) => hit.status === "current").map((hit) => hit.value))];
    const old = [...new Set(bucket.filter((hit) => hit.status === "superseded").map((hit) => hit.value))];
    if (current.length > 1) notes.push(`Current sources disagree on ${key}: ${current.join(" vs ")}.`);
    else if (current.length === 1 && old.some((value) => value !== current[0])) {
      notes.push(`Superseded value ${old.join(", ")} conflicts with current ${current[0]} for ${key}.`);
    }
  }
  return notes;
}
