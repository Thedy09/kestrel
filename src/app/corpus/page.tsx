import { CorpusBrowser } from "@/components/corpus-browser";
import { corpusSnapshot } from "@/lib/kb";

export default function CorpusPage() {
  const corpus = corpusSnapshot();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Knowledge base</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">What Kestrel is allowed to read</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Sixteen documents, a typed graph, and five tables. The superseded Atlas draft is in the corpus on purpose: the agent may retrieve it, and it must not treat it as the current record. Personal phone numbers are not stored.
      </p>
      <div className="mt-6">
        <CorpusBrowser
          documents={corpus.documents}
          edges={corpus.edges}
          tables={corpus.tables}
          entities={corpus.entities}
        />
      </div>
    </div>
  );
}
