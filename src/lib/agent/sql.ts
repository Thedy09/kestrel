import { TABLES } from "@/lib/kb/catalog";
import { tableNames } from "@/lib/kb/index";
import type { SqlRow, SqlValue } from "@/lib/kb/types";

export interface SqlResult {
  sql: string;
  columns: string[];
  rows: SqlRow[];
}

const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|attach|pragma|create|replace|truncate|grant|into|union|exec)\b/i;

interface SelectExpr {
  agg: "count" | "sum" | "avg" | "min" | "max" | null;
  column: string;
  alias: string;
  star: boolean;
}

export function executeReadOnlySql(rawSql: string): SqlResult {
  const sql = rawSql.trim().replace(/;+\s*$/, "");
  if (!sql) throw new Error("Empty SQL.");
  if (sql.includes(";")) throw new Error("Only one SELECT statement is allowed.");
  if (!/^select\b/i.test(sql)) throw new Error("Only SELECT is allowed.");
  if (FORBIDDEN.test(sql)) throw new Error("Write statements and UNION are refused.");
  if (/--|\/\*/.test(sql)) throw new Error("SQL comments are refused.");

  const fromMatch = sql.match(/^select\s+([\s\S]+?)\s+from\s+([a-z_][a-z0-9_]*)\b/i);
  if (!fromMatch) throw new Error("Could not parse SELECT … FROM.");
  const tableName = fromMatch[2].toLowerCase();
  if (!tableNames().includes(tableName)) {
    throw new Error(
      `Unknown table "${tableName}". Available tables: ${tableNames().join(", ")}.`,
    );
  }
  const rest = sql.slice(fromMatch[0].length);
  const where = clause(rest, "where", ["group", "order", "limit"]);
  const group = clause(rest, "group\\s+by", ["order", "limit"]);
  const order = clause(rest, "order\\s+by", ["limit"]);
  const limitMatch = rest.match(/\blimit\s+(\d+)\b/i);
  const limit = limitMatch ? Number(limitMatch[1]) : 50;

  let rows = (TABLES[tableName] ?? []).map((row) => ({ ...row }));
  if (where.trim()) {
    const conditions = splitAnd(where);
    rows = rows.filter((row) => conditions.every((condition) => matchCondition(row, condition)));
  }

  const expressions = parseSelect(fromMatch[1]);
  const grouped = expressions.some((expr) => expr.agg) || group.trim().length > 0;
  let projected = grouped
    ? aggregate(rows, expressions, group.split(",").map((part) => part.trim()).filter(Boolean))
    : rows.map((row) => project(row, expressions));

  if (order.trim()) {
    const parts = order.trim().split(/\s+/);
    const column = parts[0]?.replace(/,$/, "") ?? "";
    const direction = /desc/i.test(parts[1] ?? "") ? -1 : 1;
    projected = [...projected].sort((a, b) => compareValues(a[column], b[column]) * direction);
  }
  projected = projected.slice(0, limit);
  const columns =
    projected[0] !== undefined
      ? Object.keys(projected[0])
      : expressions.filter((expr) => !expr.star).map((expr) => expr.alias);
  return { sql, columns, rows: projected };
}

function clause(rest: string, name: string, until: string[]): string {
  const stop = until.length ? `(?=\\b(?:${until.join("|")})\\b|$)` : "$";
  const match = rest.match(new RegExp(`\\b${name}\\b([\\s\\S]*?)${stop}`, "i"));
  return match?.[1]?.trim() ?? "";
}

function splitAnd(where: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  const upper = where;
  for (let index = 0; index < upper.length; index += 1) {
    const char = upper[index];
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (upper.slice(index, index + 5).toLowerCase() === " and " && !quote) {
      parts.push(current.trim());
      current = "";
      index += 4;
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function matchCondition(row: SqlRow, condition: string): boolean {
  const match = condition.match(/^\s*([a-z_][a-z0-9_]*)\s*(=|!=|<>|>=|<=|>|<)\s*(.+?)\s*$/i);
  if (!match) throw new Error(`Could not parse condition "${condition}".`);
  const column = match[1];
  const operator = match[2];
  const expected = parseLiteral(match[3]);
  if (!(column in row)) throw new Error(`Unknown column "${column}".`);
  const actual = row[column];
  const compared = compareValues(actual, expected);
  if (operator === "=") return compared === 0;
  if (operator === "!=" || operator === "<>") return compared !== 0;
  if (operator === ">") return compared > 0;
  if (operator === "<") return compared < 0;
  if (operator === ">=") return compared >= 0;
  if (operator === "<=") return compared <= 0;
  return false;
}

function parseLiteral(raw: string): SqlValue {
  const value = raw.trim();
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  throw new Error(`Unsafe or unsupported literal "${value}".`);
}

function parseSelect(list: string): SelectExpr[] {
  if (list.trim() === "*") return [{ agg: null, column: "*", alias: "*", star: true }];
  return splitComma(list).map((part) => {
    const piece = part.trim();
    const agg = piece.match(/^(count|sum|avg|min|max)\(\s*(\*|[\w]+)\s*\)(?:\s+as\s+([a-z_][a-z0-9_]*))?$/i);
    if (agg) {
      const fn = agg[1].toLowerCase() as SelectExpr["agg"];
      const column = agg[2];
      const alias = agg[3] ?? (fn === "count" ? "count" : `${fn}_${column}`);
      return { agg: fn, column, alias, star: false };
    }
    const plain = piece.match(/^([a-z_][a-z0-9_]*)(?:\s+as\s+([a-z_][a-z0-9_]*))?$/i);
    if (!plain) throw new Error(`Could not parse select item "${piece}".`);
    return { agg: null, column: plain[1], alias: plain[2] ?? plain[1], star: false };
  });
}

function splitComma(list: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of list) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function project(row: SqlRow, expressions: SelectExpr[]): SqlRow {
  if (expressions.some((expr) => expr.star)) return { ...row };
  const projected: SqlRow = {};
  for (const expr of expressions) {
    if (!(expr.column in row)) throw new Error(`Unknown column "${expr.column}".`);
    projected[expr.alias] = row[expr.column];
  }
  return projected;
}

function aggregate(rows: SqlRow[], expressions: SelectExpr[], groupCols: string[]): SqlRow[] {
  const groups = new Map<string, SqlRow[]>();
  for (const row of rows) {
    const key = groupCols.map((column) => String(row[column] ?? "")).join("||");
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  if (groups.size === 0 && expressions.every((expr) => expr.agg)) {
    groups.set("", []);
  }
  const output: SqlRow[] = [];
  for (const bucket of groups.values()) {
    const projected: SqlRow = {};
    for (const expr of expressions) {
      if (!expr.agg) {
        projected[expr.alias] = bucket[0]?.[expr.column] ?? null;
        continue;
      }
      projected[expr.alias] = applyAgg(expr, bucket);
    }
    output.push(projected);
  }
  return output;
}

function applyAgg(expr: SelectExpr, rows: SqlRow[]): SqlValue {
  if (expr.agg === "count") {
    if (expr.column === "*") return rows.length;
    return rows.filter((row) => row[expr.column] !== null && row[expr.column] !== undefined).length;
  }
  const numbers = rows
    .map((row) => row[expr.column])
    .filter((value): value is number => typeof value === "number");
  if (numbers.length === 0) return null;
  if (expr.agg === "sum") return numbers.reduce((sum, value) => sum + value, 0);
  if (expr.agg === "avg") return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  if (expr.agg === "min") return Math.min(...numbers);
  if (expr.agg === "max") return Math.max(...numbers);
  return null;
}

function compareValues(left: SqlValue | undefined, right: SqlValue | undefined): number {
  if (left === right) return 0;
  if (left === null || left === undefined) return -1;
  if (right === null || right === undefined) return 1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}

export function formatSqlEvidence(result: SqlResult): string {
  const header = result.columns.join(" | ");
  const lines = result.rows.map((row) =>
    result.columns.map((column) => `${column}=${String(row[column])}`).join(" | "),
  );
  return [`SQL: ${result.sql}`, `Rows: ${result.rows.length}`, header, ...lines].join("\n");
}
