import type { TraceEvent } from "@/lib/agent/types";
import { Badge } from "@/components/ui/badge";

const STAGE_LABEL: Record<TraceEvent["stage"], string> = {
  classify: "Classify",
  plan: "Plan",
  select_tools: "Tools",
  retrieve: "Retrieve",
  evaluate: "Evaluate",
  retry: "Retry",
  rewrite: "Rewrite",
  generate: "Draft",
  verify: "Verify",
  revise: "Revise",
  respond: "Respond",
  boundary: "Boundary",
};

export function TracePanel({ trace }: { trace: TraceEvent[] }) {
  if (trace.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/70 p-5 text-sm text-muted-foreground">
        <p className="font-serif text-lg text-foreground">The trace appears here.</p>
        <p className="mt-2 leading-relaxed">
          Each run shows the classification, the plan, the tools that actually fired, what they returned, whether the evidence was enough, and the verifier&apos;s decision.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {trace.map((event, index) => (
        <li key={`${event.stage}-${index}`} className="relative pl-8">
          <span className="absolute top-3 left-0 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {index + 1}
          </span>
          {index < trace.length - 1 ? (
            <span className="absolute top-8 bottom-[-12px] left-[9px] w-px bg-border" />
          ) : null}
          <details className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm" open={index < 4 || event.stage === "evaluate" || event.stage === "verify" || event.stage === "retry"}>
            <summary className="cursor-pointer list-none">
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{STAGE_LABEL[event.stage]}</Badge>
                <span className="text-sm font-medium">{event.title}</span>
              </span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{event.detail}</p>
            {event.payload !== undefined ? (
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted/80 p-3 text-[11px] leading-relaxed text-foreground/80">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            ) : null}
          </details>
        </li>
      ))}
    </ol>
  );
}
