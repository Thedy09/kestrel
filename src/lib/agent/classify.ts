import type { Boundary, Classification, Hypothesis, Memory, QuestionType } from "@/lib/agent/types";
import { entityName, linkEntities } from "@/lib/kb/index";
import { inferFilters } from "@/lib/retrieval/tools";
import { unique } from "@/lib/retrieval/text";

export function resolveQuestion(question: string, memory: Memory): { text: string; unresolved: string[] } {
  const mentioned = linkEntities(question);
  const unresolved: string[] = [];
  let text = question;
  const department = [...memory.entities].reverse().find((id) => id.startsWith("dept:"));
  const project = [...memory.entities].reverse().find((id) => id.startsWith("project:"));
  const system = [...memory.entities].reverse().find((id) => id.startsWith("system:"));
  const hasProject = mentioned.some((id) => id.startsWith("project:"));
  const hasDepartment = mentioned.some((id) => id.startsWith("dept:"));
  const hasSystem = mentioned.some((id) => id.startsWith("system:"));
  if (/\b(that|this) department\b/i.test(text)) {
    if (department) text = text.replace(/\b(that|this) department\b/gi, entityName(department));
    else if (!hasDepartment && !hasProject) unresolved.push("that department");
  }
  if (/\b(that|this) project\b/i.test(text)) {
    if (project) text = text.replace(/\b(that|this) project\b/gi, entityName(project));
    else if (!hasProject) unresolved.push("that project");
  }
  if (/\b(that|this) system\b/i.test(text)) {
    if (system) text = text.replace(/\b(that|this) system\b/gi, entityName(system));
    else if (!hasSystem) unresolved.push("that system");
  }
  return { text, unresolved };
}

export function classify(question: string, memory: Memory): Classification {
  const resolved = resolveQuestion(question, memory);
  const q = resolved.text;
  const entities = unique([...linkEntities(q), ...relevantMemoryEntities(q, memory)]);
  const boundary = detectBoundary(q);
  const hypotheses = extractHypotheses(q);
  const filters = inferFilters(q, entities);
  const ambiguous =
    boundary === "none" &&
    (/\bhow is .+\bdoing\b|\bhow are .+\bdoing\b|\bstatus update\b/i.test(q) || resolved.unresolved.length > 0);

  let facets = splitFacets(q);
  if (hypotheses.length > 0 && /\bconfirm\b/i.test(q)) {
    facets = hypotheses.map(
      (item) => `Confirm ${item.attribute.replaceAll("_", " ")} against current evidence. The question says ${item.value}.`,
    );
  } else if (ambiguous && entities.some((id) => id.startsWith("project:"))) {
    facets = ["current status of the project", "most recent related incident"];
  } else if (boundary === "personal_data") {
    facets = ["personal contact details and the data boundary"];
  } else if (boundary === "control_action") {
    facets = ["whether a control or lockout bypass can be given"];
  } else if (boundary === "write_action") {
    facets = ["whether the assistant can change operational records"];
  }

  const questionType = chooseType(q, facets, filters);
  if (questionType === "calculation") {
    facets = [q.replace(/\?+$/g, "").trim()];
  }
  const requiresPlanning =
    ambiguous ||
    boundary !== "none" ||
    facets.length > 1 ||
    questionType === "multi_hop" ||
    questionType === "comparison" ||
    questionType === "structured_data" ||
    questionType === "calculation" ||
    questionType === "semantic";

  return {
    questionType,
    requiresPlanning,
    recommendedTools: [],
    confidence: confidenceFor(questionType, boundary, ambiguous),
    rationale: rationaleFor(questionType, boundary, ambiguous, hypotheses),
    entities,
    facets,
    ambiguous,
    boundary,
    hypotheses,
    filters,
    resolvedQuestion: q,
  };
}

function relevantMemoryEntities(question: string, memory: Memory): string[] {
  if (!/\b(that|this|those|the same)\b/i.test(question)) return [];
  return memory.entities;
}

function detectBoundary(question: string): Boundary {
  if (
    /\b(personal phone|phone number|mobile number|home address|salary|compensation|social security|date of birth|ssn)\b/i.test(
      question,
    )
  ) {
    return "personal_data";
  }
  if (
    /\b(bypass|override|skip)\b/i.test(question) &&
    /\b(lockout|tagout|loto|interlock|safety)\b/i.test(question)
  ) {
    return "control_action";
  }
  if (/\b(trip|open|close)\b/i.test(question) && /\b(breaker|turbine|inverter|switch)\b/i.test(question) && /\b(now|remotely|command)\b/i.test(question)) {
    return "control_action";
  }
  if (/\b(delete|drop|update|insert|close|approve|mark)\b/i.test(question) && /\b(work order|outage|table|record)\b/i.test(question)) {
    return "write_action";
  }
  return "none";
}

function extractHypotheses(question: string): Hypothesis[] {
  const found: Hypothesis[] = [];
  const launch = question.match(/\b(?:launched|launch(?:ed)?|started|commissioned)\s+in\s+(20\d{2})\b/i);
  if (launch) {
    found.push({ attribute: "launch_year", value: launch[1], text: launch[0] });
  }
  const owned = question.match(/\bowned by\s+([A-Z][A-Za-z& ]+?)(?=,|\.|$|\s+and\b|\s+confirm\b)/);
  if (owned) {
    found.push({ attribute: "owned_by", value: owned[1].trim(), text: owned[0] });
  }
  return found;
}

function splitFacets(question: string): string[] {
  const cleaned = question.replace(/\?+/g, "").trim();
  const parts = cleaned
    .split(/\s*;\s*|\s*,\s+|\s+\band\b\s+|(?<=\.)\s+/)
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter(Boolean);
  const clauses = parts.filter(
    (part) => part.split(/\s+/).length >= 3 || /^(who|what|which|when|where|why|how|confirm)\b/i.test(part),
  );
  return clauses.length >= 2 ? clauses : [cleaned];
}

function chooseType(
  question: string,
  facets: string[],
  filters: Classification["filters"],
): QuestionType {
  if (
    /\d/.test(question) &&
    /\b(revenue impact|calculat\w*|strike price|percent of|% of)\b/i.test(question)
  ) {
    return "calculation";
  }
  if (/\b(compare|versus|vs\.?|difference between)\b/i.test(question)) return "comparison";
  if (
    /\b(how many|count of|total|average|budget|work orders?|lost mwh|lost energy|generation|generated)\b/i.test(
      question,
    )
  ) {
    return "structured_data";
  }
  if (
    /\b(who leads|which department|owned by|owns|depends on|depend on|dependencies|what systems|which systems|feeds|upstream|connected to)\b/i.test(
      question,
    ) ||
    /\b(what|which)\s+systems?\s+support\b/i.test(question)
  ) {
    return "multi_hop";
  }
  if (
    /(?:"[^"]+"|“[^”]+”)/.test(question) ||
    /\basset tag\b/i.test(question) ||
    (/^(show|list)\b/i.test(question) && Boolean(filters.documentType)) ||
    (/\b(find|mention|exact phrase|procedure)\b/i.test(question) &&
      /\b(?:INC|SOP|POL|WO|RUN)-[A-Z0-9-]+\b|\b[A-Z]-\d+\b|\bT-\d+\b/i.test(question))
  ) {
    return "exact_lookup";
  }
  if (/\b(purpose|why|explain|what does|how should)\b/i.test(question)) return "semantic";
  if (facets.length > 2) return "multi_hop";
  return "factual_lookup";
}

function confidenceFor(type: QuestionType, boundary: Boundary, ambiguous: boolean): number {
  if (boundary !== "none") return 0.93;
  if (ambiguous) return 0.58;
  if (type === "multi_hop" || type === "calculation" || type === "structured_data") return 0.84;
  return 0.74;
}

function rationaleFor(
  type: QuestionType,
  boundary: Boundary,
  ambiguous: boolean,
  hypotheses: Hypothesis[],
): string {
  if (boundary === "personal_data") {
    return "The question asks for personal contact data, which this assistant is not allowed to infer.";
  }
  if (boundary === "control_action") {
    return "The question asks for a control or lockout bypass, which is outside the assistant's authority.";
  }
  if (boundary === "write_action") {
    return "The question asks to change an operational record. The SQL tool is read-only.";
  }
  const bits = [`Classified as ${type.replaceAll("_", " ")}.`];
  if (ambiguous) bits.push("The wording does not name a single metric, so the plan states an interpretation.");
  if (hypotheses.length) {
    bits.push("The question states values that will be checked against current sources.");
  }
  return bits.join(" ");
}
