import YAML from "yaml";
import { SkillflowError } from "../utils/errors.js";
import type { SkillDocument } from "./types.js";

export function parseFrontmatter(markdown: string): SkillDocument {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    return { frontmatter: {}, body: markdown };
  }

  const closing = normalized.match(/\r?\n---\r?\n/);
  if (!closing || closing.index === undefined) {
    throw new SkillflowError("Markdown frontmatter starts with --- but has no closing ---.");
  }

  const frontmatterText = normalized.slice(4, closing.index);
  const body = normalized.slice(closing.index + closing[0].length);
  const parsed = YAML.parse(frontmatterText) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SkillflowError("Markdown frontmatter must be a YAML object.");
  }
  return { frontmatter: parsed as Record<string, unknown>, body };
}

export function formatFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  return `---\n${YAML.stringify(frontmatter).trim()}\n---\n\n${body.trim()}\n`;
}

export function getStringField(frontmatter: Record<string, unknown>, field: string): string | undefined {
  const value = frontmatter[field];
  return typeof value === "string" ? value : undefined;
}
