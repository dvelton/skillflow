import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { copyDir, pathExists, removePath, resolveFrom } from "./files.js";
import type { ParsedSource, SkillEntry } from "./types.js";
import { SkillflowError } from "../utils/errors.js";

export function parseSource(source: string): ParsedSource {
  if (source.startsWith("local:")) {
    return { kind: "local", original: source, locator: source.slice("local:".length) };
  }
  if (source.startsWith("github:")) {
    const rest = source.slice("github:".length).replace(/^\/+/, "");
    const parts = rest.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new SkillflowError(`Invalid GitHub source "${source}". Expected github:owner/repo[/path].`);
    }
    return {
      kind: "github",
      original: source,
      locator: `${parts[0]}/${parts[1]}`,
      subpath: parts.slice(2).join("/") || undefined,
    };
  }
  return { kind: "local", original: source, locator: source };
}

export function normalizeSourceForManifest(source: string, resolveLocalFrom?: string): string {
  if (source.startsWith("github:")) return source;

  const hasLocalPrefix = source.startsWith("local:");
  const locator = hasLocalPrefix ? source.slice("local:".length) : source;
  if (locator.startsWith("~") || path.isAbsolute(locator)) {
    return `local:${locator}`;
  }

  const resolvedLocator = resolveLocalFrom ? path.resolve(resolveLocalFrom, locator) : locator;
  return `local:${resolvedLocator}`;
}

export async function resolveSkillSource(cwd: string, skill: SkillEntry, destination: string): Promise<{ resolvedSource: string; resolvedRef?: string }> {
  const parsed = parseSource(skill.source);
  if (parsed.kind === "local") {
    const sourcePath = resolveFrom(cwd, parsed.locator);
    if (!(await pathExists(sourcePath))) {
      throw new SkillflowError(`Local source for "${skill.name}" does not exist: ${sourcePath}`);
    }
    await copyDir(sourcePath, destination);
    return { resolvedSource: sourcePath };
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "skillflow-"));
  const repoUrl = `https://github.com/${parsed.locator}.git`;
  const cloneArgs = ["clone", "--quiet"];
  const ref = skill.version ?? skill.ref;
  if (ref && !/^[a-f0-9]{40}$/i.test(ref)) {
    cloneArgs.push("--branch", ref, "--depth", "1");
  }
  cloneArgs.push(repoUrl, tempRoot);

  try {
    execFileSync("git", cloneArgs, { stdio: "pipe" });
    if (ref && /^[a-f0-9]{40}$/i.test(ref)) {
      execFileSync("git", ["checkout", "--quiet", ref], { cwd: tempRoot, stdio: "pipe" });
    }
    const resolvedRef = execFileSync("git", ["rev-parse", "HEAD"], { cwd: tempRoot, encoding: "utf8" }).trim();
    const sourcePath = parsed.subpath ? path.join(tempRoot, parsed.subpath) : tempRoot;
    if (!(await pathExists(sourcePath))) {
      throw new SkillflowError(`GitHub source "${skill.source}" resolved, but subpath was not found.`);
    }
    await copyDir(sourcePath, destination);
    return { resolvedSource: `${repoUrl}${parsed.subpath ? `/${parsed.subpath}` : ""}`, resolvedRef };
  } catch (error) {
    if (error instanceof SkillflowError) throw error;
    throw new SkillflowError(`Failed to resolve GitHub source for "${skill.name}". Check the repo, ref, and network access.`);
  } finally {
    await removePath(tempRoot);
  }
}
