# Kestrel

Kestrel is an agentic RAG assistant for Helios Grid, a fictional wind, solar, and storage operator. It classifies a question, writes a retrieval plan, chooses tools, checks whether the evidence covers every part of the question, and retries up to three times before it answers. Every factual claim is cited. A verifier rejects numbers and names that are not in the cited passage.

It runs locally. There is no model API key. Vector search is TF-IDF, keyword search is BM25, the graph is an explicit set of edges, and SQL is a read-only `SELECT` compiler over five tables.

## What it will and will not do

Kestrel will read project briefs, the org chart, runbooks, incident reports, and aggregated metrics. It will calculate from numbers you type, and it will say when those numbers did not come from the tables.

It will not invent an owner or a date, close a work order, send a command to an asset, bypass lockout/tagout, or look up a personal phone number.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

```bash
npm test
```

The test runs the ten questions plus follow-up memory, a two-hop upstream question, a metadata listing, a budget query, the Atlas rewrite templates, a refusal, and a verifier case that must reject an unsupported 2024 launch date.

## Workflow

User question → classification → plan → tool selection → retrieval → evidence evaluation → retry or draft → citation verification → final response.

Question types: factual lookup, semantic, exact keyword, multi-hop, structured data, calculation, comparison.

Tools: `vector_search`, `keyword_search`, `graph_search`, `sql_query`, `metadata_search`, `calculator`, `hybrid_search`.

The architecture page in the app diagrams the loop, lists the ten questions, and describes the failures: lexical classification, TF-IDF paraphrases, unmodeled graph edges, the retry cap, intent-shaped SQL, superseded drafts, and a verifier that checks citations rather than nuance.

## Corpus

Helios Grid in this demo operates Ridgeline Wind, Sable Solar, and Northbreak Storage. Project Atlas is owned by Asset Reliability (Jonah Peck) and depends on SCADA-North, Historian-HX, and CMMS-Forge. A superseded 2024 draft claims otherwise. That conflict is intentional.

## Agent traces

`docs/traces/` has screenshots of the running console: the empty state, the Atlas multi-hop trace (one retry, then Jonah Peck), a follow-up that uses session memory, the ten-question suite, an empty-question error, the architecture page, the graph tab, and a phone-width factual answer.
