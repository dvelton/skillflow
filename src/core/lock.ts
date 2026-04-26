import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { skillflowScopeSchema, type SkillflowLock } from "./types.js";
import { pathExists, readText, writeText } from "./files.js";
import { SkillflowError } from "../utils/errors.js";

const lockEntrySchema = z.object({
  name: z.string().min(1),
  scope: skillflowScopeSchema.default("project"),
  source: z.string().min(1),
  resolved_source: z.string().min(1),
  resolved_ref: z.string().optional(),
  entrypoint: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()),
  integrity: z.string().min(1),
  installed_path: z.string().min(1),
  installed_at: z.string().min(1),
  requires: z.object({
    skills: z.array(z.string()),
    tools: z.array(z.string()),
    files: z.array(z.string()),
  }),
});

const lockSchema = z.object({
  lockfile_version: z.literal(1),
  scope: skillflowScopeSchema.default("project"),
  manifest: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().min(1),
  }),
  generated_at: z.string().min(1),
  skills: z.array(lockEntrySchema),
});

export async function readLock(lockPath: string): Promise<SkillflowLock | undefined> {
  if (!(await pathExists(lockPath))) return undefined;
  const parsed = YAML.parse(await readText(lockPath)) as unknown;
  const result = lockSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("\n");
    throw new SkillflowError(`Invalid lockfile:\n${details}`);
  }
  return result.data;
}

export async function writeLock(lockPath: string, lock: SkillflowLock): Promise<void> {
  await writeText(lockPath, YAML.stringify(lock));
}

export function skillInstallPath(stateDir: string, skillName: string): string {
  return path.join(stateDir, "skills", skillName);
}
