import { z } from "zod";

export const sourceSchema = z.string().min(1);

const requiresSchema = z.object({
  skills: z.array(z.string().min(1)).default([]),
  tools: z.array(z.string().min(1)).default([]),
  files: z.array(z.string().min(1)).default([]),
}).partial().default({});

export const skillEntrySchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  source: sourceSchema,
  description: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  ref: z.string().min(1).optional(),
  entrypoint: z.string().min(1).default("SKILL.md"),
  tags: z.array(z.string().min(1)).default([]),
  category: z.string().min(1).optional(),
  requires: requiresSchema,
});

export const collectionSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  description: z.string().optional(),
  skills: z.array(z.string().min(1)).default([]),
  required: z.array(z.string().min(1)).default([]),
  recommended: z.array(z.string().min(1)).default([]),
});

export const manifestSchema = z.object({
  schema_version: z.string().default("1.0"),
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  version: z.string().min(1).default("0.1.0"),
  description: z.string().min(1),
  skills: z.array(skillEntrySchema).default([]),
  collections: z.array(collectionSchema).default([]),
  config: z.object({
    export_targets: z.array(z.string()).default([]),
    install_mode: z.enum(["copy", "symlink"]).default("copy"),
  }).partial().default({}),
});

export type SkillEntry = z.infer<typeof skillEntrySchema>;
export type SkillflowManifest = z.infer<typeof manifestSchema>;
export type SkillCollection = z.infer<typeof collectionSchema>;

export type SourceKind = "local" | "github";

export interface ParsedSource {
  kind: SourceKind;
  original: string;
  locator: string;
  subpath?: string;
}

export interface SkillLockEntry {
  name: string;
  source: string;
  resolved_source: string;
  resolved_ref?: string;
  entrypoint: string;
  description?: string;
  category?: string;
  tags: string[];
  integrity: string;
  installed_path: string;
  installed_at: string;
  requires: {
    skills: string[];
    tools: string[];
    files: string[];
  };
}

export interface SkillflowLock {
  lockfile_version: 1;
  manifest: {
    name: string;
    version: string;
    description: string;
  };
  generated_at: string;
  skills: SkillLockEntry[];
}

export interface SkillDocument {
  frontmatter: Record<string, unknown>;
  body: string;
}
