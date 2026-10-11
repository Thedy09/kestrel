import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SUITE } from "@/lib/agent/suite";

const TOOLS = [
  {
    name: "vector_search",
    kind: "Retrieval",
    detail: "TF-IDF cosine similarity over the document corpus. Current records outrank superseded drafts. This is a lexical vector, not a hosted embedding model.",
  },
  {
    name: "keyword_search",
    kind: "Retrieval",
    detail: "BM25. Used for asset tags, SOP ids, and policy phrases such as T-17 or POL-SAFE-003.",
  },
  {
    name: "graph_search",
    kind: "Retrieval",
    detail: "Breadth-first walk of OWNS, LEADS, DEPENDS_ON, FEEDS, and RELATED_TO edges. Depth starts at 1 and grows on retry.",
  },
  {
    name: "sql_query",
    kind: "Retrieval",
    detail: "Compiles a read-only SELECT for work orders, lost MWh, generation, and budgets. INSERT, UPDATE, DELETE, and UNION are refused.",
  },
  {
    name: "metadata_search",
    kind: "Retrieval",
    detail: "Filters by document type, year, site, and department. Listing questions such as “2024 incident reports for Ridgeline” start here.",
  },
  {
    name: "calculator",
    kind: "Tool",
    detail: "A small arithmetic parser. It does not call eval. User-supplied prices stay labeled as user-supplied.",
  },
  {
    name: "hybrid_search",
    kind: "Retrieval",
    detail: "Reciprocal-rank fusion of the vector and keyword lists. Used when a retry needs a wider net.",
  },
  {
    name: "verifier",
    kind: "Check",
    detail: "Not a retriever. It rejects uncited facts, numbers missing from the cited passage, unanswered facets, and assumptions repeated as if they were current.",
  },
];

export default function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Use case</p>
      <h1 className="mt-2 max-w-3xl font-serif text-4xl tracking-tight text-balance sm:text-5xl">
        Kestrel investigates Helios Grid. It does not operate it.
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-foreground/80">
        Helios Grid runs Ridgeline Wind, Sable Solar, and Northbreak Storage. Kestrel is the maintenance investigation assistant for that corpus: project ownership, department leads, system dependencies, procedures, incidents, and aggregated metrics. The decisions are explicit policies over real retrievers, so the trace shows why a tool ran.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Allowed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            <p>Read project briefs, the org chart, runbooks, incident reports, and the operational tables.</p>
            <p>Cite the passage or row behind each factual claim.</p>
            <p>Calculate from numbers the user supplies, and say that those numbers are not from the tables.</p>
            <p>Say when a part of the question is missing, contradicted, or only present in a superseded draft.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Not allowed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            <p>Invent an owner, a launch year, a phone number, or a health score.</p>
            <p>Close work orders, approve outages, or send a command to an asset.</p>
            <p>Provide steps that bypass lockout/tagout.</p>
            <p>Store personal contact details, compensation, or an unrelated question in session memory.</p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <h2 className="font-serif text-3xl tracking-tight">Workflow</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The same nine stages run on every question. A simple lookup still passes through them; the plan is just shorter.
          </p>
          <div className="mt-5">
            <ArchitectureDiagram />
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="font-serif text-3xl tracking-tight">Agent state</h2>
          <pre className="overflow-auto rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed">{`question: string
plan: string[]
selected_tools: string[]
retrieved_context: Evidence[]
evidence_sufficient: boolean
retry_count: number
answer: string

classification: {
  questionType, facets, entities,
  boundary, hypotheses, filters
}
evaluation: {
  sufficient, missingInformation,
  contradictions, recommendedAction
}
verification: {
  approved, unsupportedClaims,
  requiredRevision
}`}</pre>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Memory kept between turns is only the topic, entity ids, document filters, and the last question. A request for a personal phone number increments the turn counter and stores nothing else.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-3xl tracking-tight">Tools</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <Card key={tool.name} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm">{tool.name}</span>
                  <Badge variant="outline">{tool.kind}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-foreground/80">{tool.detail}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-3xl tracking-tight">How a tool gets chosen</h2>
          <pre className="mt-4 overflow-auto rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed">{`factual_lookup  → vector_search
semantic         → vector_search, keyword_search
exact_lookup     → keyword_search
multi_hop        → graph_search, vector_search
structured_data  → sql_query
calculation      → calculator
comparison       → sql_query, calculator`}</pre>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Only the first tool runs on the opening pass. If the evaluator marks a facet missing, the retry may raise graph depth, add the unused tool, widen k, or switch to metadata or SQL. <span className="text-foreground">MAX_RETRIES = 3.</span>
          </p>
        </div>
        <div>
          <h2 className="font-serif text-3xl tracking-tight">Query rewriting</h2>
          <p className="mt-4 text-sm leading-relaxed">
            “What systems support Atlas?” is rewritten, when evidence is thin, into the dependency phrasings the corpus actually uses:
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Project Atlas dependencies</li>
            <li>Project Atlas connected technologies</li>
            <li>Systems used by Project Atlas</li>
            <li>Infrastructure supporting Project Atlas</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The Atlas ownership question needs a retry for a different reason: the department leader is two hops from the project, and the first graph pass stops at one.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-3xl tracking-tight">Ten test questions</h2>
        <ol className="mt-4 space-y-3">
          {SUITE.map((test, index) => (
            <li key={test.id} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
                {index + 1}. {test.group}
              </p>
              <p className="mt-1 text-sm">{test.question}</p>
              <p className="mt-1 text-xs text-muted-foreground">{test.note}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-serif text-3xl tracking-tight">Where this agent fails</h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-foreground/85">
          <p>
            <span className="font-medium text-foreground">The classifier is lexical.</span> “Atlas, the money side, who is on the hook?” does not say “budget” or “owns,” so it falls through to a weak vector search instead of SQL or the graph. A planner model would recover some of these; this one will not guess.
          </p>
          <p>
            <span className="font-medium text-foreground">TF-IDF is not a semantic embedding.</span> A paraphrase that shares no stems with the brief (“which stack keeps Atlas alive”) misses until a rewrite adds “dependencies.” The retry helps only when the missing-information text or the entity name produces those stems.
          </p>
          <p>
            <span className="font-medium text-foreground">The graph only knows modeled edges.</span> A relationship that exists only as prose, and was never given an OWNS or DEPENDS_ON edge, is invisible to graph search. Vector search can still find the sentence, which is why multi-hop runs vector on the retry.
          </p>
          <p>
            <span className="font-medium text-foreground">Hop depth is capped by the retry budget.</span> The walk starts at 1 hop and adds one hop per graph retry. A four-hop path can still be reached. Anything longer stops with an explicit gap.
          </p>
          <p>
            <span className="font-medium text-foreground">SQL is an intent compiler, not text-to-SQL.</span> “How many open high-priority work orders” maps to a known SELECT. “Headcount of pending P1 jobs” does not, and the tool returns no rows rather than inventing a query. Unrecognized metrics stay missing.
          </p>
          <p>
            <span className="font-medium text-foreground">Superseded drafts can outrank a short current note</span> before the current-document penalty. If only the draft is retrieved, the generator will not promote its date or owner to a fact. The launch year then shows up as a gap instead of as 2024. That is the safer failure.
          </p>
          <p>
            <span className="font-medium text-foreground">The verifier checks citations, numbers, facets, and stated assumptions.</span> It will not catch a misleading paraphrase that still contains the right names and figures. It also cannot tell that a recommendation, while quoted accurately, is the wrong procedure for the job.
          </p>
          <p>
            <span className="font-medium text-foreground">Memory resolves “that department” and “that project” only.</span> “Do that again for the other site” is left unresolved. The agent does not guess which site “other” means.
          </p>
        </div>
        <h3 className="mt-8 font-serif text-2xl">What would make it better</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/85">
          <li>Replace TF-IDF with a local embedding model, and keep the same evaluator in front of it.</li>
          <li>Let a model write the plan and the prose, but keep this verifier and the read-only SQL gate as the part that can reject the draft.</li>
          <li>Constrain text-to-SQL to the published schema instead of the handful of intent patterns.</li>
          <li>Ask a clarifying question when the ambiguous flag is set and two interpretations are both plausible, instead of always choosing status plus the latest incident.</li>
        </ul>
      </section>
    </div>
  );
}
