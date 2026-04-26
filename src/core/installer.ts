import path from "node:path";
import { getStringField, parseFrontmatter } from "./frontmatter.js";
import { hashDirectory } from "./hash.js";
import { lockfilePathFor, readManifest, stateDirFor } from "./manifest.js";
import { readText, replacePathWithStaged, stagingPathFor } from "./files.js";
import { skillInstallPath, writeLock } from "./lock.js";
import { resolveSkillSource } from "./sources.js";
import type { SkillEntry, SkillLockEntry, SkillflowLock } from "./types.js";
import { SkillflowError } from "../utils/errors.js";

export interface InstallResult {
  lock: SkillflowLock;
  lockPath: string;
}

function normalizeRequires(skill: SkillEntry): SkillLockEntry["requires"] {
  return {
    skills: skill.requires?.skills ?? [],
    tools: skill.requires?.tools ?? [],
    files: skill.requires?.files ?? [],
  };
}

export async function installSkillset(manifestPath: string): Promise<InstallResult> {
  const projectRoot = path.dirname(manifestPath);
  const manifest = await readManifest(manifestPath);
  const stateDir = stateDirFor(manifestPath);
  const installed: SkillLockEntry[] = [];
  const names = new Set<string>();

  for (const skill of manifest.skills) {
    if (names.has(skill.name)) {
      throw new SkillflowError(`Duplicate skill name in manifest: ${skill.name}`);
    }
    names.add(skill.name);

    const destination = skillInstallPath(stateDir, skill.name);
    const staged = stagingPathFor(destination);
    const resolution = await resolveSkillSource(projectRoot, skill, staged);
    const entrypointPath = path.join(staged, skill.entrypoint);
    const document = parseFrontmatter(await readText(entrypointPath));
    const description = skill.description ?? getStringField(document.frontmatter, "description");
    if (!description) {
      throw new SkillflowError(`Skill "${skill.name}" must have a description in skillflow.yaml or ${skill.entrypoint}.`);
    }
    const integrity = await hashDirectory(staged);
    await replacePathWithStaged(staged, destination);

    installed.push({
      name: skill.name,
      source: skill.source,
      resolved_source: resolution.resolvedSource,
      resolved_ref: resolution.resolvedRef,
      entrypoint: skill.entrypoint,
      description,
      category: skill.category,
      tags: skill.tags,
      integrity,
      installed_path: destination,
      installed_at: new Date().toISOString(),
      requires: normalizeRequires(skill),
    });
  }

  const lock: SkillflowLock = {
    lockfile_version: 1,
    manifest: {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
    },
    generated_at: new Date().toISOString(),
    skills: installed,
  };
  const lockPath = lockfilePathFor(manifestPath);
  await writeLock(lockPath, lock);
  return { lock, lockPath };
}
