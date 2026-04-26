import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdtemp, cp } from "node:fs/promises";
import os from "node:os";
import { captureDraft } from "../src/lastmile/store.js";
import { learnFromFinal } from "../src/lastmile/learn.js";
import { renderCandidates, renderOverlay } from "../src/lastmile/suggest.js";

async function fixtureProject(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "skillflow-lastmile-"));
  await cp(path.resolve("fixtures"), path.join(root, "fixtures"), { recursive: true });
  return root;
}

describe("last-mile learning", () => {
  it("captures a draft and extracts reusable edit patterns", async () => {
    const root = await fixtureProject();
    const draft = path.join(root, "fixtures/project-output/draft.md");
    const final = path.join(root, "fixtures/project-output/final.md");
    const snapshot = await captureDraft(root, "summarize", draft, "launch review");
    const result = await learnFromFinal(root, "summarize", final, snapshot.id);
    expect(result.newPatterns).toBeGreaterThan(0);
    const markdown = renderCandidates("summarize", result.patterns, 1, 0);
    expect(markdown).toContain("Last-mile improvement candidates");
    const approved = result.patterns.map((pattern, index) => ({ ...pattern, approved: index === 0 }));
    const overlay = renderOverlay("summarize", approved, "personal", 1, 0);
    expect(overlay).not.toContain("No approved learned preferences");
  });
});
