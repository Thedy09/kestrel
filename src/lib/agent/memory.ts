import type { Classification, Draft, Memory } from "@/lib/agent/types";
import { EMPTY_MEMORY } from "@/lib/agent/types";
import { entityName, linkEntities } from "@/lib/kb/index";
import { unique } from "@/lib/retrieval/text";

export function updateMemory(previous: Memory, classification: Classification, draft: Draft): Memory {
  if (classification.boundary === "personal_data") {
    return {
      ...previous,
      lastQuestion: null,
      turns: previous.turns + 1,
    };
  }
  const factText = draft.sentences
    .filter((sentence) => sentence.kind === "fact")
    .map((sentence) => sentence.text)
    .join(" ");
  const ids = unique([...linkEntities(classification.resolvedQuestion), ...linkEntities(factText)]);
  const ordered = [
    ...ids.filter((id) => !id.startsWith("project:") && !id.startsWith("dept:")),
    ...ids.filter((id) => id.startsWith("project:")),
    ...ids.filter((id) => id.startsWith("dept:")),
  ].slice(-8);
  const topicId = ordered.find((id) => id.startsWith("project:")) ?? ordered.find((id) => id.startsWith("dept:")) ?? ordered[0];
  return {
    topic: topicId ? entityName(topicId) : previous.topic,
    entities: ordered,
    filters: {
      year: classification.filters.year,
      site: classification.filters.site,
      department: classification.filters.department,
      documentType: classification.filters.documentType,
    },
    lastQuestion: classification.resolvedQuestion.slice(0, 240),
    turns: previous.turns + 1,
  };
}

export function sanitizeMemory(input: unknown): Memory {
  if (!input || typeof input !== "object") return EMPTY_MEMORY;
  const record = input as Partial<Memory>;
  const entities = Array.isArray(record.entities)
    ? record.entities.filter((id): id is string => typeof id === "string" && /^[a-z0-9:-]{1,64}$/.test(id)).slice(0, 8)
    : [];
  const filters = record.filters && typeof record.filters === "object" ? record.filters : {};
  return {
    topic: typeof record.topic === "string" ? record.topic.slice(0, 120) : null,
    entities,
    filters: {
      year: typeof filters.year === "number" ? filters.year : undefined,
      site: typeof filters.site === "string" ? filters.site.slice(0, 80) : undefined,
      department: typeof filters.department === "string" ? filters.department.slice(0, 80) : undefined,
      documentType: typeof filters.documentType === "string" ? filters.documentType.slice(0, 40) : undefined,
    },
    lastQuestion: typeof record.lastQuestion === "string" ? record.lastQuestion.slice(0, 240) : null,
    turns: typeof record.turns === "number" ? Math.min(record.turns, 50) : 0,
  };
}
