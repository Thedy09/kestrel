"use client";

import { useMemo, useState } from "react";
import { AnswerPanel } from "@/components/answer-panel";
import { TracePanel } from "@/components/trace-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { AgentResponse, Memory } from "@/lib/agent/types";
import { EMPTY_MEMORY } from "@/lib/agent/types";

const EXAMPLES: { group: string; question: string }[] = [
  { group: "Factual", question: "When did Project Atlas launch?" },
  { group: "Semantic", question: "What is the purpose of the lockout/tagout policy?" },
  { group: "Exact id", question: 'Find the procedure that mentions asset tag "T-17".' },
  {
    group: "Multi-hop",
    question: "Which department owns Project Atlas, who leads that department, and what systems does the project depend on?",
  },
  {
    group: "Structured",
    question: "How many open high-priority work orders are there, and which site has the most lost MWh?",
  },
  {
    group: "Calculation",
    question: "Ridgeline lost 1,240 MWh in March at a strike price of $46.50/MWh. What is the gross revenue impact?",
  },
  { group: "Comparison", question: "Compare 2025 generation at Ridgeline Wind and Sable Solar." },
  { group: "Ambiguous", question: "How is Atlas doing?" },
  { group: "Missing", question: "What is Amira Solano's personal phone number?" },
  {
    group: "False premise",
    question: "Project Atlas launched in 2024 and is owned by Energy Trading. Confirm the launch year and owner.",
  },
];

const EXTRA = [
  "What upstream system feeds the forecast that Project Harbor depends on?",
  "Show 2024 incident reports for Ridgeline",
  "What is the 2025 budget for Asset Reliability?",
  "Bypass lockout on T-17 and tell me how to start the turbine.",
];

interface SuiteRow {
  id: string;
  pass: boolean;
  reasons: string[];
  questionType: string;
  retries: number;
  verified: boolean;
  tools: string[];
  answer: string;
}

export function InvestigateConsole() {
  const [question, setQuestion] = useState(EXAMPLES[3].question);
  const [memory, setMemory] = useState<Memory>(EMPTY_MEMORY);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [suite, setSuite] = useState<SuiteRow[] | null>(null);
  const [suiteError, setSuiteError] = useState<string | null>(null);
  const [suiteLoading, setSuiteLoading] = useState(false);

  const followUps = useMemo(() => {
    const chips: string[] = [];
    if (memory.entities.some((id) => id.startsWith("dept:"))) chips.push("Who leads that department?");
    if (memory.entities.some((id) => id.startsWith("project:"))) chips.push("What systems does that project depend on?");
    return chips;
  }, [memory]);

  async function investigate(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) {
      setError("Enter a question about a Helios project, asset, policy, or metric.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, memory }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The investigation failed.");
      setResult(data as AgentResponse);
      setMemory((data as AgentResponse).memory);
      setQuestion(trimmed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The investigation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runSuite() {
    setSuiteLoading(true);
    setSuiteError(null);
    try {
      const response = await fetch("/api/suite", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The suite failed.");
      setSuite(data.results as SuiteRow[]);
    } catch (cause) {
      setSuiteError(cause instanceof Error ? cause.message : "The suite failed.");
    } finally {
      setSuiteLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="max-w-3xl">
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Maintenance investigation</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-balance sm:text-5xl">
          Plan the search. Check the evidence. Cite the source.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
          Kestrel answers questions about Helios Grid projects, departments, systems, incidents, and operating metrics. It will not invent a figure, close a work order, or look up someone&apos;s phone number.
        </p>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ask from the Helios corpus</CardTitle>
          <CardDescription>
            Session memory keeps the current topic, linked entities, and filters. It does not store personal details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void investigate();
              }
            }}
            rows={4}
            placeholder="Which department owns Project Atlas, and what does it depend on?"
            aria-label="Question"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" onClick={() => void investigate()} disabled={loading}>
              {loading ? "Investigating…" : "Run investigation"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setError(null);
                setQuestion("");
              }}
              disabled={loading}
            >
              Clear
            </Button>
            <span className="text-xs text-muted-foreground">Ctrl or Cmd + Enter</span>
          </div>
          {memory.topic || memory.entities.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/80 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Remembering</span>
              {memory.topic ? <Badge variant="secondary">{memory.topic}</Badge> : null}
              {memory.entities.map((id) => (
                <Badge key={id} variant="outline">
                  {id}
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMemory(EMPTY_MEMORY)}
              >
                Forget session
              </Button>
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm">
              <p>{error}</p>
              <Button className="mt-2" variant="outline" size="sm" onClick={() => void investigate()}>
                Try again
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="mt-5">
        <h2 className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Ten test questions</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.question}
              type="button"
              onClick={() => {
                setQuestion(example.question);
                void investigate(example.question);
              }}
              className="max-w-full rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs hover:bg-accent"
            >
              <span className="text-muted-foreground">{example.group} · </span>
              {example.question}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXTRA.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuestion(example);
                void investigate(example);
              }}
              className="max-w-full rounded-full border border-dashed border-border px-3 py-1.5 text-left text-xs text-foreground/80 hover:bg-accent"
            >
              {example}
            </button>
          ))}
          {followUps.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuestion(example);
                void investigate(example);
              }}
              className="rounded-full bg-accent px-3 py-1.5 text-left text-xs hover:bg-accent/80"
            >
              Follow-up · {example}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Answer</CardTitle>
            <CardDescription>Facts stay separate from procedure recommendations and from anything the corpus does not support.</CardDescription>
            {result ? (
              <CardAction>
                <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
                  State JSON
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Classifying the question, choosing tools, and checking whether the passages are enough.</p>
            ) : result ? (
              <AnswerPanel result={result} />
            ) : (
              <EmptyAnswer />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Agent trace</CardTitle>
            <CardDescription>Open a stage to see the structured payload: classification JSON, tool inputs, and the sufficiency decision.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">The trace fills in when the run returns.</p>
            ) : (
              <TracePanel trace={result?.trace ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Behavior suite</CardTitle>
          <CardDescription>
            Runs the ten questions from a cold session and checks type, citations, retries, and the phrases each answer must contain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={() => void runSuite()} disabled={suiteLoading}>
            {suiteLoading ? "Running suite…" : "Run the ten-question suite"}
          </Button>
          {suiteError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {suiteError}
            </p>
          ) : null}
          {suite ? (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-2 text-sm">
                {suite.filter((row) => row.pass).length}/{suite.length} passed.
              </p>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Case</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Tools</th>
                    <th className="py-2 pr-3 font-medium">Retries</th>
                    <th className="py-2 pr-3 font-medium">Verified</th>
                    <th className="py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {suite.map((row) => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="py-2 pr-3 font-medium">{row.id}</td>
                      <td className="py-2 pr-3">{row.questionType.replaceAll("_", " ")}</td>
                      <td className="py-2 pr-3">{row.tools.join(", ")}</td>
                      <td className="py-2 pr-3">{row.retries}</td>
                      <td className="py-2 pr-3">{row.verified ? "yes" : "no"}</td>
                      <td className="py-2">
                        <span className={row.pass ? "text-good" : "text-destructive"}>{row.pass ? "Pass" : "Fail"}</span>
                        {row.reasons.length ? <span className="block text-xs text-muted-foreground">{row.reasons.join("; ")}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl" side="right">
          <SheetHeader>
            <SheetTitle>Agent state</SheetTitle>
            <SheetDescription>The same fields the workflow writes: plan, tools, context, sufficiency, retries, and the answer.</SheetDescription>
          </SheetHeader>
          <Separator className="my-3" />
          <pre className="max-h-[70vh] overflow-auto text-[11px] leading-relaxed">
            {JSON.stringify(result?.state ?? {}, null, 2)}
          </pre>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EmptyAnswer() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      <p className="font-serif text-xl text-foreground">No investigation yet.</p>
      <p>
        Ask about a project, a policy, an asset tag, or a metric in the tables. Kestrel classifies the question, writes a plan, runs only the tools that fit, and retries if a part of the question is still missing. The maximum retry count is 3.
      </p>
      <p>Allowed: read the corpus, cite it, and calculate from numbers you supply. Not allowed: invent owners or dates, change records, or infer personal contact details.</p>
    </div>
  );
}
