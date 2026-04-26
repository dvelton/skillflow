export class SkillflowError extends Error {
  constructor(
    message: string,
    public readonly code = "SKILLFLOW_ERROR",
  ) {
    super(message);
    this.name = "SkillflowError";
  }
}

export function assertDefined<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) {
    throw new SkillflowError(message);
  }
  return value;
}
