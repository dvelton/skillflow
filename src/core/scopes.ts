import type { SkillflowLock } from "./types.js";

export interface ComposedLockResult {
  lock: SkillflowLock;
  skippedPersonalSkills: string[];
}

export function composeWithPersonal(projectLock: SkillflowLock, personalLock?: SkillflowLock): ComposedLockResult {
  if (!personalLock) {
    return { lock: projectLock, skippedPersonalSkills: [] };
  }

  const seen = new Set<string>();
  const skills = [];
  for (const skill of projectLock.skills) {
    seen.add(skill.name);
    skills.push(skill);
  }

  const skippedPersonalSkills: string[] = [];
  for (const skill of personalLock.skills) {
    if (seen.has(skill.name)) {
      skippedPersonalSkills.push(skill.name);
      continue;
    }
    seen.add(skill.name);
    skills.push(skill);
  }

  return {
    skippedPersonalSkills,
    lock: {
      lockfile_version: 1,
      scope: projectLock.scope,
      manifest: {
        name: `${projectLock.manifest.name}+personal`,
        version: projectLock.manifest.version,
        description: `${projectLock.manifest.description} Includes personal skills from ${personalLock.manifest.name}.`,
      },
      generated_at: new Date().toISOString(),
      skills,
    },
  };
}
