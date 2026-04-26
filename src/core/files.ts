import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await pathExists(filePath))) return fallback;
  return JSON.parse(await readText(filePath)) as T;
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function removePath(filePath: string): Promise<void> {
  await fs.rm(filePath, { recursive: true, force: true });
}

export function stagingPathFor(destination: string): string {
  const parent = path.dirname(destination);
  const base = path.basename(destination);
  return path.join(parent, `.${base}.staging-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export async function replacePathWithStaged(stagedPath: string, destination: string): Promise<void> {
  await ensureDir(path.dirname(destination));
  const backupPath = path.join(path.dirname(destination), `.${path.basename(destination)}.backup-${process.pid}-${Date.now()}`);
  const hadExisting = await pathExists(destination);

  try {
    if (hadExisting) {
      await fs.rename(destination, backupPath);
    }
    await fs.rename(stagedPath, destination);
    if (hadExisting) {
      await removePath(backupPath);
    }
  } catch (error) {
    await removePath(destination);
    if (hadExisting && (await pathExists(backupPath))) {
      await fs.rename(backupPath, destination);
    }
    throw error;
  } finally {
    await removePath(stagedPath);
    await removePath(backupPath);
  }
}

export async function copyDir(source: string, destination: string): Promise<void> {
  await removePath(destination);
  await ensureDir(path.dirname(destination));
  await fs.cp(source, destination, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      return base !== ".git" && base !== "node_modules" && base !== ".skillflow";
    },
  });
}

export async function symlinkDir(source: string, destination: string): Promise<void> {
  await removePath(destination);
  await ensureDir(path.dirname(destination));
  await fs.symlink(source, destination, "dir");
}

export async function listFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  async function visit(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".skillflow") continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile()) {
        output.push(fullPath);
      }
    }
  }
  if (await pathExists(root)) await visit(root);
  return output.sort();
}

export function slashPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function resolveFrom(cwd: string, maybeRelative: string): string {
  if (maybeRelative.startsWith("~")) {
    return path.join(os.homedir(), maybeRelative.slice(1));
  }
  return path.isAbsolute(maybeRelative) ? maybeRelative : path.resolve(cwd, maybeRelative);
}

export async function ensureGitignoreEntry(projectRoot: string, entry: string): Promise<boolean> {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  const normalized = entry.trim();
  const existing = (await pathExists(gitignorePath)) ? await readText(gitignorePath) : "";
  const lines = existing.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(normalized)) return false;
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await writeText(gitignorePath, `${existing}${prefix}${normalized}\n`);
  return true;
}

export async function gitignoreIncludes(projectRoot: string, entry: string): Promise<boolean> {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  if (!(await pathExists(gitignorePath))) return false;
  const lines = (await readText(gitignorePath)).split(/\r?\n/).map((line) => line.trim());
  return lines.includes(entry);
}
