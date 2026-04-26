import path from "node:path";
import { copyDir, ensureDir, writeText } from "./files.js";
import { TARGETS, parseTargets } from "./exporters.js";
import type { SkillflowLock } from "./types.js";

export function renderRouterSkill(lock: SkillflowLock, name: string): string {
  const lines = [
    "---",
    `name: ${name}`,
    `description: Route work to the right skill in the ${lock.manifest.name} skillset. Use when the user asks what skills are available, which workflow to use, or requests a task that may match one of the listed skills.`,
    "---",
    "",
    `# ${lock.manifest.name} router`,
    "",
    "Use this router to choose the most relevant skill. Prefer a specific skill over general guidance when a task clearly matches one of the descriptions below.",
    "",
    "| Skill | Description | Tags | Requirements |",
    "| --- | --- | --- | --- |",
  ];

  for (const skill of lock.skills) {
    const tags = skill.tags.length ? skill.tags.join(", ") : "-";
    const requirements = [
      ...skill.requires.skills.map((item) => `skill:${item}`),
      ...skill.requires.tools.map((item) => `tool:${item}`),
      ...skill.requires.files.map((item) => `file:${item}`),
    ].join(", ") || "-";
    lines.push(`| ${skill.name} | ${skill.description ?? ""} | ${tags} | ${requirements} |`);
  }

  lines.push(
    "",
    "When a skill is selected, invoke or load that skill's own instructions rather than treating this router as a substitute for the skill.",
    "",
  );

  return lines.join("\n");
}

export async function writeRouterSkill(projectRoot: string, lock: SkillflowLock, name: string): Promise<string> {
  const root = path.join(projectRoot, ".skillflow", "router", name);
  await ensureDir(root);
  const filePath = path.join(root, "SKILL.md");
  await writeText(filePath, renderRouterSkill(lock, name));
  return root;
}

export async function exportRouterSkill(projectRoot: string, routerRoot: string, name: string, rawTargets: string): Promise<string[]> {
  const targets = parseTargets(rawTargets);
  const exported: string[] = [];
  for (const target of targets) {
    const destination = path.join(projectRoot, TARGETS[target], name);
    await copyDir(routerRoot, destination);
    exported.push(path.relative(projectRoot, destination));
  }
  return exported;
}
