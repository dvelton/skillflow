import path from "node:path";
import { readJson, writeJson, writeText, pathExists, readText, ensureDir } from "../core/files.js";
import { shortHash } from "../core/hash.js";
import type { LearnedPattern, Snapshot } from "./types.js";

export function feedbackRoot(stateDir: string): string {
  return path.join(stateDir, "feedback");
}

export function skillFeedbackRoot(stateDir: string, skill: string): string {
  return path.join(feedbackRoot(stateDir), skill);
}

export function snapshotsPath(stateDir: string, skill: string): string {
  return path.join(skillFeedbackRoot(stateDir, skill), "snapshots.json");
}

export function patternsPath(stateDir: string, skill: string): string {
  return path.join(skillFeedbackRoot(stateDir, skill), "patterns.json");
}

export async function readSnapshots(stateDir: string, skill: string): Promise<Snapshot[]> {
  return readJson<Snapshot[]>(snapshotsPath(stateDir, skill), []);
}

export async function writeSnapshots(stateDir: string, skill: string, snapshots: Snapshot[]): Promise<void> {
  await writeJson(snapshotsPath(stateDir, skill), snapshots);
}

export async function latestSnapshot(stateDir: string, skill: string): Promise<Snapshot | undefined> {
  const snapshots = await readSnapshots(stateDir, skill);
  return snapshots.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
}

export async function findSnapshot(stateDir: string, skill: string, id?: string): Promise<Snapshot | undefined> {
  if (!id || id === "latest") return latestSnapshot(stateDir, skill);
  return (await readSnapshots(stateDir, skill)).find((snapshot) => snapshot.id === id);
}

export async function captureDraft(stateDir: string, skill: string, sourcePath: string, label?: string): Promise<Snapshot> {
  const content = await readText(sourcePath);
  const snapshots = await readSnapshots(stateDir, skill);
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
  await writeSnapshots(stateDir, skill, snapshots);
  return snapshot;
}

export async function readPatterns(stateDir: string, skill: string): Promise<LearnedPattern[]> {
  return readJson<LearnedPattern[]>(patternsPath(stateDir, skill), []);
}

export async function writePatterns(stateDir: string, skill: string, patterns: LearnedPattern[]): Promise<void> {
  await writeJson(patternsPath(stateDir, skill), patterns);
}

export async function writeCandidates(stateDir: string, skill: string, markdown: string): Promise<string> {
  const filePath = path.join(skillFeedbackRoot(stateDir, skill), "candidates.md");
  await writeText(filePath, markdown);
  return filePath;
}

export async function writeOverlay(stateDir: string, skill: string, scope: string, markdown: string): Promise<string> {
  const filePath = path.join(stateDir, "overlays", scope, `${skill}.md`);
  await writeText(filePath, markdown);
  return filePath;
}

export async function ensureFeedback(stateDir: string, skill: string): Promise<void> {
  await ensureDir(skillFeedbackRoot(stateDir, skill));
  if (!(await pathExists(patternsPath(stateDir, skill)))) {
    await writePatterns(stateDir, skill, []);
  }
}
