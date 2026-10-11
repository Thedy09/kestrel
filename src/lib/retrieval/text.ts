const STOPWORDS = new Set(
  `a an the of to and or for from in on at by with without into over after before about as is are was were be been being it this that those these then so if nor but do does did doing have has had having who whom whose what which when where why how there their its own same other another per via than`.split(
    /\s+/,
  ),
);

const SPECIAL_STEMS: Record<string, string> = {
  led: "lead",
  leads: "lead",
  leading: "lead",
  leader: "lead",
  leaders: "lead",
  owned: "own",
  owns: "own",
  owning: "own",
  owner: "own",
  ownership: "own",
  depends: "depend",
  depend: "depend",
  depending: "depend",
  dependent: "depend",
  dependency: "depend",
  dependencies: "depend",
  connected: "connect",
  connection: "connect",
  connections: "connect",
  supporting: "support",
  supports: "support",
  supported: "support",
};

export function tokenize(input: string): string[] {
  const raw = input.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
  const tokens: string[] = [];
  for (const token of raw) {
    const stemmed = stem(token);
    if (!stemmed || STOPWORDS.has(stemmed) || STOPWORDS.has(token)) continue;
    if (stemmed.length === 1) continue;
    tokens.push(stemmed);
  }
  return tokens;
}

export function stem(token: string): string {
  const special = SPECIAL_STEMS[token];
  if (special) return special;
  if (token.length <= 3 || /\d/.test(token) || token.includes("-")) return token;
  if (token.endsWith("ies") && token.length > 5) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing") && token.length > 6) return token.slice(0, -3);
  if (token.endsWith("ed") && token.length > 5) return token.slice(0, -2);
  if (token.endsWith("es") && token.length > 5) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function normalizeNumber(value: string): string {
  return value.replace(/[$,]/g, "").replace(/\.0+$/, "");
}

export function contentWords(input: string): string[] {
  return tokenize(input);
}

export function overlapRatio(left: string, right: string): number {
  const a = new Set(contentWords(left));
  const b = new Set(contentWords(right));
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const token of a) if (b.has(token)) hit += 1;
  return hit / a.size;
}
