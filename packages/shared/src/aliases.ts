const ADJECTIVES = [
  "Bright",
  "Calm",
  "Clever",
  "Kind",
  "Lively",
  "Nimble",
  "Sharp",
  "Steady",
  "Sunny",
  "Swift"
];

const NOUNS = [
  "Anchor",
  "Beacon",
  "Comet",
  "Harbor",
  "Lantern",
  "Orbit",
  "Pixel",
  "Signal",
  "Spark",
  "Wave"
];

const COLORS = [
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#ec4899"
];

export interface AliasProfile {
  alias: string;
  color: string;
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)] as T;
}

export function generateAlias(): AliasProfile {
  const number = Math.floor(100 + Math.random() * 900);

  return {
    alias: `${pick(ADJECTIVES)} ${pick(NOUNS)} ${number}`,
    color: pick(COLORS)
  };
}
