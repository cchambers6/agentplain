// Types for the Charlotte Mason philosophy pack.
//
// Two provenance rules govern every field in this pack:
//   1. Anything stated as Mason's own rule carries a citation id resolving to
//      a real passage in the public-domain Home Education Series (vols I–VI)
//      or the original PNEU Parents' Union School timetables. Quotes are short
//      (1–2 sentences) — never full paragraphs.
//   2. Anything that is OUR modern application of her method (mapping Forms to
//      the app's grammar/logic/rhetoric stages, minute-caps for ages she never
//      named, etc.) is labeled `basis: "modern-application"` so agents can say
//      so in their reasoning traces instead of claiming "Mason said X."
import type { Stage } from "../../stages";

export type CitationId = string;

/** Where a rule comes from. Agents surface this in reasoning traces. */
export type RuleBasis =
  | "mason" // her own words in the Home Education Series
  | "pneu-practice" // the original PNEU school timetables / programmes
  | "modern-application"; // our extrapolation, labeled as such

export interface CoreText {
  title: string;
  volume_number: 1 | 2 | 3 | 4 | 5 | 6;
  year: number;
  public_domain: true;
  canonical_url: string;
}

export interface Citation {
  /** Stable id other modules reference, e.g. "vol1-short-lessons". */
  id: CitationId;
  /**
   * Dot-paths into the assembled pack that this citation grounds,
   * e.g. "lesson_shape.max_block_minutes_by_age". Verified by pack:verify.
   */
  rule_refs: string[];
  /** "Home Education" | ... | "PNEU Parents' Union School time-tables" */
  source: string;
  /** 1–6 for the Home Education Series; null for PNEU timetable material. */
  volume: 1 | 2 | 3 | 4 | 5 | 6 | null;
  chapter: string;
  /** Original-edition pages where known, e.g. "pp. 141–142"; null if the
   *  hosted text carries no page markers at that point. */
  page_range: string | null;
  /** Verbatim, 1–2 sentences max. Public domain. */
  quote: string;
  url: string;
  basis: Exclude<RuleBasis, "modern-application">;
  /** Precision caveats — e.g. where a common formulation goes beyond what
   *  this passage literally says. */
  note?: string;
}

/** A labeled modern-application call — where Mason is silent or ambiguous
 *  and we made a product decision. Never presented as her rule. */
export interface InterpretationNote {
  rule_ref: string;
  note: string;
}

export interface LessonShape {
  /** HARD cap per lesson block, minutes, by age in years. 0 = no formal
   *  scheduled lessons at this age. Integrator trims or rotates anything
   *  longer. */
  max_block_minutes_by_age: Record<number, number>;
  variety_rule: string;
  /** Canonical morning ordering constraint, expressed as subject kinds. */
  subject_order: SubjectOrderEntry[];
  stage_notes: Record<Stage, string>;
  /** Mason's Forms with age bands, for parent-facing explanation. */
  forms: FormNote[];
}

export interface SubjectOrderEntry {
  slot: number;
  kind: "disciplinary" | "inspirational" | "physical";
  examples: string[];
  note: string;
}

export interface FormNote {
  form: string;
  ages: string;
  app_stage: Stage;
  typical_lesson_minutes: string;
}

export interface NarrationSpec {
  /** End-of-block interaction style. The Tutor-Advisor reads this. */
  grammar_stage_prompt: string;
  logic_stage_prompt: string;
  rhetoric_stage_prompt: string;
  /** What a good telling-back looks like — Child.model update extraction
   *  reads these. */
  quality_signals: string[];
  anti_signals: string[];
  rules: NarrationRule[];
}

export interface NarrationRule {
  rule: string;
  basis: RuleBasis;
  cite: CitationId[];
}

export interface WeeklyRhythm {
  activity:
    | "nature_walk"
    | "picture_study"
    | "composer_study"
    | "hymn_study"
    | "shakespeare"
    | "poetry_recitation"
    | "handicrafts"
    | "habit_training_focus";
  label: string;
  cadence: string;
  typical_day: string | null;
  duration: string | null;
  applies_from: Stage; // earliest app stage it applies to
  technique: string;
  cite: CitationId[];
}

export interface DailyRhythm {
  morning_lessons_only: boolean;
  school_start: string;
  morning_end_by_stage: Record<Stage, string>;
  afternoon: string;
  term_structure: string;
  ordering_rules: string[];
}

export interface LivingBooksSpec {
  criteria: CriterionEntry[];
  twaddle_signals: CriterionEntry[];
  /** Public-domain examples Mason's own schools used — safe to name. */
  qualifying_examples: string[];
  disqualified_shapes: string[];
}

export interface CriterionEntry {
  text: string;
  basis: RuleBasis;
  cite: CitationId[];
}

export interface NatureStudySpec {
  weekly_walk: {
    cadence: string;
    duration: string;
    parent_role: string;
    cite: CitationId[];
  };
  daily_outdoor_time: { rule: string; cite: CitationId[] };
  nature_notebook: {
    purpose: string;
    technique: string;
    materials: string[];
    never_graded: string;
    cite: CitationId[];
  };
  seasonal_focus: Record<"spring" | "summer" | "autumn" | "winter", string>;
  observation_games: { name: string; how: string; cite: CitationId[] }[];
  handbook: string;
}

export interface HandicraftsSpec {
  afternoon_practice: string;
  principles: CriterionEntry[];
  age_appropriate: Record<number, string[]>;
  cite: CitationId[];
}

export interface HabitFormationSpec {
  principle: string;
  duration: string;
  method: CriterionEntry[];
  starter_habits: { habit: string; why: string; cite: CitationId[] }[];
  parent_role: string;
  scheduling: string;
  cite: CitationId[];
}

export interface AssessmentSpec {
  triad: string;
  triad_explained: Record<"atmosphere" | "discipline" | "life", string>;
  signals_of_health: CriterionEntry[];
  signals_of_drift: CriterionEntry[];
  exam_practice: { rule: string; cite: CitationId[] };
  cite: CitationId[];
}

export interface CharlotteMasonPack {
  id: "charlotte-mason";
  name: "Charlotte Mason";
  founder: string;
  version: number;
  core_texts: CoreText[];
  /** The load-bearing principles, for Headmaster vision-framing. */
  first_principles: CriterionEntry[];
  lesson_shape: LessonShape;
  daily_question_style: "narration";
  narration: NarrationSpec;
  good_day_definition: string;
  weekly_rhythms: WeeklyRhythm[];
  daily_rhythm: DailyRhythm;
  scheduling_notes: string;
  living_books: LivingBooksSpec;
  nature_study: NatureStudySpec;
  handicrafts: HandicraftsSpec;
  habit_formation: HabitFormationSpec;
  assessment: AssessmentSpec;
  interpretation_notes: InterpretationNote[];
  citations: Citation[];
}
