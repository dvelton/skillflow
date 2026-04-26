#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { findManifest, lockfilePathFor, readManifest, stateDirFor, writeManifest, writeStarterManifest } from "./core/manifest.js";
import { installSkillset } from "./core/installer.js";
import { readLock } from "./core/lock.js";
import { exportSkills, parseTargets, TARGETS } from "./core/exporters.js";
import { validateProject } from "./core/validator.js";
import { renderGraph } from "./core/graph.js";
import { scanLockedSkills } from "./core/scan.js";
import { exportRouterSkill, writeRouterSkill } from "./core/router.js";
import { ensureGitignoreEntry, gitignoreIncludes } from "./core/files.js";
import { captureDraft, ensureFeedback, readPatterns, readSnapshots, writeCandidates, writeOverlay, writePatterns } from "./lastmile/store.js";
import { learnFromFinal } from "./lastmile/learn.js";
import { renderCandidates, renderOverlay } from "./lastmile/suggest.js";
import { SkillflowError } from "./utils/errors.js";

const program = new Command();

function projectRootFromManifest(manifestPath: string): string {
  return path.dirname(manifestPath);
}

async function getLockOrThrow(manifestPath: string) {
  const lock = await readLock(lockfilePathFor(manifestPath));
  if (!lock) throw new SkillflowError("No skillflow.lock found. Run skillflow install first.");
  return lock;
}

program
  .name("skillflow")
  .description("Tool-agnostic skillset manager with last-mile learning from human edits.")
  .version("0.1.0");

program
  .command("init")
  .description("Create a starter skillflow.yaml manifest.")
  .option("-f, --force", "overwrite an existing manifest", false)
  .action(async (options: { force: boolean }) => {
    const filePath = await writeStarterManifest(process.cwd(), options.force);
    await ensureGitignoreEntry(process.cwd(), ".skillflow/");
    console.log(chalk.green(`Created ${path.relative(process.cwd(), filePath)}`));
    console.log("Added .skillflow/ to .gitignore.");
  });

program
  .command("add")
  .description("Add a skill source to skillflow.yaml.")
  .argument("<source>", "local path, local:<path>, or github:owner/repo[/path]")
  .option("-n, --name <name>", "skill name")
  .option("-d, --description <description>", "skill description")
  .option("--tag <tag...>", "tag(s) for search and routing")
  .option("--category <category>", "skill category")
  .option("--requires-skill <skill...>", "required skill(s)")
  .option("--requires-tool <tool...>", "required tool(s)")
  .option("--requires-file <file...>", "required file(s)")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (source: string, options: {
    name?: string;
    description?: string;
    tag?: string[];
    category?: string;
    requiresSkill?: string[];
    requiresTool?: string[];
    requiresFile?: string[];
    manifest?: string;
  }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const manifest = await readManifest(manifestPath);
    const normalizedSource = source.startsWith("local:") || source.startsWith("github:") ? source : `local:${source}`;
    const sourceTail = normalizedSource.split("/").filter(Boolean).at(-1)?.replace(/^local:/, "") ?? "skill";
    const name = options.name ?? sourceTail.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (manifest.skills.some((skill) => skill.name === name)) {
      throw new SkillflowError(`Skill "${name}" already exists in ${path.basename(manifestPath)}.`);
    }
    manifest.skills.push({
      name,
      source: normalizedSource,
      description: options.description,
      tags: options.tag ?? [],
      category: options.category,
      entrypoint: "SKILL.md",
      requires: {
        skills: options.requiresSkill ?? [],
        tools: options.requiresTool ?? [],
        files: options.requiresFile ?? [],
      },
    });
    await writeManifest(manifestPath, manifest);
    console.log(chalk.green(`Added ${name} to ${path.relative(process.cwd(), manifestPath)}.`));
  });

program
  .command("install")
  .description("Resolve skills into .skillflow/skills and write skillflow.lock.")
  .option("-m, --manifest <path>", "manifest path")
  .option("-t, --target <targets>", `comma-separated export targets (${Object.keys(TARGETS).join(", ")})`)
  .action(async (options: { manifest?: string; target?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    await ensureGitignoreEntry(projectRootFromManifest(manifestPath), ".skillflow/");
    const manifest = await readManifest(manifestPath);
    const result = await installSkillset(manifestPath);
    console.log(chalk.green(`Installed ${result.lock.skills.length} skill(s).`));
    console.log(`Wrote ${path.relative(process.cwd(), result.lockPath)}`);

    const fallbackTargets = manifest.config.export_targets?.length ? manifest.config.export_targets : ["generic"];
    const targets = parseTargets(options.target, fallbackTargets);
    if (targets.length > 0) {
      const exported = await exportSkills(projectRootFromManifest(manifestPath), result.lock, targets, manifest.config.install_mode ?? "copy");
      console.log(chalk.green(`Exported ${exported.length} skill target(s).`));
    }
  });

program
  .command("export")
  .description("Export locked skills to one or more agent directories.")
  .requiredOption("-t, --target <targets>", `comma-separated targets (${Object.keys(TARGETS).join(", ")})`)
  .option("-m, --manifest <path>", "manifest path")
  .option("--mode <mode>", "copy or symlink", "copy")
  .action(async (options: { manifest?: string; target: string; mode: "copy" | "symlink" }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const targets = parseTargets(options.target);
    const lock = await getLockOrThrow(manifestPath);
    const exported = await exportSkills(projectRootFromManifest(manifestPath), lock, targets, options.mode);
    console.log(chalk.green(`Exported ${exported.length} skill target(s):`));
    exported.forEach((item) => console.log(`- ${item}`));
  });

program
  .command("list")
  .description("List declared and locked skills.")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (options: { manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const manifest = await readManifest(manifestPath);
    const lock = await readLock(lockfilePathFor(manifestPath));
    console.log(`${manifest.name}@${manifest.version}`);
    for (const skill of manifest.skills) {
      const locked = lock?.skills.find((entry) => entry.name === skill.name);
      const status = locked ? "locked" : "declared";
      console.log(`- ${skill.name} (${status}) ${skill.description ?? ""}`);
      if (locked?.resolved_ref) console.log(`  ref: ${locked.resolved_ref}`);
      if (locked?.integrity) console.log(`  integrity: ${locked.integrity}`);
    }
  });

program
  .command("validate")
  .description("Validate the manifest, lockfile, installed skills, and collection references.")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (options: { manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const issues = await validateProject(manifestPath);
    if (issues.length === 0) {
      console.log(chalk.green("No validation issues found."));
      return;
    }
    for (const issue of issues) {
      const color = issue.level === "error" ? chalk.red : chalk.yellow;
      console.log(color(`${issue.level.toUpperCase()}: ${issue.message}`));
    }
    if (issues.some((issue) => issue.level === "error")) process.exitCode = 1;
  });

program
  .command("graph")
  .description("Print a skill dependency graph from the lockfile.")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (options: { manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const lock = await getLockOrThrow(manifestPath);
    process.stdout.write(renderGraph(lock));
  });

program
  .command("router")
  .description("Generate a compact router skill for the locked skillset.")
  .option("-n, --name <name>", "router skill name", "skillflow-router")
  .option("-t, --target <targets>", "optional comma-separated export targets")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (options: { name: string; target?: string; manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const projectRoot = projectRootFromManifest(manifestPath);
    const lock = await getLockOrThrow(manifestPath);
    const routerRoot = await writeRouterSkill(projectRoot, lock, options.name);
    console.log(chalk.green(`Wrote ${path.relative(process.cwd(), path.join(routerRoot, "SKILL.md"))}`));
    if (options.target) {
      const exported = await exportRouterSkill(projectRoot, routerRoot, options.name, options.target);
      exported.forEach((item) => console.log(`- ${item}`));
    }
  });

program
  .command("scan")
  .description("Scan locked skills for secrets and risky instructions.")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (options: { manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const lock = await getLockOrThrow(manifestPath);
    const findings = await scanLockedSkills(lock);
    if (findings.length === 0) {
      console.log(chalk.green("No scan findings."));
      return;
    }
    for (const finding of findings) {
      const color = finding.severity === "high" ? chalk.red : finding.severity === "medium" ? chalk.yellow : chalk.gray;
      console.log(color(`${finding.severity.toUpperCase()}: ${finding.skill}/${finding.file}: ${finding.message}`));
    }
    if (findings.some((finding) => finding.severity === "high")) process.exitCode = 1;
  });

program
  .command("doctor")
  .description("Show the current Skillflow setup and likely next actions.")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (options: { manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const manifest = await readManifest(manifestPath);
    const lock = await readLock(lockfilePathFor(manifestPath));
    const issues = await validateProject(manifestPath);
    console.log(`Manifest: ${path.relative(process.cwd(), manifestPath)}`);
    console.log(`Skillset: ${manifest.name}@${manifest.version}`);
    console.log(`Skills declared: ${manifest.skills.length}`);
    console.log(`Skills locked: ${lock?.skills.length ?? 0}`);
    console.log(`State dir: ${path.relative(process.cwd(), stateDirFor(manifestPath))}`);
    if (!(await gitignoreIncludes(projectRootFromManifest(manifestPath), ".skillflow/"))) {
      console.log(chalk.yellow("Warning: .skillflow/ is not listed in .gitignore. Raw feedback may contain sensitive content."));
    }
    console.log(`Issues: ${issues.length}`);
    for (const issue of issues) console.log(`- ${issue.level}: ${issue.message}`);
  });

const lastMile = program.command("last-mile").description("Capture and learn from human edits to AI-generated output.");

lastMile
  .command("capture")
  .description("Capture an AI-generated draft before human editing.")
  .argument("<draft>", "path to the draft file")
  .requiredOption("-s, --skill <skill>", "skill or workflow that produced the draft")
  .option("-l, --label <label>", "optional label for the task")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (draft: string, options: { skill: string; label?: string; manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    await ensureGitignoreEntry(projectRootFromManifest(manifestPath), ".skillflow/");
    await ensureFeedback(projectRootFromManifest(manifestPath), options.skill);
    const snapshot = await captureDraft(projectRootFromManifest(manifestPath), options.skill, path.resolve(process.cwd(), draft), options.label);
    console.log(chalk.green(`Captured snapshot ${snapshot.id} for ${options.skill}.`));
  });

lastMile
  .command("learn")
  .description("Compare a captured draft with the final human-edited version.")
  .argument("<final>", "path to final edited file")
  .requiredOption("-s, --skill <skill>", "skill or workflow that produced the draft")
  .option("--snapshot <id>", "snapshot id, defaults to latest", "latest")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (finalPath: string, options: { skill: string; snapshot: string; manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const result = await learnFromFinal(projectRootFromManifest(manifestPath), options.skill, path.resolve(process.cwd(), finalPath), options.snapshot);
    console.log(chalk.green(`Learned from snapshot ${result.snapshot.id}.`));
    console.log(`New patterns: ${result.newPatterns}`);
    console.log(`Reinforced patterns: ${result.reinforcedPatterns}`);
    console.log(`Total patterns: ${result.patterns.length}`);
  });

lastMile
  .command("suggest")
  .description("Write reviewable improvement candidates for a skill.")
  .requiredOption("-s, --skill <skill>", "skill to inspect")
  .option("--min-support <number>", "minimum support count", "2")
  .option("--min-confidence <number>", "minimum confidence score", "0.55")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (options: { skill: string; minSupport: string; minConfidence: string; manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const projectRoot = projectRootFromManifest(manifestPath);
    const patterns = await readPatterns(projectRoot, options.skill);
    const markdown = renderCandidates(options.skill, patterns, Number(options.minSupport), Number(options.minConfidence));
    const filePath = await writeCandidates(projectRoot, options.skill, markdown);
    console.log(chalk.green(`Wrote ${path.relative(process.cwd(), filePath)}`));
  });

lastMile
  .command("status")
  .description("Show snapshots and learned pattern counts for a skill.")
  .requiredOption("-s, --skill <skill>", "skill to inspect")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (options: { skill: string; manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const projectRoot = projectRootFromManifest(manifestPath);
    const snapshots = await readSnapshots(projectRoot, options.skill);
    const patterns = await readPatterns(projectRoot, options.skill);
    console.log(`${options.skill}`);
    console.log(`Snapshots: ${snapshots.length}`);
    console.log(`Patterns: ${patterns.length}`);
    console.log(`Approved: ${patterns.filter((pattern) => pattern.approved).length}`);
    const strongest = patterns.slice(0, 5);
    for (const pattern of strongest) {
      console.log(`- ${pattern.id} support=${pattern.support} confidence=${pattern.confidence} approved=${pattern.approved ? "yes" : "no"} ${pattern.summary}`);
    }
  });

lastMile
  .command("approve")
  .description("Approve learned patterns before applying them to an overlay.")
  .requiredOption("-s, --skill <skill>", "skill to approve patterns for")
  .option("--id <id...>", "pattern id(s) to approve")
  .option("--all", "approve all patterns meeting the threshold", false)
  .option("--min-support <number>", "minimum support count for --all", "2")
  .option("--min-confidence <number>", "minimum confidence score for --all", "0.55")
  .option("-m, --manifest <path>", "manifest path")
  .action(async (options: { skill: string; id?: string[]; all: boolean; minSupport: string; minConfidence: string; manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const projectRoot = projectRootFromManifest(manifestPath);
    const patterns = await readPatterns(projectRoot, options.skill);
    const ids = new Set(options.id ?? []);
    let approved = 0;
    for (const pattern of patterns) {
      const thresholdMatch = pattern.support >= Number(options.minSupport) && pattern.confidence >= Number(options.minConfidence);
      if (ids.has(pattern.id) || (options.all && thresholdMatch)) {
        if (!pattern.approved) approved += 1;
        pattern.approved = true;
      }
    }
    await writePatterns(projectRoot, options.skill, patterns);
    console.log(chalk.green(`Approved ${approved} pattern(s).`));
  });

lastMile
  .command("apply")
  .description("Promote approved learned patterns into a local overlay file.")
  .requiredOption("-s, --skill <skill>", "skill to create an overlay for")
  .option("--scope <scope>", "personal, team, or org", "personal")
  .option("--min-support <number>", "minimum support count", "2")
  .option("--min-confidence <number>", "minimum confidence score", "0.55")
  .option("--include-unapproved", "include patterns that meet thresholds even if not approved", false)
  .option("-m, --manifest <path>", "manifest path")
  .action(async (options: { skill: string; scope: string; minSupport: string; minConfidence: string; includeUnapproved: boolean; manifest?: string }) => {
    const manifestPath = await findManifest(process.cwd(), options.manifest);
    const projectRoot = projectRootFromManifest(manifestPath);
    const patterns = await readPatterns(projectRoot, options.skill);
    const overlay = renderOverlay(options.skill, patterns, options.scope, Number(options.minSupport), Number(options.minConfidence), !options.includeUnapproved);
    const filePath = await writeOverlay(projectRoot, options.skill, options.scope, overlay);
    console.log(chalk.green(`Wrote ${path.relative(process.cwd(), filePath)}`));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof SkillflowError) {
    console.error(chalk.red(error.message));
  } else if (error instanceof Error) {
    console.error(chalk.red(error.stack ?? error.message));
  } else {
    console.error(chalk.red(String(error)));
  }
  process.exitCode = 1;
});
