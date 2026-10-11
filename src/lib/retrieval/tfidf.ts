import type { KbDocument } from "@/lib/kb/types";
import { tokenize } from "@/lib/retrieval/text";

export interface VectorHit {
  document: KbDocument;
  score: number;
}

interface VectorDoc {
  document: KbDocument;
  weights: Map<string, number>;
  norm: number;
}

export class TfidfIndex {
  private readonly docs: VectorDoc[];
  private readonly idf: Map<string, number>;

  constructor(documents: KbDocument[]) {
    const tokenized = documents.map((document) => ({
      document,
      tokens: tokenize(`${document.title} ${document.text}`),
    }));
    const df = new Map<string, number>();
    for (const item of tokenized) {
      for (const token of new Set(item.tokens)) {
        df.set(token, (df.get(token) ?? 0) + 1);
      }
    }
    const total = documents.length || 1;
    this.idf = new Map(
      [...df.entries()].map(([token, count]) => [
        token,
        Math.log((total + 1) / (count + 1)) + 1,
      ]),
    );
    this.docs = tokenized.map((item) => {
      const tf = new Map<string, number>();
      for (const token of item.tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
      const weights = new Map<string, number>();
      let norm = 0;
      for (const [token, count] of tf) {
        const weight = (count / item.tokens.length) * (this.idf.get(token) ?? 0);
        weights.set(token, weight);
        norm += weight * weight;
      }
      return { document: item.document, weights, norm: Math.sqrt(norm) };
    });
  }

  search(query: string, k: number): VectorHit[] {
    const tokens = tokenize(query);
    if (tokens.length === 0 || k <= 0) return [];
    const tf = new Map<string, number>();
    for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
    const weights = new Map<string, number>();
    let norm = 0;
    for (const [token, count] of tf) {
      const weight = (count / tokens.length) * (this.idf.get(token) ?? 0);
      if (weight === 0) continue;
      weights.set(token, weight);
      norm += weight * weight;
    }
    const queryNorm = Math.sqrt(norm);
    if (queryNorm === 0) return [];
    const hits: VectorHit[] = [];
    for (const doc of this.docs) {
      if (doc.norm === 0) continue;
      let dot = 0;
      for (const [token, weight] of weights) {
        dot += weight * (doc.weights.get(token) ?? 0);
      }
      const score = dot / (queryNorm * doc.norm);
      if (score > 0) hits.push({ document: doc.document, score });
    }
    hits.sort((a, b) => b.score - a.score || statusRank(b.document) - statusRank(a.document));
    return hits.slice(0, k);
  }
}

function statusRank(document: KbDocument): number {
  return document.status === "current" ? 1 : 0;
}
