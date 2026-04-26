import { readText } from "../core/files.js";
import { findSnapshot, readPatterns, writePatterns } from "./store.js";
import { extractCandidates, patternId } from "./extract.js";
import type { LearnResult, LearnedPattern, PatternExample } from "./types.js";
import { SkillflowError } from "../utils/errors.js";

function confidenceFor(support: number, examples: number): number {
  return Math.min(0.95, Number((0.25 + support * 0.14 + Math.min(examples, 5) * 0.06).toFixed(2)));
}

function mergeExample(existing: PatternExample[], next: PatternExample): PatternExample[] {
  if (existing.some((example) => example.snapshotId === next.snapshotId && example.finalPath === next.finalPath)) {
    return existing;
  }
  return [...existing, next].slice(-8);
}

export async function learnFromFinal(projectRoot: string, skill: string, finalPath: string, snapshotId?: string): Promise<LearnResult> {
  const snapshot = await findSnapshot(projectRoot, skill, snapshotId);
  if (!snapshot) {
    throw new SkillflowError(`No snapshot found for skill "${skill}". Run skillflow last-mile capture first.`);
  }

  const finalContent = await readText(finalPath);
  const candidates = extractCandidates(snapshot, finalContent);
  const existing = await readPatterns(projectRoot, skill);
  const byId = new Map(existing.map((pattern) => [pattern.id, pattern]));
  let newPatterns = 0;
  let reinforcedPatterns = 0;

  for (const candidate of candidates) {
    const id = patternId(skill, candidate);
    const now = new Date().toISOString();
    const example: PatternExample = {
      snapshotId: snapshot.id,
      finalPath,
      before: candidate.before,
      after: candidate.after,
    };

    const current = byId.get(id);
    if (current) {
      const examples = mergeExample(current.examples, example);
      current.support += 1;
      current.lastSeen = now;
      current.examples = examples;
      current.confidence = confidenceFor(current.support, examples.length);
      reinforcedPatterns += 1;
    } else {
      const pattern: LearnedPattern = {
        id,
        skill,
        kind: candidate.kind,
        summary: candidate.summary,
        before: candidate.before,
        after: candidate.after,
        support: 1,
        confidence: confidenceFor(1, 1),
        firstSeen: now,
        lastSeen: now,
        examples: [example],
        approved: false,
      };
      byId.set(id, pattern);
      newPatterns += 1;
    }
  }

  const patterns = [...byId.values()].sort((a, b) => b.confidence - a.confidence || b.support - a.support);
  await writePatterns(projectRoot, skill, patterns);
  return { snapshot, patterns, newPatterns, reinforcedPatterns };
}
