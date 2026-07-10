// Trivium stage from age: grammar (≈K–4), logic (≈5–8), rhetoric (≈9–12).
export type Stage = "grammar" | "logic" | "rhetoric";

export function stageForBirthdate(birthdate: Date, on: Date = new Date()): Stage {
  const age =
    (on.getTime() - birthdate.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 10) return "grammar";
  if (age < 14) return "logic";
  return "rhetoric";
}
