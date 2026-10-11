import { runSuite } from "@/lib/agent/suite";

export async function POST() {
  const results = runSuite().map((grade) => ({
    id: grade.id,
    pass: grade.pass,
    reasons: grade.reasons,
    questionType: grade.questionType,
    retries: grade.retries,
    sufficient: grade.sufficient,
    verified: grade.verified,
    tools: grade.tools,
    answer: grade.answer,
  }));
  return Response.json({
    passed: results.filter((result) => result.pass).length,
    total: results.length,
    results,
  });
}
