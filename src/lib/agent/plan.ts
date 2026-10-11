import type { Classification, PlanStep } from "@/lib/agent/types";

export function createPlan(classification: Classification): PlanStep[] {
  const lines = planLines(classification);
  return lines.map((text, index) => ({ id: index + 1, text }));
}

function planLines(classification: Classification): string[] {
  if (classification.boundary === "personal_data") {
    return [
      "Do not search for or invent a personal phone number, address, or compensation figure.",
      "Retrieve the assistant data-boundary policy.",
      "Say the information is absent and cite the policy.",
    ];
  }
  if (classification.boundary === "control_action") {
    return [
      "Do not provide steps that bypass lockout/tagout or command field equipment.",
      "Retrieve the safety policy that forbids that bypass.",
      "Cite the policy and stop.",
    ];
  }
  if (classification.boundary === "write_action") {
    return [
      "Do not update work orders, outages, or other records.",
      "Cite the read-only boundary in the data policy.",
    ];
  }
  if (classification.ambiguous) {
    return [
      "State the interpretation, because the question does not name a metric.",
      "Retrieve the current project status from a current source.",
      "Retrieve the most recent related incident.",
      "Do not invent a health score.",
      "Cite each fact and list anything the corpus does not define.",
    ];
  }
  if (classification.questionType === "multi_hop") {
    return [
      ...classification.facets.map((facet) => imperative(facet)),
      "Retrieve a current source passage for each claim.",
      "Keep superseded drafts labeled as superseded.",
      "Generate a cited response and list anything still missing.",
    ];
  }
  if (classification.questionType === "structured_data") {
    return [
      "Identify the metric, filters, and table.",
      "Compile one read-only SELECT per metric.",
      "Answer only with the rows that come back.",
    ];
  }
  if (classification.questionType === "calculation") {
    return [
      "Extract the arithmetic from the question.",
      "Evaluate it with the calculator.",
      "Label the inputs as user-supplied when they are not in the tables.",
      "Cite the calculation.",
    ];
  }
  if (classification.questionType === "comparison") {
    return [
      "Retrieve the same metric for each named thing.",
      "Compute the difference with the calculator.",
      "Cite the table result and the calculation separately.",
    ];
  }
  if (classification.questionType === "semantic") {
    return [
      "Retrieve the current policy or procedure that defines the term.",
      "Answer with its stated purpose, not a paraphrase that adds rules.",
      "Cite the passage.",
    ];
  }
  if (classification.questionType === "exact_lookup") {
    return [
      classification.filters.documentType
        ? `Filter documents by type${classification.filters.year ? `, year ${classification.filters.year}` : ""}${classification.filters.site ? `, and site ${classification.filters.site}` : ""}.`
        : "Keyword-search the exact identifier.",
      "Prefer procedures and current records over incident mentions when the question asks for a procedure.",
      "Quote the matching passage.",
    ];
  }
  return [
    "Look up the entity in current documents.",
    "Prefer the current record over a superseded draft.",
    "Cite the passage and say if a draft conflicts with it.",
  ];
}

function imperative(facet: string): string {
  const cleaned = facet.replace(/\.$/, "");
  if (/^which\b/i.test(cleaned)) return `Identify ${cleaned.replace(/^which\s+/i, "the ")}.`;
  if (/^who\b/i.test(cleaned)) return `Find ${cleaned}.`;
  if (/^what\b/i.test(cleaned)) return `Find ${cleaned}.`;
  if (/^confirm\b/i.test(cleaned)) return `Check ${cleaned.replace(/^confirm\s+/i, "")}.`;
  return `Resolve: ${cleaned}.`;
}
