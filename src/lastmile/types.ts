export interface Snapshot {
  id: string;
  skill: string;
  label?: string;
  sourcePath: string;
  capturedAt: string;
  contentHash: string;
  content: string;
}

export interface PatternExample {
  snapshotId: string;
  finalPath: string;
  before?: string;
  after?: string;
}

export interface LearnedPattern {
  id: string;
  skill: string;
  kind: "phrase-replacement" | "line-replacement" | "structure" | "length" | "addition" | "removal";
  summary: string;
  before?: string;
  after?: string;
  support: number;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  examples: PatternExample[];
  approved: boolean;
}

export interface LearnResult {
  snapshot: Snapshot;
  patterns: LearnedPattern[];
  newPatterns: number;
  reinforcedPatterns: number;
}
