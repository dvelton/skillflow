import path from "node:path";
import { parseFrontmatter, getStringField } from "./frontmatter.js";
import { lockfilePathFor, readManifest, stateDirFor } from "./manifest.js";
import { hashDirectory } from "./hash.js";
import { pathExists, readText } from "./files.js";
import { readLock, skillInstallPath } from "./lock.js";

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

export async function validateProject(manifestPath: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const manifest = await readManifest(manifestPath);
  const stateDir = stateDirFor(manifestPath, manifest.scope);
  const names = new Set<string>();
  for (const skill of manifest.skills) {
    if (names.has(skill.name)) {
      issues.push({ level: "error", message: `Duplicate skill name: ${skill.name}` });
    }
    names.add(skill.name);
    for (const required of skill.requires?.skills ?? []) {
      if (!manifest.skills.some((candidate) => candidate.name === required)) {
        issues.push({ level: "warning", message: `Skill "${skill.name}" requires missing skill "${required}".` });
      }
    }
  }

  for (const collection of manifest.collections) {
    const referenced = [...collection.skills, ...collection.required, ...collection.recommended];
    for (const skillName of referenced) {
      if (!names.has(skillName)) {
        issues.push({ level: "error", message: `Collection "${collection.name}" references unknown skill "${skillName}".` });
      }
    }
  }

  const lock = await readLock(lockfilePathFor(manifestPath));
  if (!lock) {
    issues.push({ level: "warning", message: "No skillflow.lock found. Run skillflow install." });
    return issues;
  }

  for (const skill of lock.skills) {
    const installed = skillInstallPath(stateDir, skill.name);
    if (!(await pathExists(installed))) {
      issues.push({ level: "error", message: `Installed skill missing: ${skill.name}` });
      continue;
    }
    const entrypoint = path.join(installed, skill.entrypoint);
    if (!(await pathExists(entrypoint))) {
      issues.push({ level: "error", message: `Skill "${skill.name}" is missing ${skill.entrypoint}.` });
      continue;
    }
    const doc = parseFrontmatter(await readText(entrypoint));
    const description = getStringField(doc.frontmatter, "description") ?? skill.description;
    if (!description) {
      issues.push({ level: "error", message: `Skill "${skill.name}" has no description.` });
    }
    const integrity = await hashDirectory(installed);
    if (integrity !== skill.integrity) {
      issues.push({ level: "warning", message: `Skill "${skill.name}" differs from lockfile integrity.` });
    }
  }

  return issues;
}
