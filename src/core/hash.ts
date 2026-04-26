import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { listFiles, slashPath } from "./files.js";

export function shortHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return `sha256-${crypto.createHash("sha256").update(content).digest("base64")}`;
}

export async function hashDirectory(root: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const files = await listFiles(root);
  for (const file of files) {
    const relative = slashPath(path.relative(root, file));
    hash.update(relative);
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return `sha256-${hash.digest("base64")}`;
}
