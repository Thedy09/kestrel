const STAGES = [
  ["User question", "The question, plus short-term memory of the topic and entities."],
  ["Question classification", "Type, facets, entities, boundary, and any stated assumptions."],
  ["Planning", "An ordered list of steps. Simple lookups stay short."],
  ["Tool selection", "A fixed map from question type to tools, plus filter extras."],
  ["Retrieval", "The first selected tool runs. Others wait."],
  ["Evidence evaluation", "Coverage, contradictions, and what is still missing."],
  ["Retry or generate", "Rewrite, switch tools, or deepen the graph. Stop at 3."],
  ["Citation verification", "Every claim has to sit on a retrieved passage."],
  ["Final response", "Facts, gaps, procedure notes, and numbered citations."],
];

export function ArchitectureDiagram() {
  return (
    <ol className="relative space-y-0">
      {STAGES.map(([title, detail], index) => (
        <li key={title} className="grid grid-cols-[auto_1fr] gap-4">
          <div className="flex flex-col items-center">
            <span className="grid size-8 place-items-center rounded-full bg-primary font-serif text-sm text-primary-foreground">
              {index + 1}
            </span>
            {index < STAGES.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
          </div>
          <div className={`pb-5 ${index === STAGES.length - 1 ? "" : ""}`}>
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
