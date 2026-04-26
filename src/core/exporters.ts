import path from "node:path";
import { copyDir, ensureDir, pathExists, replacePathWithStaged, stagingPathFor, symlinkDir } from "./files.js";
import type { SkillflowLock } from "./types.js";
import { SkillflowError } from "../utils/errors.js";

export const TARGETS: Record<string, string> = {
  generic: ".agents/skills",
  claude: ".claude/skills",
  copilot: ".github/skills",
  cursor: ".cursor/skills",
  codex: ".codex/skills",
  amp: ".agents/skills",
  goose: ".goose/skills",
  opencode: ".opencode/skill",
};

export function parseTargets(raw?: string, fallback: string[] = ["generic"]): string[] {
  const targets = raw ? raw.split(",").map((part) => part.trim()).filter(Boolean) : fallback;
  const unknown = targets.filter((target) => !TARGETS[target]);
  if (unknown.length > 0) {
    throw new SkillflowError(`Unknown export target(s): ${unknown.join(", ")}. Known targets: ${Object.keys(TARGETS).join(", ")}`);
  }
  return [...new Set(targets)];
}

export async function exportSkills(projectRoot: string, lock: SkillflowLock, targets: string[], mode: "copy" | "symlink" = "copy"): Promise<string[]> {
  const exported: string[] = [];
  for (const target of targets) {
    const targetRoot = path.join(projectRoot, TARGETS[target]);
    await ensureDir(targetRoot);
    for (const skill of lock.skills) {
      if (!(await pathExists(skill.installed_path))) {
        throw new SkillflowError(`Installed skill missing for "${skill.name}". Run "skillflow install" again.`);
      }
      const destination = path.join(targetRoot, skill.name);
      const staged = stagingPathFor(destination);
      if (mode === "symlink") {
        await symlinkDir(skill.installed_path, staged);
      } else {
        await copyDir(skill.installed_path, staged);
      }
      await replacePathWithStaged(staged, destination);
      exported.push(path.relative(projectRoot, destination));
    }
  }
  return exported;
}
