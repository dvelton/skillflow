import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdtemp, cp } from "node:fs/promises";
import os from "node:os";
import { installSkillset } from "../src/core/installer.js";
import { exportSkills } from "../src/core/exporters.js";
import { validateProject } from "../src/core/validator.js";

async function fixtureProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "skillflow-test-"));
  await cp(path.resolve("fixtures/basic-pack"), root, { recursive: true });
  return root;
}

describe("manifest installation", () => {
  it("installs, locks, exports, and validates a local skill", async () => {
    const root = await fixtureProject();
    const manifestPath = path.join(root, "skillflow.yaml");
    const result = await installSkillset(manifestPath);
    expect(result.lock.skills).toHaveLength(1);
    expect(result.lock.skills[0]?.name).toBe("summarize");
    const exported = await exportSkills(root, result.lock, ["generic"]);
    expect(exported).toEqual([".agents/skills/summarize"]);
    const issues = await validateProject(manifestPath);
    expect(issues.filter((issue) => issue.level === "error")).toEqual([]);
  });
});
