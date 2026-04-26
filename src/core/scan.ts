import path from "node:path";
import { listFiles, readText } from "./files.js";
import type { SkillflowLock } from "./types.js";

export interface ScanFinding {
  severity: "high" | "medium" | "low";
  skill: string;
  file: string;
  message: string;
}

const checks: Array<{
  severity: ScanFinding["severity"];
  pattern: RegExp;
  message: string;
}> = [
  {
    severity: "high",
    pattern: /(?:api[_-]?key|token|secret|password)\s*[:=]\s*["'][^"']{12,}["']/i,
    message: "Possible hard-coded secret or credential.",
  },
  {
    severity: "high",
    pattern: /\b(?:ignore|bypass|override)\b.{0,80}\b(?:instructions|policy|safety|permission|approval)\b/i,
    message: "Possible instruction to bypass policy, permissions, or higher-priority instructions.",
  },
  {
    severity: "medium",
    pattern: /\b(?:curl|wget)\b.+\|\s*(?:bash|sh|zsh|powershell)/i,
    message: "Downloads and executes remote code in one command.",
  },
  {
    severity: "medium",
    pattern: /\brm\s+-rf\s+(?:\/|\$HOME|~)/i,
    message: "Contains a broad destructive shell command.",
  },
  {
    severity: "low",
    pattern: /\b(?:eval|exec)\s*\(/i,
    message: "Contains dynamic code execution. Review before trusting.",
  },
];

export async function scanLockedSkills(lock: SkillflowLock): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  for (const skill of lock.skills) {
    const files = await listFiles(skill.installed_path);
    for (const file of files) {
      const relative = path.relative(skill.installed_path, file);
      const content = await readText(file);
      for (const check of checks) {
        if (check.pattern.test(content)) {
          findings.push({
            severity: check.severity,
            skill: skill.name,
            file: relative,
            message: check.message,
          });
        }
      }
    }
  }
  return findings;
}
