import type { Classification, Draft, Evidence, Sentence } from "@/lib/agent/types";
import { assessFacets, collectHits, type FacetAssessment, type FactHit } from "@/lib/agent/evaluate";
import { differenceEvidence, formatCalc } from "@/lib/retrieval/tools";
import { entityByName, entityName } from "@/lib/kb/index";
import { tokenize, unique } from "@/lib/retrieval/text";

export function generate(classification: Classification, evidence: Evidence[]): { draft: Draft; extraEvidence: Evidence[] } {
  const extraEvidence: Evidence[] = [];
  const sentences: Sentence[] = [];
  const hits = collectHits(evidence);
  const assessments = assessFacets(classification, evidence);

  if (classification.boundary === "personal_data") {
    sentences.push(...boundarySentences(classification, evidence, "personal"));
  } else if (classification.boundary === "control_action") {
    sentences.push(...boundarySentences(classification, evidence, "control"));
  } else if (classification.boundary === "write_action") {
    sentences.push(...boundarySentences(classification, evidence, "write"));
  } else if (classification.ambiguous) {
    sentences.push({
      kind: "interpretation",
      text: "I read this as a question about current project status and the latest related incident, not as a request for a health score. No composite score is defined in the corpus.",
      evidenceIds: [],
      supportTokens: [],
    });
    sentences.push(...assessments.flatMap((facet) => sentencesForFacet(facet, classification, evidence, hits)));
  } else if (classification.questionType === "exact_lookup") {
    sentences.push(...exactSentences(classification, evidence, assessments));
  } else if (classification.questionType === "calculation") {
    sentences.push(...calculationSentences(classification, evidence, assessments));
  } else if (classification.questionType === "structured_data" || classification.questionType === "comparison") {
    const tabular = tabularSentences(classification, evidence, assessments);
    sentences.push(...tabular.sentences);
    extraEvidence.push(...tabular.extraEvidence);
  } else {
    sentences.push(...assessments.flatMap((facet) => sentencesForFacet(facet, classification, evidence, hits)));
    sentences.push(...hypothesisCorrections(classification, hits));
    sentences.push(...supersededNotes(hits, sentences));
  }

  if (classification.boundary === "none") {
    sentences.push(...recommendationSentences(classification, evidence));
  }

  const seen = new Set<string>();
  const deduped = sentences.filter((sentence) => {
    const key = `${sentence.kind}:${sentence.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { draft: renderDraft(deduped, [...evidence, ...extraEvidence]), extraEvidence };
}

function sentencesForFacet(
  facet: FacetAssessment,
  classification: Classification,
  evidence: Evidence[],
  hits: FactHit[],
): Sentence[] {
  if (!facet.covered || facet.missing) {
    return [gap(facet.missing ?? facet.facet, facet.facetId)];
  }
  if (facet.intent === "owner") return [ownerSentence(facet, classification)];
  if (facet.intent === "leader") return [leaderSentence(facet, classification, hits)];
  if (facet.intent === "dependencies") return [dependencySentence(facet, classification)];
  if (facet.intent === "upstream") return upstreamSentences(facet, classification, hits);
  if (facet.intent === "launch") return [launchSentence(facet)];
  if (facet.intent === "purpose") return [claimSentence(facet, facet.hits)];
  if (facet.intent === "status") return [statusSentence(facet, classification)];
  if (facet.intent === "incident") return [claimSentence(facet, facet.hits)];
  if (facet.intent === "work_orders" || facet.intent === "lost_energy" || facet.intent === "generation" || facet.intent === "budget") {
    return tabularSentences(classification, evidence, [facet]).sentences;
  }
  return [generalSentence(facet, evidence)];
}

function ownerSentence(facet: FacetAssessment, classification: Classification): Sentence {
  const hit = prefer(facet.hits);
  const project = projectLabel(classification);
  const text = project ? `${project} is owned by ${hit.value}.` : hit.sentence;
  return fact(text, [hit], facet.facetId, [hit.value]);
}

function leaderSentence(facet: FacetAssessment, classification: Classification, hits: FactHit[]): Sentence {
  const departmentIds = leaderDepartments(classification, hits);
  const pool = facet.hits.filter((hit) => departmentIds.length === 0 || departmentIds.some((id) => hit.key.startsWith(`${id}|`)));
  const hit = prefer(pool.length ? pool : facet.hits);
  return fact(hit.sentence, [hit], facet.facetId, [hit.value]);
}

function dependencySentence(facet: FacetAssessment, classification: Classification): Sentence {
  const values = unique(facet.hits.map((hit) => hit.value));
  const best = [...facet.hits].sort(
    (left, right) => values.filter((value) => right.sentence.includes(value)).length - values.filter((value) => left.sentence.includes(value)).length,
  )[0];
  const project = projectLabel(classification);
  const listed = joinList(values);
  const text =
    best && values.every((value) => best.sentence.includes(value))
      ? best.sentence
      : `${project ?? "The project"} depends on ${listed}.`;
  const cited = best && values.every((value) => best.sentence.includes(value)) ? [best] : facet.hits;
  return fact(text, cited, facet.facetId, values);
}

function upstreamSentences(facet: FacetAssessment, classification: Classification, hits: FactHit[]): Sentence[] {
  const feed = facet.hits.find((hit) => hit.key.endsWith("|fed_by")) ?? facet.hits[0];
  const project = projectLabel(classification);
  const dependency = hits.find(
    (hit) =>
      hit.status === "current" &&
      hit.key.endsWith("|depends_on") &&
      (!project || hit.key.startsWith(classification.entities.find((id) => id.startsWith("project:")) ?? "")),
  );
  const sentences: Sentence[] = [];
  if (dependency && project) {
    sentences.push(
      fact(`${project} depends on ${dependency.value}.`, [dependency], facet.facetId, [dependency.value, project]),
    );
  }
  if (feed) {
    sentences.push(fact(feed.sentence, [feed], facet.facetId, [feed.value]));
  }
  return sentences.length ? sentences : [gap(facet.facet, facet.facetId)];
}

function launchSentence(facet: FacetAssessment): Sentence {
  const dated = facet.hits.find((hit) => hit.key.endsWith("|launch")) ?? facet.hits[0];
  return fact(dated.sentence, [dated], facet.facetId, [dated.value]);
}

function statusSentence(facet: FacetAssessment, classification: Classification): Sentence {
  const hit = prefer(facet.hits);
  const project = projectLabel(classification);
  const text = project ? `${project} status is ${hit.value}.` : hit.sentence;
  const tokens = project && hit.sentence.includes(project) ? [project, hit.value] : [hit.value];
  const useExcerpt = hit.sentence.toLowerCase().includes(hit.value.toLowerCase());
  return fact(useExcerpt && !project ? hit.sentence : text, [hit], facet.facetId, tokens);
}

function claimSentence(facet: FacetAssessment, hits: FactHit[]): Sentence {
  const hit = prefer(hits);
  return fact(hit.sentence, [hit], facet.facetId, [hit.value]);
}

function generalSentence(facet: FacetAssessment, evidence: Evidence[]): Sentence {
  const current = evidence.filter((item) => item.status !== "superseded");
  const best = [...current].sort((left, right) => right.score - left.score)[0];
  if (!best) return gap(facet.missing ?? facet.facet, facet.facetId);
  const sentence = best.text.split(/(?<=\.)\s+/)[0] ?? best.text;
  return fact(sentence, [], facet.facetId, []);
}

function exactSentences(classification: Classification, evidence: Evidence[], assessments: FacetAssessment[]): Sentence[] {
  const facetId = assessments[0]?.facetId;
  if (assessments[0]?.intent === "listing") {
    const docs = evidence.filter((item) => item.tool === "metadata_search" && item.status !== "superseded");
    if (docs.length === 0) return [gap(assessments[0]?.missing ?? "No documents matched.", facetId)];
    const text = docs
      .map((item) => `${item.title} (${item.locator})`)
      .join("; ");
    return [
      fact(
        `Matching current documents: ${text}.`,
        docs.map((item) => hitFromEvidence(item, item.title)),
        facetId,
        docs.map((item) => item.title),
      ),
    ];
  }
  const quoted = classification.resolvedQuestion.match(/"([^"]+)"|“([^”]+)”/);
  const needle = quoted?.[1] ?? quoted?.[2] ?? classification.resolvedQuestion.match(/\b[A-Z]{1,5}-\d+(?:-[A-Z0-9]+)?\b|\bT-\d+\b/i)?.[0];
  const docs = evidence.filter(
    (item) => item.documentId && item.status !== "superseded" && (!needle || item.text.toLowerCase().includes(needle.toLowerCase())),
  );
  const procedure =
    docs.find((item) => item.documentType === "sop" || item.documentType === "runbook") ??
    docs.find((item) => item.documentType === "policy") ??
    docs[0];
  if (!procedure) return [gap("No passage contained that identifier.", facetId)];
  const snippet = procedure.text
    .split(/(?<=\.)\s+/)
    .find((sentence) => (needle ? sentence.toLowerCase().includes(needle.toLowerCase()) : true)) ?? procedure.text;
  return [fact(`${procedure.title}: ${snippet}`, [procedureToHit(procedure)], facetId, needle ? [needle] : [])];
}

function calculationSentences(classification: Classification, evidence: Evidence[], assessments: FacetAssessment[]): Sentence[] {
  const facetId = assessments[0]?.facetId;
  const calc = evidence.find((item) => item.id === "calc:result");
  if (!calc?.expression) return [gap(assessments[0]?.missing ?? "The expression could not be calculated.", facetId)];
  const value = calc.claims[0]?.value ?? "";
  const currency = /\$|revenue|price/i.test(classification.resolvedQuestion);
  const shown = formatCalc(Number(value), currency);
  const text = `The result of ${calc.expression} is ${shown}. These inputs were supplied in the question, not retrieved from the Helios tables.`;
  return [fact(text, [hitFromEvidence(calc, value)], facetId, [value, ...calc.expression.split(/\s*[*/+-]\s*/)])];
}

function tabularSentences(
  classification: Classification,
  evidence: Evidence[],
  assessments: FacetAssessment[],
): { sentences: Sentence[]; extraEvidence: Evidence[] } {
  const sentences: Sentence[] = [];
  const extraEvidence: Evidence[] = [];
  for (const facet of assessments) {
    const kind =
      facet.intent === "work_orders"
        ? "work_orders_open_high"
        : facet.intent === "lost_energy"
          ? "outage_loss"
          : facet.intent === "generation" || facet.intent === "general"
            ? "generation"
            : facet.intent === "budget"
              ? "budgets"
              : null;
    const item = evidence.find((candidate) => candidate.sqlKind === kind && candidate.summary);
    if (!item?.summary) {
      sentences.push(gap(facet.missing ?? facet.facet, facet.facetId));
      continue;
    }
    sentences.push(fact(item.summary, [hitFromEvidence(item, item.summary)], facet.facetId, supportFromRows(item)));
    if (classification.questionType === "comparison" && item.rows && item.rows.length >= 2) {
      const first = Number(item.rows[0]?.mwh);
      const second = Number(item.rows[1]?.mwh);
      if (Number.isFinite(first) && Number.isFinite(second)) {
        const diff = differenceEvidence(first, second, "Inputs are the retrieved generation totals.");
        extraEvidence.push(diff);
        const higher = first >= second ? item.rows[0] : item.rows[1];
        const lower = first >= second ? item.rows[1] : item.rows[0];
        sentences.push(
          fact(
            `${higher?.site} is higher by ${formatCount(Math.abs(first - second))} MWh (${higher?.site} ${formatCount(Number(higher?.mwh))} versus ${lower?.site} ${formatCount(Number(lower?.mwh))}).`,
            [hitFromEvidence(diff, String(Math.abs(first - second)))],
            facet.facetId,
            [String(Math.abs(first - second)), String(higher?.mwh), String(lower?.mwh)],
          ),
        );
      }
    }
  }
  return { sentences, extraEvidence };
}

function hypothesisCorrections(classification: Classification, hits: FactHit[]): Sentence[] {
  const sentences: Sentence[] = [];
  const seen = new Set<string>();
  for (const hypothesis of classification.hypotheses) {
    const current = hits.filter((hit) => hit.status === "current" && hit.key.endsWith(`|${hypothesis.attribute}`));
    const old = hits.filter(
      (hit) => hit.status === "superseded" && hit.key.endsWith(`|${hypothesis.attribute}`) && hit.value === hypothesis.value,
    );
    if (current.length === 0) continue;
    const agrees = current.some((hit) => hit.value.toLowerCase().includes(hypothesis.value.toLowerCase()));
    if (agrees) continue;
    const source = old[0];
    if (source && !seen.has(source.sentence)) {
      seen.add(source.sentence);
      const tokens = classification.hypotheses.map((item) => item.value).filter((value) => source.sentence.includes(value));
      sentences.push({
        kind: "correction",
        text: `${source.sentence} That draft is superseded and is not the current record.`,
        evidenceIds: [source.evidenceId],
        supportTokens: tokens,
        facetId: undefined,
      });
    } else if (!source) {
      const label = hypothesis.attribute === "launch_year" ? "launch year" : "owner";
      sentences.push({
        kind: "correction",
        text: `The ${label} stated in the question is not the current record.`,
        evidenceIds: [current[0].evidenceId],
        supportTokens: [],
        facetId: undefined,
      });
    }
  }
  return sentences;
}

function supersededNotes(hits: FactHit[], existing: Sentence[]): Sentence[] {
  const already = existing.map((sentence) => sentence.text).join(" ");
  const notes: Sentence[] = [];
  const keys = unique(hits.map((hit) => hit.key));
  for (const key of keys) {
    if (!/owned_by|launch_year|launch/.test(key)) continue;
    const current = unique(hits.filter((hit) => hit.key === key && hit.status === "current").map((hit) => hit.value));
    const oldHits = hits.filter((hit) => hit.key === key && hit.status === "superseded" && !current.includes(hit.value));
    if (current.length !== 1 || oldHits.length === 0) continue;
    if (already.toLowerCase().includes(oldHits[0].value.toLowerCase())) continue;
    if (!existing.some((sentence) => sentence.kind === "fact" && sentence.text.toLowerCase().includes(current[0].toLowerCase()))) {
      continue;
    }
    notes.push({
      kind: "correction",
      text: `${oldHits[0].sentence} That statement is superseded and is not the current record.`,
      evidenceIds: [oldHits[0].evidenceId],
      supportTokens: [oldHits[0].value],
      facetId: undefined,
    });
  }
  return notes;
}

function recommendationSentences(classification: Classification, evidence: Evidence[]): Sentence[] {
  const topical = /\b(depend|system|scada|infrastructure|outage|fail|lockout|tagout|policy|procedure|bypass|runbook|safety)\b/i.test(
    classification.resolvedQuestion,
  );
  if (!topical) return [];
  const names = classification.entities.map((id) => entityName(id).toLowerCase());
  const questionTokens = new Set(tokenize(classification.resolvedQuestion));
  const sentences: Sentence[] = [];
  for (const item of evidence) {
    if (item.status === "superseded") continue;
    const matches = item.text.match(/[^.]*\bmust not\b[^.]*\./gi) ?? [];
    for (const match of matches) {
      const sentence = match.trim();
      if (/personal phone|government identifiers|change work orders|send commands/i.test(sentence)) continue;
      const tokens = tokenize(sentence);
      const overlap = tokens.filter((token) => questionTokens.has(token) || names.some((name) => name.includes(token)));
      if (overlap.length < 1) continue;
      sentences.push({
        kind: "recommendation",
        text: `From ${item.title}: ${sentence} This is procedure text, not a new instruction.`,
        evidenceIds: [item.id],
        supportTokens: [],
        facetId: undefined,
      });
    }
  }
  return sentences.slice(0, 2);
}

function boundarySentences(classification: Classification, evidence: Evidence[], kind: "personal" | "control" | "write"): Sentence[] {
  const facetId = "f0";
  if (kind === "personal") {
    const policy = evidence.find((item) => /personal phone numbers/i.test(item.text) && item.documentId === "DOC-DATA")
      ?? evidence.find((item) => /personal phone numbers/i.test(item.text));
    const who = classification.entities.find((id) => id.startsWith("person:"));
    const subject = who ? `${entityName(who)}'s personal phone number` : "That personal contact detail";
    return [
      {
        kind: "fact",
        text: policy
          ? `${subject} is not in the Helios corpus. ${policy.text.split(/(?<=\.)\s+/).find((sentence) => /personal phone/i.test(sentence)) ?? ""}`
          : `${subject} is not in the Helios corpus, and Kestrel is not allowed to infer it.`,
        evidenceIds: policy ? [policy.id] : [],
        supportTokens: policy ? ["personal phone numbers"] : [],
        facetId,
      },
    ];
  }
  if (kind === "control") {
    const policy = evidence.find((item) => /must not provide steps that bypass/i.test(item.text));
    return [
      {
        kind: "interpretation",
        text: "I can't provide steps to bypass lockout/tagout or to command equipment.",
        evidenceIds: [],
        supportTokens: [],
      },
      policy
        ? fact(policy.text.split(/(?<=\.)\s+/).find((sentence) => /must not provide/i.test(sentence)) ?? policy.title, [hitFromEvidence(policy, "bypass")], facetId, ["bypass"])
        : gap("The lockout/tagout policy was not retrieved.", facetId),
    ];
  }
  const policy = evidence.find((item) => /must not change work orders/i.test(item.text));
  return [
    fact(
      "I can't change work orders, approve outages, or send commands to assets.",
      policy ? [hitFromEvidence(policy, "work orders")] : [],
      facetId,
      policy ? ["change work orders"] : [],
    ),
  ];
}

function leaderDepartments(classification: Classification, hits: FactHit[]): string[] {
  const direct = classification.entities.filter((id) => id.startsWith("dept:"));
  if (direct.length) return direct;
  const projectId = classification.entities.find((id) => id.startsWith("project:"));
  const owner = hits.find(
    (hit) => hit.status === "current" && hit.key.endsWith("|owned_by") && (!projectId || hit.key.startsWith(`${projectId}|`)),
  );
  const department = owner ? entityByName(owner.value) : undefined;
  return department ? [department.id] : [];
}

function projectLabel(classification: Classification): string | undefined {
  const id = classification.entities.find((item) => item.startsWith("project:"));
  return id ? entityName(id) : undefined;
}

function prefer(hits: FactHit[]): FactHit {
  return [...hits].sort((left, right) => right.evidence.score - left.evidence.score)[0];
}

function fact(text: string, hits: FactHit[], facetId: string | undefined, supportTokens: string[]): Sentence {
  return {
    kind: "fact",
    text,
    evidenceIds: unique(hits.map((hit) => hit.evidenceId).filter(Boolean)),
    supportTokens: supportTokens.filter(Boolean),
    facetId,
  };
}

function gap(text: string, facetId?: string): Sentence {
  return { kind: "gap", text, evidenceIds: [], supportTokens: [], facetId };
}

function hitFromEvidence(evidence: Evidence, value: string): FactHit {
  return {
    key: "evidence",
    value,
    status: evidence.status ?? "current",
    sentence: evidence.summary ?? evidence.text,
    evidenceId: evidence.id,
    evidence,
  };
}

function procedureToHit(evidence: Evidence): FactHit {
  return hitFromEvidence(evidence, evidence.title);
}

function supportFromRows(evidence: Evidence): string[] {
  const tokens: string[] = [];
  for (const row of evidence.rows ?? []) {
    for (const value of Object.values(row)) {
      if (value !== null && value !== undefined) tokens.push(String(value));
    }
  }
  const count = evidence.rows?.length;
  if (count !== undefined) tokens.push(String(count));
  return tokens;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function joinList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export function renderDraft(sentences: Sentence[], evidence: Evidence[]): Draft {
  const citations: Draft["citations"] = [];
  const numberFor = new Map<string, number>();
  const cite = (ids: string[]) =>
    unique(ids.filter(Boolean))
      .map((id) => {
        if (!numberFor.has(id)) {
          const item = evidence.find((candidate) => candidate.id === id);
          const n = citations.length + 1;
          numberFor.set(id, n);
          citations.push({
            n,
            evidenceId: id,
            title: item?.title ?? id,
            locator: item?.locator ?? "",
            excerpt: (item?.text ?? "").split("\n")[0]?.slice(0, 320) ?? "",
          });
        }
        return `[${numberFor.get(id)}]`;
      })
      .join("");

  const interpretation = sentences.filter((sentence) => sentence.kind === "interpretation");
  const body = sentences.filter((sentence) => sentence.kind === "fact" || sentence.kind === "correction");
  const gaps = sentences.filter((sentence) => sentence.kind === "gap");
  const recommendations = sentences.filter((sentence) => sentence.kind === "recommendation");
  const blocks: string[] = [];
  if (interpretation.length) blocks.push(interpretation.map((sentence) => sentence.text).join(" "));
  if (body.length) {
    blocks.push(body.map((sentence) => `${sentence.text}${sentence.evidenceIds.length ? ` ${cite(sentence.evidenceIds)}` : ""}`).join(" "));
  }
  if (gaps.length) blocks.push(["Gaps", ...gaps.map((sentence) => `- ${sentence.text}`)].join("\n"));
  if (recommendations.length) {
    blocks.push(
      ["Recommendations", ...recommendations.map((sentence) => `- ${sentence.text}${sentence.evidenceIds.length ? ` ${cite(sentence.evidenceIds)}` : ""}`)].join("\n"),
    );
  }
  return {
    sentences,
    answer: blocks.join("\n\n").trim(),
    citations,
    gaps: gaps.map((sentence) => sentence.text),
    recommendations: recommendations.map((sentence) => sentence.text),
  };
}
