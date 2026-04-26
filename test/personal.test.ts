import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdtemp, cp } from "node:fs/promises";
import os from "node:os";
import { installSkillset } from "../src/core/installer.js";
import { exportSkills } from "../src/core/exporters.js";
import { composeWithPersonal } from "../src/core/scopes.js";
import { normalizeSourceForManifest } from "../src/core/sources.js";
import { writeText } from "../src/core/files.js";

async function personalFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "skillflow-personal-"));
  await cp(path.resolve("fixtures/basic-pack/skills/summarize"), path.join(root, "source/summarize"), { recursive: true });
  return root;
}

async function writePersonalManifest(root: string, skillNames: string[]): Promise<string> {
  const skills = skillNames.map((name) => [
    `  - name: ${name}`,
    "    source: local:./source/summarize",
    "    description: Personal summarization guidance.",
    "    tags:",
    "      - personal",
    "    requires:",
    "      skills: []",
    "      tools: []",
    "      files: []",
  ].join("\n")).join("\n");
  const manifestPath = path.join(root, "skillflow.yaml");
  await writeText(manifestPath, [
    'schema_version: "1.0"',
    "name: personal-fixture",
    "scope: personal",
    'version: "0.1.0"',
    "description: Personal fixture skillset.",
    "config:",
    "  export_targets:",
    "    - generic",
    "  install_mode: copy",
    "skills:",
    skills,
    "collections: []",
    "",
  ].join("\n"));
  return manifestPath;
}

describe("personal skillsets", () => {
  it("resolves relative personal add sources from the caller directory", async () => {
    const cwd = path.join(os.tmpdir(), "caller");

    expect(normalizeSourceForManifest("./skills/review", cwd)).toBe(`local:${path.join(cwd, "skills/review")}`);
    expect(normalizeSourceForManifest("local:../skills/review", cwd)).toBe(`local:${path.resolve(cwd, "../skills/review")}`);
    expect(normalizeSourceForManifest("local:~/skills/review", cwd)).toBe("local:~/skills/review");
    expect(normalizeSourceForManifest("github:owner/repo/skills/review", cwd)).toBe("github:owner/repo/skills/review");
  });

  it("installs personal skills into the personal home instead of a nested project state dir", async () => {
    const root = await personalFixtureRoot();
    const manifestPath = await writePersonalManifest(root, ["personal-summarize"]);
    const result = await installSkillset(manifestPath);

    expect(result.lock.scope).toBe("personal");
    expect(result.lock.skills[0]?.scope).toBe("personal");
    expect(result.lock.skills[0]?.installed_path).toBe(path.join(root, "skills/personal-summarize"));

    const exported = await exportSkills(root, result.lock, ["generic"]);
    expect(exported).toEqual([".agents/skills/personal-summarize"]);
  });

  it("composes project and personal locks with project skills taking precedence", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "skillflow-project-"));
    await cp(path.resolve("fixtures/basic-pack"), projectRoot, { recursive: true });
    const project = await installSkillset(path.join(projectRoot, "skillflow.yaml"));

    const personalRoot = await personalFixtureRoot();
    const personalManifest = await writePersonalManifest(personalRoot, ["summarize", "personal-style"]);
    const personal = await installSkillset(personalManifest);

    const composed = composeWithPersonal(project.lock, personal.lock);
    expect(composed.skippedPersonalSkills).toEqual(["summarize"]);
    expect(composed.lock.skills.map((skill) => `${skill.name}:${skill.scope}`)).toEqual([
      "summarize:project",
      "personal-style:personal",
    ]);
  });
});
