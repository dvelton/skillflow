import path from "node:path";
import YAML from "yaml";
import { manifestSchema, type SkillflowManifest } from "./types.js";
import { pathExists, readText, writeText } from "./files.js";
import { SkillflowError } from "../utils/errors.js";

export const DEFAULT_MANIFEST = "skillflow.yaml";
export const DEFAULT_LOCKFILE = "skillflow.lock";

export async function findManifest(cwd: string, explicit?: string): Promise<string> {
  if (explicit) return path.resolve(cwd, explicit);
  const candidate = path.resolve(cwd, DEFAULT_MANIFEST);
  if (!(await pathExists(candidate))) {
    throw new SkillflowError(`No ${DEFAULT_MANIFEST} found. Run "skillflow init" first.`);
  }
  return candidate;
}

export async function readManifest(manifestPath: string): Promise<SkillflowManifest> {
  const parsed = YAML.parse(await readText(manifestPath)) as unknown;
  const result = manifestSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("\n");
    throw new SkillflowError(`Invalid manifest:\n${details}`);
  }
  return result.data;
}

export async function writeManifest(manifestPath: string, manifest: SkillflowManifest): Promise<void> {
  const normalized = manifestSchema.parse(manifest);
  await writeText(manifestPath, YAML.stringify(normalized));
}

export async function writeStarterManifest(cwd: string, force = false): Promise<string> {
  const filePath = path.join(cwd, DEFAULT_MANIFEST);
  if ((await pathExists(filePath)) && !force) {
    throw new SkillflowError(`${DEFAULT_MANIFEST} already exists. Use --force to overwrite it.`);
  }

  const starter = {
    schema_version: "1.0",
    name: path.basename(cwd).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "my-skillset",
    version: "0.1.0",
    description: "Reusable skills and last-mile learning for this project.",
    config: {
      export_targets: ["generic"],
      install_mode: "copy",
    },
    skills: [
      {
        name: "example-skill",
        source: "local:./skills/example-skill",
        description: "Replace this with what the skill does and when to use it.",
        tags: ["example"],
        requires: {
          skills: [],
          tools: [],
          files: [],
        },
      },
    ],
    collections: [
      {
        name: "default",
        description: "Skills loaded for normal project work.",
        required: ["example-skill"],
        recommended: [],
      },
    ],
  };

  await writeText(filePath, YAML.stringify(starter));
  return filePath;
}

export function lockfilePathFor(manifestPath: string): string {
  return path.join(path.dirname(manifestPath), DEFAULT_LOCKFILE);
}

export function stateDirFor(manifestPath: string): string {
  return path.join(path.dirname(manifestPath), ".skillflow");
}
