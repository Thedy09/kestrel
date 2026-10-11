import { runAgent } from "../src/lib/agent/run";
import { EMPTY_MEMORY } from "../src/lib/agent/types";
import { SUITE } from "../src/lib/agent/suite";

for (const test of SUITE) {
  const result = runAgent(test.question, EMPTY_MEMORY);
  console.log(`\n==== ${test.id} retries=${result.state.retry_count}`);
  console.log(result.answer);
  console.log("--- trace stages:", result.trace.map((event) => event.stage).join(" > "));
}
