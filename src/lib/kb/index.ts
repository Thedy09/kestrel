import { DOCUMENTS, EDGES, ENTITIES, TABLES } from "@/lib/kb/catalog";
import type { KbDocument, KbEntity } from "@/lib/kb/types";
import { unique } from "@/lib/retrieval/text";

const ALIASES = ENTITIES.flatMap((entity) =>
  [entity.name, ...entity.aliases].map((alias) => ({
    alias: alias.toLowerCase(),
    id: entity.id,
  })),
).sort((a, b) => b.alias.length - a.alias.length);

const entityById = new Map(ENTITIES.map((entity) => [entity.id, entity]));
const documentById = new Map(DOCUMENTS.map((document) => [document.id, document]));

export function getEntity(id: string): KbEntity | undefined {
  return entityById.get(id);
}

export function entityName(id: string): string {
  return entityById.get(id)?.name ?? id;
}

export function getDocument(id: string): KbDocument | undefined {
  return documentById.get(id);
}

export function allDocuments(): KbDocument[] {
  return DOCUMENTS;
}

export function allEdges() {
  return EDGES;
}

export function allEntities(): KbEntity[] {
  return ENTITIES;
}

export function tableRows(name: string) {
  return TABLES[name] ?? [];
}

export function tableNames(): string[] {
  return Object.keys(TABLES);
}

export function linkEntities(text: string): string[] {
  const lower = text.toLowerCase();
  const taken = Array.from({ length: lower.length }, () => false);
  const found: string[] = [];
  for (const entry of ALIASES) {
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(entry.alias, from);
      if (at < 0) break;
      const end = at + entry.alias.length;
      const leftOk = at === 0 || /[^a-z0-9]/i.test(lower[at - 1] ?? "");
      const rightOk = end === lower.length || /[^a-z0-9]/i.test(lower[end] ?? "");
      const free = taken.slice(at, end).every((bit) => !bit);
      if (leftOk && rightOk && free) {
        for (let index = at; index < end; index += 1) taken[index] = true;
        found.push(entry.id);
      }
      from = at + Math.max(entry.alias.length, 1);
    }
  }
  return unique(found);
}

export function entityByName(name: string): KbEntity | undefined {
  const needle = name.trim().toLowerCase();
  return ENTITIES.find(
    (entity) =>
      entity.name.toLowerCase() === needle ||
      entity.aliases.some((alias) => alias.toLowerCase() === needle),
  );
}

export function corpusSnapshot() {
  return {
    documents: DOCUMENTS.map((document) => ({
      id: document.id,
      title: document.title,
      documentType: document.documentType,
      year: document.year,
      site: document.site ?? null,
      department: document.department ?? null,
      status: document.status,
      text: document.text,
    })),
    edges: EDGES.map((edge) => ({
      id: edge.id,
      from: entityName(edge.from),
      rel: edge.rel,
      to: entityName(edge.to),
      source: edge.sourceDocId,
      status: edge.status,
      sentence: edge.sentence,
    })),
    tables: Object.fromEntries(
      Object.entries(TABLES).map(([name, rows]) => [name, rows]),
    ),
    entities: ENTITIES.map((entity) => ({
      id: entity.id,
      type: entity.type,
      name: entity.name,
      role: entity.role ?? null,
    })),
  };
}
