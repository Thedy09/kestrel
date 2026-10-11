import type { AgentResponse } from "@/lib/agent/types";
import { Badge } from "@/components/ui/badge";

export function AnswerPanel({ result }: { result: AgentResponse | null }) {
  if (!result) return null;
  const blocks = result.answer.split(/\n\n/).filter(Boolean);
  return (
    <article className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Badge>{result.state.classification?.questionType.replaceAll("_", " ")}</Badge>
        <Badge variant={result.state.evidence_sufficient ? "secondary" : "outline"}>
          {result.state.evidence_sufficient ? "Evidence sufficient" : "Evidence incomplete"}
        </Badge>
        <Badge variant="outline">
          {result.state.retry_count} retr{result.state.retry_count === 1 ? "y" : "ies"}
        </Badge>
        <Badge variant={result.state.verification?.approved ? "secondary" : "destructive"}>
          {result.state.verification?.approved ? "Verifier approved" : "Verifier flagged claims"}
        </Badge>
      </div>
      <div className="space-y-4">
        {blocks.map((block, index) => (
          <Block key={index} block={block} />
        ))}
      </div>
      {result.state.citations.length > 0 ? (
        <section>
          <h3 className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Citations</h3>
          <ol className="mt-2 space-y-2">
            {result.state.citations.map((citation) => (
              <li id={`cite-${citation.n}`} key={citation.evidenceId + citation.n} className="rounded-xl bg-muted/70 px-3 py-2 text-sm">
                <p className="font-medium">
                  [{citation.n}] {citation.title}
                </p>
                <p className="text-xs text-muted-foreground">{citation.locator}</p>
                <p className="mt-1 leading-relaxed text-foreground/80">{citation.excerpt}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {result.state.verification ? (
        <section className="rounded-xl border border-border px-3 py-3">
          <h3 className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Verifier</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {result.state.verification.checks.map((check) => (
              <li key={check.name}>
                <span className={check.passed ? "text-good" : "text-destructive"}>{check.passed ? "Pass" : "Fail"}</span>
                {" · "}
                {check.name}. {check.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function Block({ block }: { block: string }) {
  if (block.startsWith("Gaps\n") || block === "Gaps") {
    return (
      <section className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-3">
        <h3 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">Gaps</h3>
        <div className="mt-2 text-sm leading-relaxed">{renderInline(block.replace(/^Gaps\n?/, ""))}</div>
      </section>
    );
  }
  if (block.startsWith("Recommendations\n") || block === "Recommendations") {
    return (
      <section className="rounded-xl border border-primary/20 bg-accent/40 px-3 py-3">
        <h3 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">Recommendations</h3>
        <p className="mt-1 text-xs text-muted-foreground">Procedure text from the corpus, kept separate from the facts.</p>
        <div className="mt-2 text-sm leading-relaxed">{renderInline(block.replace(/^Recommendations\n?/, ""))}</div>
      </section>
    );
  }
  return <div className="font-serif text-[1.2rem] leading-relaxed text-foreground">{renderInline(block)}</div>;
}

function renderInline(text: string) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) {
      return <span key={index}>{part}</span>;
    }
    const n = match[1];
    return (
      <a
        key={index}
        href={`#cite-${n}`}
        className="mx-0.5 inline-flex min-w-5 items-center justify-center rounded-md bg-accent px-1 text-xs font-sans font-medium text-accent-foreground no-underline"
      >
        {n}
      </a>
    );
  });
}
