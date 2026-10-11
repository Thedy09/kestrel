import { runAgent } from "@/lib/agent/run";
import { sanitizeMemory } from "@/lib/agent/memory";
import type { Memory } from "@/lib/agent/types";

export async function POST(request: Request) {
  let body: { question?: unknown; memory?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON body with a question." }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "Enter a question about Helios Grid operations." }, { status: 400 });
  }
  if (question.length > 2000) {
    return Response.json({ error: "Keep the question under 2,000 characters." }, { status: 400 });
  }
  const memory: Memory = sanitizeMemory(body.memory);
  const result = runAgent(question, memory);
  return Response.json(result);
}
