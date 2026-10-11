import type { Classification, Draft, Evidence, Sentence, Verification } from "@/lib/agent/types";
import { collectHits } from "@/lib/agent/evaluate";
import { renderDraft } from "@/lib/agent/generate";

const NEGATION = /\b(not|no|never|superseded|rejected|unapproved|incorrect|rather|instead|false)\b/i;

export function verify(draft: Draft, classification: Classification, evidence: Evidence[]): Verification {
  const checks: Verification["checks"] = [];
  const unsupported: string[] = [];
  const byId = new Map(evidence.map((item) => [item.id, item]));

  for (const sentence of draft.sentences) {
    if (sentence.kind === "gap" || sentence.kind === "interpretation") continue;
    if (sentence.evidenceIds.length === 0) {
      unsupported.push(sentence.text);
      continue;
    }
    const cited = sentence.evidenceIds.map((id) => byId.get(id)).filter((item): item is Evidence => Boolean(item));
    if (cited.length !== sentence.evidenceIds.length) {
      unsupported.push(sentence.text);
      continue;
    }
    if (sentence.kind === "fact" && cited.every((item) => item.status === "superseded")) {
      unsupported.push(sentence.text);
      continue;
    }
    const haystack = cited.map((item) => item.text).join("\n").toLowerCase().replace(/,/g, "");
    const missingToken = sentence.supportTokens.find((token) => !haystack.includes(token.toLowerCase().replace(/,/g, "")));
    if (missingToken) {
      unsupported.push(sentence.text);
      continue;
    }
    const numbers = sentence.text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
    const missingNumber = numbers.find((number) => {
      const normalized = number.replace(/,/g, "");
      if (normalized.length < 2) return false;
      return !haystack.includes(normalized);
    });
    if (missingNumber && sentence.kind !== "recommendation") unsupported.push(sentence.text);
  }

  checks.push({
    name: "Claims cite current evidence",
    passed: unsupported.length === 0,
    detail: unsupported.length ? `${unsupported.length} sentence(s) failed the citation check.` : "Every factual sentence is tied to retrieved text.",
  });

  const missingFacets = classification.facets.filter((_, index) => {
    const facetId = `f${index}`;
    return !draft.sentences.some((sentence) => sentence.facetId === facetId);
  });
  checks.push({
    name: "Every part of the question is addressed",
    passed: missingFacets.length === 0,
    detail: missingFacets.length ? `Unaddressed: ${missingFacets.join(" ")}` : "Each facet has a fact or an explicit gap.",
  });

  const hypothesisProblems: string[] = [];
  const hits = collectHits(evidence);
  for (const hypothesis of classification.hypotheses) {
    const current = [
      ...new Set(
        hits
          .filter((hit) => hit.status === "current" && hit.key.endsWith(`|${hypothesis.attribute}`))
          .map((hit) => hit.value),
      ),
    ];
    if (current.length === 0) continue;
    const agrees = current.some(
      (value) =>
        value.toLowerCase().includes(hypothesis.value.toLowerCase()) ||
        hypothesis.value.toLowerCase().includes(value.toLowerCase()),
    );
    if (agrees) continue;
    const hasCurrent = current.some((value) => draft.answer.toLowerCase().includes(value.toLowerCase()));
    if (!hasCurrent || !NEGATION.test(draft.answer)) {
      hypothesisProblems.push(`${hypothesis.attribute} ${hypothesis.value}`);
    }
  }
  checks.push({
    name: "Question assumptions match current sources",
    passed: hypothesisProblems.length === 0,
    detail: hypothesisProblems.length
      ? `These assumptions were not corrected: ${hypothesisProblems.join("; ")}.`
      : "Stated assumptions are either supported or explicitly corrected.",
  });

  if (classification.boundary === "personal_data") {
    const leaked = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(draft.answer);
    checks.push({
      name: "No personal contact number invented",
      passed: !leaked,
      detail: leaked ? "The answer contains a phone-like number." : "No phone number was invented.",
    });
  }

  const failed = checks.filter((check) => !check.passed);
  const approved = failed.length === 0;
  return {
    approved,
    unsupportedClaims: [...new Set(unsupported)],
    requiredRevision: approved
      ? ""
      : failed.map((check) => check.detail).join(" "),
    checks,
  };
}

export function revise(draft: Draft, verification: Verification, classification: Classification, evidence: Evidence[]): Draft {
  const bad = new Set(verification.unsupportedClaims);
  const sentences: Sentence[] = draft.sentences.filter((sentence) => !bad.has(sentence.text));
  const covered = new Set(sentences.map((sentence) => sentence.facetId).filter(Boolean));
  classification.facets.forEach((facet, index) => {
    const facetId = `f${index}`;
    if (!covered.has(facetId)) {
      sentences.push({
        kind: "gap",
        text: `Not established from the retrieved evidence: ${facet}`,
        evidenceIds: [],
        supportTokens: [],
        facetId,
      });
    }
  });
  if (verification.requiredRevision && sentences.every((sentence) => sentence.kind !== "fact")) {
    sentences.push({
      kind: "gap",
      text: "The draft included a claim the retrieved evidence did not support, so it was removed.",
      evidenceIds: [],
      supportTokens: [],
    });
  }
  return renderDraft(sentences, evidence);
}
