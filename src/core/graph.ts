import type { SkillflowLock } from "./types.js";

export function renderGraph(lock: SkillflowLock): string {
  const lines = [`skillset:${lock.manifest.name}`];
  for (const skill of lock.skills) {
    lines.push(`  ${skill.name}`);
    for (const required of skill.requires.skills) {
      lines.push(`    requires skill: ${required}`);
    }
    for (const tool of skill.requires.tools) {
      lines.push(`    requires tool: ${tool}`);
    }
    for (const file of skill.requires.files) {
      lines.push(`    requires file: ${file}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
