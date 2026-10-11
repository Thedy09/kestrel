import type { KbDocument } from "@/lib/kb/types";
import { tokenize } from "@/lib/retrieval/text";

export interface KeywordHit {
  document: KbDocument;
  score: number;
}

interface Bm25Doc {
  document: KbDocument;
  tf: Map<string, number>;
  length: number;
}

const K1 = 1.2;
const B = 0.75;

export class Bm25Index {
  private readonly docs: Bm25Doc[];
  private readonly idf: Map<string, number>;
  private readonly avgLength: number;

  constructor(documents: KbDocument[]) {
    this.docs = documents.map((document) => {
      const tokens = tokenize(`${document.title} ${document.text}`);
      const tf = new Map<string, number>();
      for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
      return { document, tf, length: tokens.length || 1 };
    });
    const df = new Map<string, number>();
    for (const doc of this.docs) {
      for (const token of doc.tf.keys()) df.set(token, (df.get(token) ?? 0) + 1);
    }
    const total = documents.length || 1;
    this.idf = new Map(
      [...df.entries()].map(([token, count]) => [
        token,
        Math.log((total - count + 0.5) / (count + 0.5) + 1),
      ]),
    );
    const lengths = this.docs.reduce((sum, doc) => sum + doc.length, 0);
    this.avgLength = lengths / (this.docs.length || 1);
  }

  search(query: string, k: number): KeywordHit[] {
    const tokens = [...new Set(tokenize(query))];
    if (tokens.length === 0 || k <= 0) return [];
    const hits: KeywordHit[] = [];
    for (const doc of this.docs) {
      let score = 0;
      for (const token of tokens) {
        const freq = doc.tf.get(token) ?? 0;
        if (!freq) continue;
        const idf = this.idf.get(token) ?? 0;
        const denom = freq + K1 * (1 - B + B * (doc.length / this.avgLength));
        score += idf * ((freq * (K1 + 1)) / denom);
      }
      if (doc.document.status === "superseded") score *= 0.45;
      if (score > 0) hits.push({ document: doc.document, score });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, k);
  }
}
