import { diffLines, diffWords } from "diff";
import { shortHash } from "../core/hash.js";
import type { LearnedPattern, Snapshot } from "./types.js";

interface Candidate {
  kind: LearnedPattern["kind"];
  summary: string;
  before?: string;
  after?: string;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function excerpt(text: string, length = 160): string {
  const value = clean(text);
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function addedLineText(lines: string[]): string {
  return lines.map((line) => line.trim()).filter(Boolean).join(" ");
}

function classifyStructure(removed: string[], added: string[]): Candidate | undefined {
  const addedBullets = added.filter((line) => /^\s*([-*]|\d+\.)\s+/.test(line)).length;
  const removedBullets = removed.filter((line) => /^\s*([-*]|\d+\.)\s+/.test(line)).length;
  if (addedBullets >= 2 && addedBullets > removedBullets) {
    return {
      kind: "structure",
      summary: "Human converted prose into scannable bullets or numbered steps.",
      before: excerpt(removed.join("\n")),
      after: excerpt(added.join("\n")),
    };
  }

  const addedTables = added.filter((line) => line.includes("|")).length;
  const removedTables = removed.filter((line) => line.includes("|")).length;
  if (addedTables >= 2 && addedTables > removedTables) {
    return {
      kind: "structure",
      summary: "Human converted content into a table for easier scanning.",
      before: excerpt(removed.join("\n")),
      after: excerpt(added.join("\n")),
    };
  }

  return undefined;
}

function phraseCandidates(before: string, after: string): Candidate[] {
  const candidates: Candidate[] = [];
  const changes = diffWords(before, after);
  for (let index = 0; index < changes.length - 1; index += 1) {
    const current = changes[index];
    const next = changes[index + 1];
    if (current?.removed && next?.added) {
      const removed = clean(current.value);
      const added = clean(next.value);
      if (removed.length >= 4 && added.length >= 4 && removed.length <= 120 && added.length <= 120) {
        candidates.push({
          kind: "phrase-replacement",
          summary: `Human replaced "${excerpt(removed, 60)}" with "${excerpt(added, 60)}".`,
          before: removed,
          after: added,
        });
      }
    }
  }
  return candidates.slice(0, 8);
}

export function extractCandidates(snapshot: Snapshot, finalContent: string): Candidate[] {
  const candidates: Candidate[] = [];
  const lineParts = diffLines(snapshot.content, finalContent);

  for (let index = 0; index < lineParts.length; index += 1) {
    const removedPart = lineParts[index];
    const addedPart = lineParts[index + 1];
    if (removedPart?.removed && addedPart?.added) {
      const removedLines = removedPart.value.split(/\r?\n/).filter(Boolean);
      const addedLines = addedPart.value.split(/\r?\n/).filter(Boolean);
      const structure = classifyStructure(removedLines, addedLines);
      if (structure) candidates.push(structure);

      const before = removedLines.join("\n");
      const after = addedLines.join("\n");
      if (clean(before).length >= 8 && clean(after).length >= 8) {
        candidates.push({
          kind: "line-replacement",
          summary: `Human rewrote "${excerpt(before, 70)}" as "${excerpt(after, 70)}".`,
          before: excerpt(before),
          after: excerpt(after),
        });
        candidates.push(...phraseCandidates(before, after));
      }
    }

    if (removedPart?.removed && !addedPart?.added) {
      const removed = excerpt(removedPart.value);
      if (removed.length >= 20) {
        candidates.push({
          kind: "removal",
          summary: `Human removed content like "${excerpt(removed, 80)}".`,
          before: removed,
        });
      }
    }

    if (removedPart?.added) {
      const addedLines = removedPart.value.split(/\r?\n/).filter(Boolean);
      const addedText = addedLineText(addedLines);
      if (addedText.length >= 20) {
        candidates.push({
          kind: "addition",
          summary: `Human added content like "${excerpt(addedText, 80)}".`,
          after: excerpt(addedText),
        });
      }
    }
  }

  const originalLength = clean(snapshot.content).length;
  const finalLength = clean(finalContent).length;
  if (originalLength > 200 && finalLength > 0) {
    const ratio = finalLength / originalLength;
    if (ratio <= 0.72) {
      candidates.push({
        kind: "length",
        summary: "Human substantially condensed the AI draft.",
        before: `${originalLength} chars`,
        after: `${finalLength} chars`,
      });
    } else if (ratio >= 1.35) {
      candidates.push({
        kind: "length",
        summary: "Human substantially expanded the AI draft with added detail.",
        before: `${originalLength} chars`,
        after: `${finalLength} chars`,
      });
    }
  }

  const unique = new Map<string, Candidate>();
  for (const candidate of candidates) {
    unique.set(shortHash(`${candidate.kind}:${candidate.summary}:${candidate.before ?? ""}:${candidate.after ?? ""}`), candidate);
  }
  return [...unique.values()];
}

export function patternId(skill: string, candidate: Candidate): string {
  return shortHash(`${skill}:${candidate.kind}:${candidate.summary}:${candidate.before ?? ""}:${candidate.after ?? ""}`);
}
