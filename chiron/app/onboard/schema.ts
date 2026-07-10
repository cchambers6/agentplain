import { z } from "zod";

export const familySchema = z.object({
  parentName: z.string().min(1, "Your name is required"),
  state: z.string().length(2).default("GA"),
  timezone: z.string().min(1).default("America/New_York"),
});

export const childSchema = z.object({
  name: z.string().min(1, "Child's name is required"),
  birthdate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date")
    .refine(
      (s) => Date.parse(s) < Date.now(),
      "Birthdate must be in the past",
    ),
});

export const philosophySchema = z.object({
  philosophy: z.enum([
    "charlotte_mason",
    "classical_trivium",
    "circe",
    "memoria",
  ]),
});

export const schoolDaysSchema = z.object({
  // ISO weekday numbers, Mon=1 … Sun=7
  schoolDays: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one day"),
});

export const goalsSchema = z.object({
  goals: z.string().min(1, "A sentence or two is plenty"),
});

export const curriculumEntrySchema = z.object({
  name: z.string().min(1, "Name is required"),
  publisher: z.string().optional().default(""),
  subjects: z.string().min(1, "At least one subject"), // comma-separated in the form
  catalogId: z.string().nullable().optional(),
  parentNotes: z.string().optional().default(""),
});

export const curriculaSchema = z.object({
  curricula: z.array(curriculumEntrySchema).min(2, "Enter at least two").max(3),
});

export const onboardingSchema = familySchema
  .merge(childSchema)
  .merge(philosophySchema)
  .merge(schoolDaysSchema)
  .merge(goalsSchema)
  .merge(curriculaSchema);

export type OnboardingPayload = z.infer<typeof onboardingSchema>;
