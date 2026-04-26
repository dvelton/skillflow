import path from "node:path";
import os from "node:os";
import YAML from "yaml";
import { manifestSchema, type SkillflowManifest, type SkillflowScope } from "./types.js";
import { pathExists, readText, writeText } from "./files.js";
import { SkillflowError } from "../utils/errors.js";

export const DEFAULT_MANIFEST = "skillflow.yaml";
export const DEFAULT_LOCKFILE = "skillflow.lock";
export const SKILLFLOW_HOME_ENV = "SKILLFLOW_HOME";

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

function normalizedName(input: string, fallback: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

export function skillflowHome(): string {
  const configured = process.env[SKILLFLOW_HOME_ENV];
  if (!configured) return path.join(os.homedir(), ".skillflow");
  if (configured === "~") return os.homedir();
  if (configured.startsWith("~/")) return path.join(os.homedir(), configured.slice(2));
  return path.resolve(configured);
}

export function personalManifestPath(home = skillflowHome()): string {
  return path.join(home, DEFAULT_MANIFEST);
}

export async function findPersonalManifest(explicit?: string): Promise<string> {
  const candidate = explicit ? path.resolve(explicit) : personalManifestPath();
  if (!(await pathExists(candidate))) {
    throw new SkillflowError(`No personal ${DEFAULT_MANIFEST} found. Run "skillflow personal init" first.`);
  }
  return candidate;
}

export async function writeStarterManifest(cwd: string, force = false, scope: SkillflowScope = "project"): Promise<string> {
  const filePath = path.join(cwd, DEFAULT_MANIFEST);
  if ((await pathExists(filePath)) && !force) {
    throw new SkillflowError(`${DEFAULT_MANIFEST} already exists. Use --force to overwrite it.`);
  }

  const isPersonal = scope === "personal";
  const starter = {
    schema_version: "1.0",
    name: isPersonal ? "personal-skills" : normalizedName(path.basename(cwd), "my-skillset"),
    scope,
    version: "0.1.0",
    description: isPersonal
      ? "Reusable personal skills and last-mile learning."
      : "Reusable skills and last-mile learning for this project.",
    config: {
      export_targets: ["generic"],
      install_mode: "copy",
      include_personal: false,
      personal_overlays: "allow",
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
        description: isPersonal ? "Skills loaded for personal work." : "Skills loaded for normal project work.",
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

export function stateDirFor(manifestPath: string, scope: SkillflowScope = "project"): string {
  return scope === "personal" ? path.dirname(manifestPath) : path.join(path.dirname(manifestPath), ".skillflow");
}
