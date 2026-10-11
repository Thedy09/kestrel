import { runExtraChecks, runSuite } from "../src/lib/agent/suite";

const grades = runSuite();
let failed = 0;
for (const grade of grades) {
  const mark = grade.pass ? "PASS" : "FAIL";
  console.log(`\n[${mark}] ${grade.id} · ${grade.questionType} · retries ${grade.retries} · verified ${grade.verified}`);
  if (!grade.pass) {
    failed += 1;
    console.log(grade.reasons.join("\n"));
    console.log(grade.answer);
  }
}
const extras = runExtraChecks();
if (extras.length) {
  failed += extras.length;
  console.log("\nExtra checks:");
  for (const problem of extras) console.log(`- ${problem}`);
}
console.log(`\n${grades.filter((grade) => grade.pass).length}/${grades.length} suite cases passed.`);
if (failed > 0) process.exit(1);
