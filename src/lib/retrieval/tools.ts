import { calculate, extractExpression } from "@/lib/agent/calculator";
import { executeReadOnlySql, formatSqlEvidence } from "@/lib/agent/sql";
import type { Evidence, Filters, SqlKind, ToolCall, ToolName } from "@/lib/agent/types";
import { DOCUMENTS, EDGES } from "@/lib/kb/catalog";
import {
  allDocuments,
  entityByName,
  entityName,
  getDocument,
  linkEntities,
} from "@/lib/kb/index";
import type { Claim, KbDocument, KbEdge } from "@/lib/kb/types";
import { Bm25Index } from "@/lib/retrieval/bm25";
import { TfidfIndex } from "@/lib/retrieval/tfidf";
import { unique } from "@/lib/retrieval/text";

export interface ToolRun {
  evidence: Evidence[];
  calls: ToolCall[];
}

let vectorIndex: TfidfIndex | null = null;
let keywordIndex: Bm25Index | null = null;

function indexes() {
  if (!vectorIndex || !keywordIndex) {
    vectorIndex = new TfidfIndex(DOCUMENTS);
    keywordIndex = new Bm25Index(DOCUMENTS);
  }
  return { vectorIndex, keywordIndex };
}

export function vectorSearchTool(query: string, k = 5): Evidence[] {
  const hits = indexes().vectorIndex.search(query, Math.max(k * 3, 8));
  return hits
    .map((hit) => ({
      document: hit.document,
      score: hit.score * (hit.document.status === "current" ? 1 : 0.45),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, k)
    .map((hit) => documentEvidence(hit.document, "vector_search", hit.score));
}

export function keywordSearchTool(query: string, k = 5): Evidence[] {
  const hits = indexes().keywordIndex.search(query, k);
  return hits.map((hit) => documentEvidence(hit.document, "keyword_search", hit.score));
}

export function hybridSearchTool(query: string, k = 5): Evidence[] {
  const vector = indexes().vectorIndex.search(query, k * 3);
  const keyword = indexes().keywordIndex.search(query, k * 3);
  const scores = new Map<string, { document: KbDocument; score: number }>();
  vector.forEach((hit, rank) => {
    const current = scores.get(hit.document.id);
    const fused = 1 / (60 + rank + 1);
    if (current) current.score += fused;
    else scores.set(hit.document.id, { document: hit.document, score: fused });
  });
  keyword.forEach((hit, rank) => {
    const current = scores.get(hit.document.id);
    const fused = 1 / (60 + rank + 1);
    if (current) current.score += fused;
    else scores.set(hit.document.id, { document: hit.document, score: fused });
  });
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((hit) => documentEvidence(hit.document, "hybrid_search", hit.score));
}

export function metadataSearchTool(filters: Filters, query = "", k = 20): Evidence[] {
  let docs = allDocuments().filter((document) => {
    if (filters.documentType && document.documentType !== filters.documentType) return false;
    if (filters.year && document.year !== filters.year) return false;
    if (filters.site && document.site !== filters.site) return false;
    if (filters.department && document.department !== filters.department) return false;
    if (filters.status && document.status !== filters.status) return false;
    return true;
  });
  if (query.trim()) {
    const ranked = new Map(indexes().keywordIndex.search(query, 50).map((hit) => [hit.document.id, hit.score]));
    docs = [...docs].sort(
      (a, b) => (ranked.get(b.id) ?? 0) - (ranked.get(a.id) ?? 0) || b.year - a.year,
    );
  } else {
    docs = [...docs].sort((a, b) => b.year - a.year || Number(b.status === "current") - Number(a.status === "current"));
  }
  return docs.slice(0, k).map((document, index) =>
    documentEvidence(document, "metadata_search", document.status === "current" ? 1 - index * 0.01 : 0.2),
  );
}

export function graphSearchTool(entityIds: string[], hops: number): Evidence[] {
  const seeds = unique(entityIds);
  const evidence: Evidence[] = [];
  const seen = new Set<string>();
  for (const document of DOCUMENTS) {
    for (const item of document.claims) {
      const owner = item.key.split("|")[0];
      if (!seeds.includes(owner)) continue;
      const id = `graph:claim:${document.id}:${item.key}:${item.value}:${item.status}`;
      if (seen.has(id)) continue;
      seen.add(id);
      evidence.push(claimEvidence(document, item, id, item.status === "current" ? 0.96 : 0.22));
    }
  }

  let frontier = [...seeds];
  const visited = new Set(seeds);
  for (let hop = 1; hop <= hops; hop += 1) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const item of EDGES) {
        if (item.from !== node && item.to !== node) continue;
        if (!seen.has(item.id)) {
          seen.add(item.id);
          evidence.push(edgeEvidence(item, hop));
        }
        const other = item.from === node ? item.to : item.from;
        if (!visited.has(other)) {
          visited.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  return evidence;
}

export interface CompiledSql {
  sql: string;
  kind: SqlKind;
}

export function compileSql(question: string, entityIds: string[]): CompiledSql[] {
  const queries: CompiledSql[] = [];
  const year = question.match(/\b(20\d{2})\b/)?.[1];
  const department = entityIds
    .map((id) => (id.startsWith("dept:") ? entityName(id) : null))
    .find(Boolean);
  const project = entityIds
    .map((id) => (id.startsWith("project:") ? entityName(id).replace(/^Project\s+/i, "") : null))
    .find(Boolean);

  if (/\bwork orders?\b/i.test(question) && /\bopen\b/i.test(question) && /\bhigh\b/i.test(question)) {
    queries.push({
      kind: "work_orders_open_high",
      sql: "SELECT id, asset, site, priority, status, project FROM work_orders WHERE status = 'open' AND priority = 'high'",
    });
  } else if (/\bwork orders?\b/i.test(question) && project) {
    queries.push({
      kind: "project_work_orders",
      sql: `SELECT id, asset, site, priority, status, project FROM work_orders WHERE project = '${escapeLiteral(project)}' AND status = 'open'`,
    });
  }

  if (/\blost\b/i.test(question) && /\b(mwh|megawatt|energy|outage)/i.test(question)) {
    queries.push({
      kind: "outage_loss",
      sql: "SELECT site, SUM(mwh_lost) AS mwh_lost FROM outages GROUP BY site ORDER BY mwh_lost DESC",
    });
  }

  if (/\b(generation|generated|generates)\b/i.test(question)) {
    const yearClause = year ? ` WHERE year = ${Number(year)}` : "";
    queries.push({
      kind: "generation",
      sql: `SELECT site, SUM(mwh) AS mwh FROM generation${yearClause} GROUP BY site ORDER BY mwh DESC`,
    });
  }

  if (/\bbudget\b/i.test(question)) {
    const filters = [
      year ? `year = ${Number(year)}` : "",
      department ? `department = '${escapeLiteral(department)}'` : "",
    ].filter(Boolean);
    const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
    queries.push({
      kind: "budgets",
      sql: `SELECT department, year, amount_usd FROM budgets${where} ORDER BY amount_usd DESC`,
    });
  }

  const embedded = question.match(/\bselect\s+[\s\S]+?\sfrom\s+[a-z_]+[\s\S]*$/i);
  if (embedded && queries.length === 0) {
    queries.push({ kind: "generic", sql: embedded[0] });
  }
  return queries;
}

export function sqlQueryTool(question: string, entityIds: string[]): Evidence[] {
  const compiled = compileSql(question, entityIds);
  if (compiled.length === 0) {
    return [
      {
        id: "sql:none",
        tool: "sql_query",
        title: "SQL planner",
        text: "No safe SELECT matched this question. The SQL tool does not invent a query when the metric is unrecognized.",
        score: 0.1,
        status: "current",
        claims: [],
        locator: "sql · no query",
        sqlKind: "generic",
      },
    ];
  }
  return compiled.map((query, index) => {
    try {
      const result = executeReadOnlySql(query.sql);
      const summary = verbalizeSql(query.kind, result.rows, question);
      return {
        id: `sql:${query.kind}:${index}`,
        tool: "sql_query" as const,
        title: `SQL ${query.kind}`,
        text: `${formatSqlEvidence(result)}\n${summary}`,
        score: 1,
        status: "current" as const,
        claims: [],
        locator: `table · ${query.sql}`,
        sqlKind: query.kind,
        rows: result.rows,
        summary,
      };
    } catch (error) {
      return {
        id: `sql:error:${index}`,
        tool: "sql_query" as const,
        title: "SQL refused",
        text: error instanceof Error ? error.message : "SQL failed.",
        score: 0.1,
        status: "current" as const,
        claims: [],
        locator: "sql · error",
        sqlKind: query.kind,
      };
    }
  });
}

export function calculatorTool(question: string): Evidence[] {
  const result = extractExpression(question);
  if (!result) {
    return [
      {
        id: "calc:none",
        tool: "calculator",
        title: "Calculator",
        text: "No numeric expression was found in the question.",
        score: 0.1,
        status: "current",
        claims: [],
        locator: "calculator · no expression",
      },
    ];
  }
  if (!result.ok || result.value === undefined) {
    return [
      {
        id: "calc:error",
        tool: "calculator",
        title: "Calculator",
        text: result.error ?? "Could not calculate.",
        score: 0.1,
        status: "current",
        claims: [],
        locator: "calculator · error",
        expression: result.expression,
      },
    ];
  }
  const shown = formatCalc(result.value, result.currency);
  const text = `Expression ${result.expression} = ${result.value}. Displayed as ${shown}. Both inputs were supplied in the question, not retrieved from the Helios corpus.`;
  return [
    {
      id: "calc:result",
      tool: "calculator",
      title: "Calculator",
      text,
      score: 1,
      status: "current",
      claims: [
        {
          key: "calc|result",
          value: String(result.value),
          status: "current",
          sentence: text,
        },
      ],
      locator: "calculator · user-supplied inputs",
      expression: result.expression,
    },
  ];
}

export function differenceEvidence(left: number, right: number, label: string): Evidence {
  const result = calculate(`${left} - ${right}`);
  const value = result.value ?? left - right;
  const text = `Expression ${left} - ${right} = ${value}. ${label}`;
  return {
    id: "calc:difference",
    tool: "calculator",
    title: "Calculator",
    text,
    score: 1,
    status: "current",
    claims: [
      {
        key: "calc|difference",
        value: String(value),
        status: "current",
        sentence: text,
      },
    ],
    locator: "calculator · difference of retrieved totals",
    expression: `${left} - ${right}`,
    rows: [{ left, right, difference: value }],
  };
}

export function executeTools(
  tools: ToolName[],
  args: {
    queries: string[];
    question: string;
    k: number;
    hops: number;
    entities: string[];
    filters: Filters;
    attempt: number;
  },
): ToolRun {
  const evidence: Evidence[] = [];
  const calls: ToolCall[] = [];
  const queries = unique(args.queries.map((query) => query.trim()).filter(Boolean)).slice(0, 4);
  for (const tool of tools) {
    let found: Evidence[] = [];
    let input: Record<string, unknown> = {};
    if (tool === "vector_search" || tool === "keyword_search" || tool === "hybrid_search") {
      input = { queries, k: args.k };
      const merged = new Map<string, Evidence>();
      for (const query of queries) {
        const hits =
          tool === "vector_search"
            ? vectorSearchTool(query, args.k)
            : tool === "keyword_search"
              ? keywordSearchTool(query, args.k)
              : hybridSearchTool(query, args.k);
        for (const hit of hits) {
          const previous = merged.get(hit.id);
          if (!previous || hit.score > previous.score) merged.set(hit.id, hit);
        }
      }
      found = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, args.k);
    } else if (tool === "graph_search") {
      const linked = unique([...args.entities, ...linkEntities(queries.join(" "))]);
      input = { entities: linked.map(entityName), hops: args.hops };
      found = graphSearchTool(linked, args.hops);
    } else if (tool === "sql_query") {
      const compiled = compileSql(args.question, args.entities);
      input = { sql: compiled.map((query) => query.sql) };
      found = sqlQueryTool(args.question, args.entities);
    } else if (tool === "metadata_search") {
      input = { ...args.filters, k: Math.max(args.k, 8) };
      found = metadataSearchTool(args.filters, queries[0] ?? "", Math.max(args.k, 8));
    } else if (tool === "calculator") {
      input = { question: args.question };
      found = calculatorTool(args.question);
    }
    evidence.push(...found);
    calls.push({
      tool,
      input,
      resultCount: found.length,
      summary: summarize(tool, found),
      attempt: args.attempt,
    });
  }
  return { evidence, calls };
}

function documentEvidence(document: KbDocument, tool: ToolName, score: number): Evidence {
  return {
    id: `doc:${document.id}`,
    tool,
    title: document.title,
    text: `${document.title}. ${document.text}`,
    score,
    documentId: document.id,
    documentType: document.documentType,
    year: document.year,
    status: document.status,
    site: document.site,
    claims: document.claims,
    locator: `${document.id} · ${document.year} · ${document.status}`,
  };
}

function claimEvidence(document: KbDocument, item: Claim, id: string, score: number): Evidence {
  return {
    id,
    tool: "graph_search",
    title: document.title,
    text: item.sentence,
    score,
    documentId: document.id,
    documentType: document.documentType,
    year: document.year,
    status: item.status,
    site: document.site,
    claims: [item],
    locator: `${document.id} · ${document.year} · ${item.status}`,
  };
}

function edgeEvidence(item: KbEdge, hop: number): Evidence {
  const document = getDocument(item.sourceDocId);
  return {
    id: `graph:edge:${item.id}`,
    tool: "graph_search",
    title: document?.title ?? item.sourceDocId,
    text: item.sentence,
    score: item.status === "current" ? 0.9 - hop * 0.04 : 0.2,
    documentId: item.sourceDocId,
    documentType: document?.documentType,
    year: document?.year,
    status: item.status,
    claims: [
      {
        key: item.claimKey,
        value: item.claimValue,
        status: item.status,
        sentence: item.sentence,
      },
    ],
    locator: `${item.sourceDocId} · ${item.rel} · hop ${hop}`,
  };
}

function summarize(tool: ToolName, evidence: Evidence[]): string {
  if (evidence.length === 0) return `${tool} returned nothing.`;
  const top = [...evidence].sort((a, b) => b.score - a.score)[0];
  return `${evidence.length} result${evidence.length === 1 ? "" : "s"}. Top: ${top.title} (${top.score.toFixed(2)}).`;
}

function escapeLiteral(value: string): string {
  if (!/^[\w .&-]+$/.test(value)) {
    throw new Error(`Refusing to interpolate "${value}" into SQL.`);
  }
  return value.replace(/'/g, "''");
}

function formatCount(value: string | number | null | undefined): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? "");
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numeric);
}

function verbalizeSql(kind: SqlKind, rows: Record<string, string | number | null>[], question: string): string {
  if (kind === "work_orders_open_high") {
    const listed = rows
      .map((row) => `${row.id} (${row.site}, asset ${row.asset}, project ${row.project})`)
      .join("; ");
    return `There are ${rows.length} open high-priority work orders: ${listed}.`;
  }
  if (kind === "project_work_orders") {
    if (rows.length === 0) return "The work_orders table has no open rows for that project.";
    return rows
      .map((row) => `${row.id} is open at priority ${row.priority} on asset ${row.asset} at ${row.site}.`)
      .join(" ");
  }
  if (kind === "outage_loss") {
    const ranked = [...rows].sort((a, b) => Number(b.mwh_lost) - Number(a.mwh_lost));
    const top = ranked[0];
    const detail = ranked.map((row) => `${row.site} ${formatCount(row.mwh_lost)} MWh`).join("; ");
    return `${top?.site} has the most lost MWh, at ${formatCount(top?.mwh_lost)}. By site: ${detail}.`;
  }
  if (kind === "generation") {
    const year = question.match(/\b(20\d{2})\b/)?.[1] ?? "the selected period";
    const bits = rows.map((row) => `${row.site} generated ${formatCount(row.mwh)} MWh`);
    return `In ${year}, ${bits.join(" and ")}.`;
  }
  if (kind === "budgets") {
    return rows
      .map((row) => `${row.department} budget for ${row.year} is ${formatCount(row.amount_usd)} USD.`)
      .join(" ");
  }
  return rows.length ? `Returned ${rows.length} rows.` : "The query returned no rows.";
}

export function formatCalc(value: number, currency: boolean): string {
  if (currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function inferFilters(question: string, entityIds: string[]): Filters {
  const yearMatch = question.match(/\b(20\d{2})\b/);
  const siteId = entityIds.find((id) => id.startsWith("site:"));
  const departmentId = entityIds.find((id) => id.startsWith("dept:"));
  let documentType: string | undefined;
  if (/\bincident reports?\b/i.test(question)) documentType = "incident_report";
  else if (/\brunbooks?\b/i.test(question)) documentType = "runbook";
  else if (/\bproject briefs?\b/i.test(question)) documentType = "project_brief";
  else if (/\borg charts?\b/i.test(question)) documentType = "org_chart";
  else if (/\bpolicies\b/i.test(question) || /\bpolicy\b/i.test(question)) documentType = "policy";
  return {
    year: yearMatch ? Number(yearMatch[1]) : undefined,
    site: siteId ? entityName(siteId) : undefined,
    department: departmentId ? entityName(departmentId) : undefined,
    documentType,
    status: /\bsuperseded|draft\b/i.test(question) ? undefined : "current",
  };
}

export function departmentIdForName(name: string): string | undefined {
  return entityByName(name)?.id;
}
