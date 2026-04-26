import path from "node:path";
import { readJson, writeJson, writeText, pathExists, readText, ensureDir } from "../core/files.js";
import { shortHash } from "../core/hash.js";
import type { LearnedPattern, Snapshot } from "./types.js";

export function feedbackRoot(projectRoot: string): string {
  return path.join(projectRoot, ".skillflow", "feedback");
}

export function skillFeedbackRoot(projectRoot: string, skill: string): string {
  return path.join(feedbackRoot(projectRoot), skill);
}

export function snapshotsPath(projectRoot: string, skill: string): string {
  return path.join(skillFeedbackRoot(projectRoot, skill), "snapshots.json");
}

export function patternsPath(projectRoot: string, skill: string): string {
  return path.join(skillFeedbackRoot(projectRoot, skill), "patterns.json");
}

export async function readSnapshots(projectRoot: string, skill: string): Promise<Snapshot[]> {
  return readJson<Snapshot[]>(snapshotsPath(projectRoot, skill), []);
}

export async function writeSnapshots(projectRoot: string, skill: string, snapshots: Snapshot[]): Promise<void> {
  await writeJson(snapshotsPath(projectRoot, skill), snapshots);
}

export async function latestSnapshot(projectRoot: string, skill: string): Promise<Snapshot | undefined> {
  const snapshots = await readSnapshots(projectRoot, skill);
  return snapshots.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
}

export async function findSnapshot(projectRoot: string, skill: string, id?: string): Promise<Snapshot | undefined> {
  if (!id || id === "latest") return latestSnapshot(projectRoot, skill);
  return (await readSnapshots(projectRoot, skill)).find((snapshot) => snapshot.id === id);
}

export async function captureDraft(projectRoot: string, skill: string, sourcePath: string, label?: string): Promise<Snapshot> {
  const content = await readText(sourcePath);
  const snapshots = await readSnapshots(projectRoot, skill);
  const now = new Date().toISOString();
  const snapshot: Snapshot = {
    id: shortHash(`${skill}:${sourcePath}:${now}:${content}`),
    skill,
    label,
    sourcePath,
    capturedAt: now,
    contentHash: shortHash(content),
    content,
  };
  snapshots.push(snapshot);
  await writeSnapshots(projectRoot, skill, snapshots);
  return snapshot;
}

export async function readPatterns(projectRoot: string, skill: string): Promise<LearnedPattern[]> {
  return readJson<LearnedPattern[]>(patternsPath(projectRoot, skill), []);
}

export async function writePatterns(projectRoot: string, skill: string, patterns: LearnedPattern[]): Promise<void> {
  await writeJson(patternsPath(projectRoot, skill), patterns);
}

export async function writeCandidates(projectRoot: string, skill: string, markdown: string): Promise<string> {
  const filePath = path.join(skillFeedbackRoot(projectRoot, skill), "candidates.md");
  await writeText(filePath, markdown);
  return filePath;
}

export async function writeOverlay(projectRoot: string, skill: string, scope: string, markdown: string): Promise<string> {
  const filePath = path.join(projectRoot, ".skillflow", "overlays", scope, `${skill}.md`);
  await writeText(filePath, markdown);
  return filePath;
}

export async function ensureFeedback(projectRoot: string, skill: string): Promise<void> {
  await ensureDir(skillFeedbackRoot(projectRoot, skill));
  if (!(await pathExists(patternsPath(projectRoot, skill)))) {
    await writePatterns(projectRoot, skill, []);
  }
}
