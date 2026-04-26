import type { LearnedPattern } from "./types.js";

export function eligiblePatterns(patterns: LearnedPattern[], minSupport: number, minConfidence: number): LearnedPattern[] {
  return patterns
    .filter((pattern) => pattern.support >= minSupport && pattern.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence || b.support - a.support);
}

export function renderCandidates(skill: string, patterns: LearnedPattern[], minSupport = 2, minConfidence = 0.55): string {
  const eligible = eligiblePatterns(patterns, minSupport, minConfidence);
  const lines: string[] = [
    `# Last-mile improvement candidates for ${skill}`,
    "",
    "These are proposed improvements inferred from repeated human edits. Review before applying them to a skill or sharing them with a team.",
    "",
  ];

  if (eligible.length === 0) {
    lines.push("No candidates currently meet the support/confidence threshold.");
    return `${lines.join("\n")}\n`;
  }

  eligible.forEach((pattern, index) => {
    lines.push(`## ${index + 1}. ${pattern.summary}`);
    lines.push("");
    lines.push(`- ID: ${pattern.id}`);
    lines.push(`- Kind: ${pattern.kind}`);
    lines.push(`- Support: ${pattern.support}`);
    lines.push(`- Confidence: ${pattern.confidence}`);
    lines.push(`- Approved: ${pattern.approved ? "yes" : "no"}`);
    if (pattern.before) lines.push(`- Before: ${pattern.before}`);
    if (pattern.after) lines.push(`- After: ${pattern.after}`);
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
}

export function renderOverlay(skill: string, patterns: LearnedPattern[], scope: string, minSupport = 2, minConfidence = 0.55, approvedOnly = true): string {
  const eligible = eligiblePatterns(patterns, minSupport, minConfidence)
    .filter((pattern) => !approvedOnly || pattern.approved);
  const lines = [
    `# ${scope} overlay for ${skill}`,
    "",
    "Apply these preferences when this skill is used. These rules came from observed human edits and should remain subordinate to the user's explicit instructions.",
    "",
  ];

  for (const pattern of eligible) {
    lines.push(`- ${pattern.summary}`);
  }

  if (eligible.length === 0) {
    lines.push(approvedOnly
      ? "- No approved learned preferences have met the promotion threshold yet."
      : "- No learned preferences have met the promotion threshold yet.");
  }

  return `${lines.join("\n")}\n`;
}
