export interface Calculation {
  ok: boolean;
  expression: string;
  value?: number;
  userSupplied: boolean;
  currency: boolean;
  error?: string;
}

export function calculate(expression: string): Calculation {
  const normalized = expression.replace(/,/g, "").replace(/\s+/g, "");
  if (!normalized) {
    return { ok: false, expression, userSupplied: true, currency: false, error: "Empty expression." };
  }
  if (!/^[-+*/().\d]+$/.test(normalized)) {
    return {
      ok: false,
      expression,
      userSupplied: true,
      currency: false,
      error: "The calculator only accepts numbers and + - * / ( ).",
    };
  }
  try {
    const value = evaluate(normalized);
    if (!Number.isFinite(value)) {
      return { ok: false, expression: normalized, userSupplied: true, currency: false, error: "Result was not finite." };
    }
    return { ok: true, expression: normalized, value, userSupplied: true, currency: false };
  } catch (error) {
    return {
      ok: false,
      expression: normalized,
      userSupplied: true,
      currency: false,
      error: error instanceof Error ? error.message : "Could not calculate.",
    };
  }
}

export function extractExpression(question: string): Calculation | null {
  const currency = /\$|usd|revenue|strike price|\/mwh|per mwh/i.test(question);
  const priced = question.match(
    /(\d[\d,]*(?:\.\d+)?)\s*mwh\b[\s\S]{0,80}?\$\s*(\d[\d,]*(?:\.\d+)?)/i,
  );
  if (priced) {
    const result = calculate(`${priced[1]} * ${priced[2]}`);
    return { ...result, currency, userSupplied: true, expression: `${strip(priced[1])} * ${strip(priced[2])}` };
  }
  const percent = question.match(
    /(\d[\d,]*(?:\.\d+)?)\s*(?:%|percent)\s+of\s+\$?\s*(\d[\d,]*(?:\.\d+)?)/i,
  );
  if (percent) {
    const result = calculate(`(${percent[1]} / 100) * ${percent[2]}`);
    return {
      ...result,
      currency: currency || /\$/.test(question),
      userSupplied: true,
      expression: `(${strip(percent[1])} / 100) * ${strip(percent[2])}`,
    };
  }
  const inline = question.match(/((?:\d[\d,]*(?:\.\d+)?)\s*(?:[-+*/x×]\s*\d[\d,]*(?:\.\d+)?)+)/i);
  if (inline) {
    const expression = inline[1].replace(/[x×]/gi, "*");
    const result = calculate(expression);
    return { ...result, currency, userSupplied: true };
  }
  return null;
}

function strip(value: string): string {
  return value.replace(/,/g, "");
}

function evaluate(expression: string): number {
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+*/-]/g);
  if (!tokens || tokens.join("") !== expression) throw new Error("Could not tokenize the expression.");
  const output: string[] = [];
  const ops: string[] = [];
  const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  let previous: string | null = null;
  for (const token of tokens) {
    if (/^\d/.test(token)) {
      output.push(token);
      previous = "num";
      continue;
    }
    if (token === "(") {
      ops.push(token);
      previous = "(";
      continue;
    }
    if (token === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop() as string);
      if (ops.pop() !== "(") throw new Error("Mismatched parentheses.");
      previous = ")";
      continue;
    }
    let operator = token;
    if (token === "-" && (previous === null || previous === "op" || previous === "(")) {
      output.push("0");
      operator = "-";
    }
    while (
      ops.length &&
      ops[ops.length - 1] !== "(" &&
      precedence[ops[ops.length - 1]] >= precedence[operator]
    ) {
      output.push(ops.pop() as string);
    }
    ops.push(operator);
    previous = "op";
  }
  while (ops.length) {
    const op = ops.pop() as string;
    if (op === "(") throw new Error("Mismatched parentheses.");
    output.push(op);
  }
  const stack: number[] = [];
  for (const token of output) {
    if (/^\d/.test(token)) {
      stack.push(Number(token));
      continue;
    }
    const right = stack.pop();
    const left = stack.pop();
    if (left === undefined || right === undefined) throw new Error("Malformed expression.");
    if (token === "+") stack.push(left + right);
    else if (token === "-") stack.push(left - right);
    else if (token === "*") stack.push(left * right);
    else if (token === "/") {
      if (right === 0) throw new Error("Division by zero.");
      stack.push(left / right);
    }
  }
  if (stack.length !== 1) throw new Error("Malformed expression.");
  return stack[0];
}
