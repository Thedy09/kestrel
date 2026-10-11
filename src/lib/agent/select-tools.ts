import type { Classification, ToolName } from "@/lib/agent/types";
import { unique } from "@/lib/retrieval/text";

const BASE: Record<Classification["questionType"], ToolName[]> = {
  factual_lookup: ["vector_search"],
  semantic: ["vector_search", "keyword_search"],
  exact_lookup: ["keyword_search"],
  multi_hop: ["graph_search", "vector_search"],
  structured_data: ["sql_query"],
  calculation: ["calculator"],
  comparison: ["sql_query", "calculator"],
};

export function selectTools(classification: Classification): ToolName[] {
  if (classification.boundary !== "none") return ["keyword_search"];

  const listing =
    Boolean(classification.filters.documentType) &&
    /^(show|list)\b/i.test(classification.resolvedQuestion);

  let tools: ToolName[] = listing
    ? ["metadata_search", "keyword_search"]
    : [...(BASE[classification.questionType] ?? ["hybrid_search"])];

  if (classification.ambiguous) {
    tools = unique(["graph_search", "vector_search", ...tools]);
  }

  if (
    classification.filters.year &&
    classification.filters.documentType &&
    !tools.includes("metadata_search")
  ) {
    tools.push("metadata_search");
  }

  return unique(tools);
}
