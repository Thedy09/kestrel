"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DocumentRow {
  id: string;
  title: string;
  documentType: string;
  year: number;
  site: string | null;
  department: string | null;
  status: string;
  text: string;
}

interface EdgeRow {
  id: string;
  from: string;
  rel: string;
  to: string;
  source: string;
  status: string;
  sentence: string;
}

interface EntityRow {
  id: string;
  type: string;
  name: string;
  role: string | null;
}

export function CorpusBrowser({
  documents,
  edges,
  tables,
  entities,
}: {
  documents: DocumentRow[];
  edges: EdgeRow[];
  tables: Record<string, Record<string, string | number | null>[]>;
  entities: EntityRow[];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const docs = useMemo(
    () =>
      documents.filter((document) =>
        !needle
          ? true
          : `${document.title} ${document.text} ${document.id} ${document.site ?? ""}`.toLowerCase().includes(needle),
      ),
    [documents, needle],
  );
  const graph = useMemo(
    () =>
      edges.filter((edge) =>
        !needle ? true : `${edge.from} ${edge.rel} ${edge.to} ${edge.sentence}`.toLowerCase().includes(needle),
      ),
    [edges, needle],
  );

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by title, entity, site, or phrase"
        aria-label="Filter the corpus"
      />
      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents ({docs.length})</TabsTrigger>
          <TabsTrigger value="graph">Graph ({graph.length})</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="entities">Entities ({entities.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="documents" className="mt-4 space-y-3">
          {docs.length === 0 ? <p className="text-sm text-muted-foreground">No document matches that filter.</p> : null}
          {docs.map((document) => (
            <article key={document.id} className="rounded-2xl border border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{document.title}</h2>
                <Badge variant="outline">{document.documentType.replaceAll("_", " ")}</Badge>
                <Badge variant={document.status === "current" ? "secondary" : "destructive"}>{document.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {document.id} · {document.year}
                  {document.site ? ` · ${document.site}` : ""}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">{document.text}</p>
            </article>
          ))}
        </TabsContent>
        <TabsContent value="graph" className="mt-4 space-y-2">
          {graph.length === 0 ? <p className="text-sm text-muted-foreground">No edge matches that filter.</p> : null}
          {graph.map((edge) => (
            <p key={edge.id} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <span className="font-medium">{edge.from}</span>
              <span className="mx-2 text-xs tracking-wide text-muted-foreground uppercase">{edge.rel}</span>
              <span className="font-medium">{edge.to}</span>
              <span className="mt-1 block text-foreground/75">{edge.sentence}</span>
              <span className="text-xs text-muted-foreground">
                {edge.source} · {edge.status}
              </span>
            </p>
          ))}
        </TabsContent>
        <TabsContent value="tables" className="mt-4 space-y-6">
          {Object.entries(tables).map(([name, rows]) => (
            <div key={name} className="overflow-x-auto">
              <h2 className="mb-2 font-mono text-sm">{name}</h2>
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    {Object.keys(rows[0] ?? {}).map((column) => (
                      <th key={column} className="py-1 pr-3 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="border-t border-border">
                      {Object.values(row).map((value, cell) => (
                        <td key={cell} className="py-1 pr-3">
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="entities" className="mt-4 grid gap-2 sm:grid-cols-2">
          {entities
            .filter((entity) => !needle || `${entity.name} ${entity.type} ${entity.id}`.toLowerCase().includes(needle))
            .map((entity) => (
              <p key={entity.id} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
                <span className="font-medium">{entity.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {entity.type}
                  {entity.role ? ` · ${entity.role}` : ""} · {entity.id}
                </span>
              </p>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
