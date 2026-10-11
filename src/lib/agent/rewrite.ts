import { unique } from "@/lib/retrieval/text";

export function rewriteQuery(
  question: string,
  entityNames: string[],
  attempt: number,
  missing: string[],
): string[] {
  const subject =
    entityNames.find((name) => /project|atlas|lumen|harbor|keel|scada|forecast/i.test(name)) ??
    entityNames[0] ??
    "the subject";
  const blob = `${question} ${missing.join(" ")}`;
  const queries = [question];

  if (/\b(system|depend|support|infrastructure|connect)/i.test(blob)) {
    queries.push(
      `${subject} dependencies`,
      `${subject} connected technologies`,
      `Systems used by ${subject}`,
      `Infrastructure supporting ${subject}`,
    );
  }
  if (/\b(leader|leads|director|who leads)\b/i.test(blob)) {
    queries.push(`leader of ${subject}`, `${subject} director`, "organization chart department leader");
  }
  if (/\b(upstream|feeds|forecast)\b/i.test(blob)) {
    queries.push(`${subject} forecast feed`, "Weather-Mesh feeds Forecast-Oak", `${subject} dependencies`);
  }
  if (/\b(incident|status)\b/i.test(blob)) {
    queries.push(`${subject} incident report`, `${subject} current status`);
  }
  if (attempt >= 2) queries.push(entityNames.join(" "));
  if (missing.length) queries.push(missing.join(". "));
  return unique(queries.map((query) => query.trim()).filter(Boolean)).slice(0, 6);
}
