export const PROJECT_COLOR_PALETTE = [
  "#9900CC",
  "#3B82F6",
  "#22C55E",
  "#F97316",
  "#EF4444",
  "#06B6D4",
  "#EC4899",
  "#EAB308",
];

export const MEMBER_COLOR_PALETTE = [
  "#FF6B6B",
  "#FFA94D",
  "#FFD43B",
  "#69DB7C",
  "#38D9A9",
  "#3BC9DB",
  "#4DABF7",
  "#748FFC",
  "#9775FA",
  "#DA77F2",
  "#F783AC",
  "#A9E34B",
];

export function assignMemberColor(usedColors: string[]): string {
  const available = MEMBER_COLOR_PALETTE.filter((c) => !usedColors.includes(c));
  const pool = available.length > 0 ? available : MEMBER_COLOR_PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}
