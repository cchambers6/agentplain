// Citation registry — every rule the pack states as Mason's resolves here.
//
// Provenance discipline (Truth Wave): every quote below was verified verbatim
// against the AmblesideOnline hosted texts of the Home Education Series
// (https://www.amblesideonline.org/cm/vol1 … vol6, which carry the original
// edition's page markers inline) or against the named PNEU primary sources.
// Quotes are 1–2 sentences, public domain (Mason d. 1923; PNEU printed
// matter of the same era). Where a common formulation goes beyond what the
// passage literally says, the `note` field says so — see also
// interpretation_notes in index.ts for the modern-application calls.
//
// AO's hosted text drops most original page numbers outside inline "vol N
// pg N" markers; page_range is given where a marker anchors the passage and
// null where the hosted text carries none at that point.
import type { Citation, CitationId } from "./types";

const VOL1 = "https://www.amblesideonline.org/cm/vol1";
const VOL3 = "https://www.amblesideonline.org/cm/vol3";
const VOL5 = "https://www.amblesideonline.org/cm/vol5";
const VOL6 = "https://www.amblesideonline.org/cm/vol6";
const PNEU_TIMETABLES =
  "https://charlottemasonpoetry.org/parents-union-school-time-tables/";
const PNEU_EXAMS =
  "https://charlottemasonpoetry.org/examinations-and-the-pneu/";

export const citations: Citation[] = [
  // ── Volume I: Home Education (1886) ────────────────────────────────────
  {
    id: "vol1-lessons-at-six",
    rule_refs: ["lesson_shape.max_block_minutes_by_age"],
    source: "Home Education",
    volume: 1,
    chapter: "Part II 'Out-of-Door Life for the Children', §I 'A Growing Time'",
    page_range: "p. 43",
    quote:
      "perhaps a mother's first duty to her children is to secure for them a quiet growing time, a full six years of passive receptive life, the waking part of it spent for the most part out in the fresh air.",
    url: VOL1,
    basis: "mason",
    note:
      "Grounds the 0-minutes cap at age five: the first six years are out-of-door life and informal habit-forming, not scheduled lesson blocks.",
  },
  {
    id: "vol1-short-lessons",
    rule_refs: [
      "lesson_shape.max_block_minutes_by_age",
      "good_day_definition",
      "daily_rhythm.ordering_rules",
    ],
    source: "Home Education",
    volume: 1,
    chapter: "Part IV, §I 'The Habit of Attention'",
    page_range: "p. 142",
    quote:
      "Again, the lessons are short, seldom more than twenty minutes in length for children under eight; and this, for two or three reasons.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-attention-quality",
    rule_refs: ["good_day_definition", "narration.rules", "assessment.signals_of_drift"],
    source: "Home Education",
    volume: 1,
    chapter: "Part IV, §I 'The Habit of Attention'",
    page_range: "p. 142",
    quote:
      "The sense that there is not much time for his sums or his reading, keeps the child's wits on the alert and helps to fix his attention.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-habit-of-attention",
    rule_refs: [
      "first_principles",
      "habit_formation.starter_habits",
      "lesson_shape.variety_rule",
    ],
    source: "Home Education",
    volume: 1,
    chapter: "Part IV, §I 'The Habit of Attention'",
    page_range: "p. 137",
    quote:
      "First, we put the habit of Attention, because the highest intellectual gifts depend for their value upon the measure in which their owner has cultivated the habit of attention.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-habit-ten-natures",
    rule_refs: ["habit_formation.principle", "assessment.triad_explained.discipline"],
    source: "Home Education",
    volume: 1,
    chapter: "Part III 'Habit Is Ten Natures', §I 'Education Based Upon Natural Law'",
    page_range: "p. 97",
    quote:
      "How habit, in the hands of the mother, is as his wheel to the potter, his knife to the carver—the instrument by means of which she turns out the design she has already conceived in her brain.",
    url: VOL1,
    basis: "mason",
    note:
      "The proverb 'Habit is ten natures' itself is one Mason reports hearing preached (p. 98) and adopts as a working maxim; this passage is her own statement of the doctrine.",
  },
  {
    id: "vol1-one-habit-at-a-time",
    rule_refs: ["habit_formation.method", "weekly_rhythms", "assessment.signals_of_drift"],
    source: "Home Education",
    volume: 1,
    chapter: "Part III 'Habit Is Ten Natures', §IX (closing pages)",
    page_range: "p. 136",
    quote:
      "The mother devotes herself to the formation of one habit at a time, doing no more than keep watch over those already formed.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-habit-few-weeks",
    rule_refs: ["habit_formation.duration"],
    source: "Home Education",
    volume: 1,
    chapter: "Part III, §VII 'The Forming of a Habit—‘Shut the Door After You’'",
    page_range: "p. 121",
    quote:
      "To form a good habit is the work of a few weeks; to guard it is a work of incessant, but by no means anxious care.",
    url: VOL1,
    basis: "mason",
    note:
      "Mason names no fixed number of weeks; the pack's six-week planning default is a labeled modern application (see interpretation_notes).",
  },
  {
    id: "vol1-habit-tact-not-nagging",
    rule_refs: ["habit_formation.method"],
    source: "Home Education",
    volume: 1,
    chapter: "Part III, §VII 'The Forming of a Habit—‘Shut the Door After You’'",
    page_range: "p. 122",
    quote:
      "Tact, watchfulness, and persistence are the qualities she must cultivate in herself; and, with these, she will be astonished at the readiness with which the child picks up the new habit.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-art-of-narrating",
    rule_refs: ["narration.rules", "narration.quality_signals", "assessment.signals_of_health"],
    source: "Home Education",
    volume: 1,
    chapter: "Part V, §IX 'The Art of Narrating'",
    page_range: "p. 231",
    quote:
      "Narrating is an art, like poetry-making or painting, because it is there, in every child's mind, waiting to be discovered, and is not the result of any process of disciplinary education.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-narration-from-six",
    rule_refs: ["narration.rules"],
    source: "Home Education",
    volume: 1,
    chapter: "Part V, §IX 'The Art of Narrating'",
    page_range: "p. 231",
    quote:
      "Until he is six, let Bobbie narrate only when and what he has a mind to. He must not be called upon to tell anything.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-single-reading",
    rule_refs: ["narration.rules", "living_books.criteria", "assessment.signals_of_drift"],
    source: "Home Education",
    volume: 1,
    chapter: "Part V, §VIII (on reading; 'Slipshod Habits; Inattention')",
    page_range: "pp. 229–230",
    quote:
      "If a child is not able to narrate what he has read once, let him not get the notion that he may, or that he must, read it again.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-copywork-perfect-letters",
    rule_refs: ["lesson_shape.stage_notes.grammar", "habit_formation.starter_habits"],
    source: "Home Education",
    volume: 1,
    chapter: "Part IV, on the habit of perfect execution",
    page_range: "p. 160",
    quote:
      "Set him six strokes to copy; let him, not bring a slateful, but six perfect strokes, at regular distances and at regular slopes.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-dictation",
    rule_refs: ["lesson_shape.stage_notes.logic"],
    source: "Home Education",
    volume: 1,
    chapter: "Part V, §XII 'Spelling and Dictation' ('Steps of a Dictation Lesson')",
    page_range: "pp. 241–242",
    quote:
      "Dictation lessons, conducted in some such way as the following, usually result in good spelling. A child of eight or nine prepares a paragraph, older children a page, or two or three pages.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-twaddle",
    rule_refs: ["living_books.criteria", "living_books.twaddle_signals"],
    source: "Home Education",
    volume: 1,
    chapter: "Part V 'Lessons as Instruments of Education' (on children's books)",
    page_range: "p. 176",
    quote:
      "had his reading been the sort of diluted twaddle which is commonly thrust upon children, it would have been impossible for him to cite passages a week, much less some two score years, after the reading.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-out-of-doors",
    rule_refs: ["nature_study.weekly_walk", "nature_study.daily_outdoor_time", "weekly_rhythms"],
    source: "Home Education",
    volume: 1,
    chapter: "Part II 'Out-of-Door Life for the Children', §I 'A Growing Time'",
    page_range: "p. 42",
    quote:
      "They who know what it is to have fevered skin and throbbing brain deliciously soothed by the cool touch of the air are inclined to make a new rule of life, Never be within doors when you can rightly be without.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-outdoor-hours",
    rule_refs: ["nature_study.daily_outdoor_time", "assessment.signals_of_health"],
    source: "Home Education",
    volume: 1,
    chapter: "Part II, §I 'A Growing Time' ('Possibilities of a Day in the Open')",
    page_range: "p. 44",
    quote:
      "And long hours they should be; not two, but four, five, or six hours they should have on every tolerably fine day, from April till October.",
    url: VOL1,
    basis: "mason",
  },
  {
    id: "vol1-winter-walks",
    rule_refs: ["nature_study.daily_outdoor_time", "weekly_rhythms"],
    source: "Home Education",
    volume: 1,
    chapter: "Part II, §XII 'Walks in Bad Weather'",
    page_range: "pp. 85–86",
    quote:
      "Winter walks, too, whether in town or country, give great opportunities for cultivating the habit of attention.",
    url: VOL1,
    basis: "mason",
    note:
      "The section opens by arguing winter and wet-weather outings are 'really more important' than summer ones (p. 85).",
  },
  {
    id: "vol1-sight-seeing",
    rule_refs: ["nature_study.observation_games", "nature_study.weekly_walk"],
    source: "Home Education",
    volume: 1,
    chapter: "Part II, §II 'Sight-Seeing'",
    page_range: "pp. 45–46",
    quote:
      "while wits are fresh and eyes are keen, she sends them off on an exploring expedition—Who can see the most, and tell the most, about yonder hillock?",
    url: VOL1,
    basis: "mason",
    note:
      "The companion 'picture-painting' exercise (describing a scene from memory with eyes shut) follows in §III.",
  },
  {
    id: "vol1-nature-notebook",
    rule_refs: ["nature_study.nature_notebook", "assessment.signals_of_health", "weekly_rhythms"],
    source: "Home Education",
    volume: 1,
    chapter: "Part II, §III ('Nature Diaries')",
    page_range: "pp. 54–55",
    quote:
      "As soon as he is able to keep it himself, a nature-diary is a source of delight to a child. Every day's walk gives him something to enter.",
    url: VOL1,
    basis: "mason",
    note:
      "The never-graded rule is hers too: 'his nature diary should be left to his own initiative' (p. 55). The same pages name brush-drawing paper as the notebook's medium.",
  },
  {
    id: "vol1-handicraft-points",
    rule_refs: ["handicrafts.principles", "weekly_rhythms"],
    source: "Home Education",
    volume: 1,
    chapter: "Part V (closing section, 'Handicrafts and Drills')",
    page_range: "pp. 315–316",
    quote:
      "(a) that they should not be employed in making futilities such as pea and stick work, paper mats, and the like; (b) that they should be taught slowly and carefully what they are to do; (c) that slipshod work should not be allowed; (d) and that, therefore, the children's work should be kept well within their compass.",
    url: VOL1,
    basis: "mason",
  },

  // ── Volume III: School Education (1904) ────────────────────────────────
  {
    id: "vol3-atmosphere",
    rule_refs: ["first_principles"],
    source: "School Education",
    volume: 3,
    chapter: "Ch. 14 'A Master-Thought'",
    page_range: "p. 148",
    quote:
      "Some of my readers will know the Parents' Union motto, 'Education is an atmosphere, a discipline, a life,' especially well in the neat diagrammatic form in which it appears on the covers of our Library books.",
    url: VOL3,
    basis: "mason",
  },
  {
    id: "vol3-wide-curriculum",
    rule_refs: ["first_principles"],
    source: "School Education",
    volume: 3,
    chapter: "Ch. 22 'Suggestions Toward a Curriculum, Pt III'",
    page_range: "p. 246",
    quote:
      "the essential step in any reform of public schools should come in the shape of due preparation upon a wide curriculum, dealt with intelligently, between the ages of six and twelve.",
    url: VOL3,
    basis: "mason",
  },

  // ── Volume V: Formation of Character (1906) ────────────────────────────
  {
    id: "vol5-habit-case",
    rule_refs: ["habit_formation.parent_role"],
    source: "Formation of Character",
    volume: 5,
    chapter: "Part I, §IV 'Dorothy Elmore's Achievement'",
    page_range: "p. 61",
    quote:
      "a contrary habit is set up, diverting the thoughts into some quite new channel. Keep the thoughts running briskly in the new channel, and, behold, the old connections are broken.",
    url: VOL5,
    basis: "mason",
    note:
      "Vol V's case narratives show the parent as the habit's keeper in practice: the cure runs on the mother's watchful diversion, not on scolding after the fact.",
  },

  // ── Volume VI: Towards a Philosophy of Education (1923) ────────────────
  {
    id: "vol6-born-persons",
    rule_refs: ["first_principles"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 1 'Self-Education'",
    page_range: "p. 29",
    quote:
      "\"Children are born persons,\" is the first article of the educational credo in question.",
    url: VOL6,
    basis: "mason",
    note: "Also principle 1 of the volume's opening 'Short Synopsis'.",
  },
  {
    id: "vol6-atmosphere-discipline-life",
    rule_refs: ["first_principles", "assessment.triad", "assessment.triad_explained"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 6 'Three Instruments of Education'",
    page_range: "p. 94",
    quote:
      "we can allow ourselves but three educational instruments—the atmosphere of environment, the discipline of habit and the presentation of living ideas. Our motto is,—'Education is an atmosphere, a discipline, a life.'",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-no-child-environment",
    rule_refs: ["assessment.triad_explained.atmosphere"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 6 'Three Instruments of Education'",
    page_range: "p. 94",
    quote:
      "we do not mean that a child should be isolated in what may be called a 'child environment' specially adapted and prepared. It stultifies a child to bring down his world to the 'child's' level.",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-mind-feeds-on-ideas",
    rule_refs: ["first_principles", "living_books.criteria"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 6 'Three Instruments of Education'",
    page_range: "pp. 111–112",
    quote:
      "The mind feeds on ideas and therefore children should have a generous curriculum.",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-literary-form",
    rule_refs: ["living_books.criteria"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Introduction",
    page_range: "p. 15",
    quote:
      "it has a natural preference for literary form; given a more or less literary presentation, the curiosity of the mind is enormous and embraces a vast variety of subjects.",
    url: VOL6,
    basis: "mason",
    note: "'It' is 'the mind' — Mason is summarizing what her school results showed about all children's minds.",
  },
  {
    id: "vol6-textbook-criticism",
    rule_refs: ["living_books.criteria", "living_books.twaddle_signals"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book II, Ch. 2 'A Liberal Education in Secondary Schools'",
    page_range: "pp. 271–272",
    quote:
      "confine ourselves as far as possible to works with the imaginative grasp, the touch of originality, which distinguish a book from a text-book.",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-act-of-knowing",
    rule_refs: ["narration.rules", "living_books.twaddle_signals", "assessment.signals_of_health"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book II, Ch. 2 'A Liberal Education in Secondary Schools'",
    page_range: "p. 271",
    quote:
      "information does not become knowledge unless a child perform the 'act of knowing' without the intervention of another personality.",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-self-education",
    rule_refs: ["first_principles"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 1 'Self-Education'",
    page_range: "p. 26",
    quote:
      "therefore, there is no education but self-education, and as soon as a young child begins his education he does so as a student. Our business is to give him mind-stuff, and both quality and quantity are essential.",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-science-of-relations",
    rule_refs: ["first_principles", "assessment.signals_of_health"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 10 'The Curriculum'",
    page_range: "p. 154",
    quote:
      "'Education is the Science of Relations'; that is, a child has natural relations with a vast number of things and thoughts: so we train him upon physical exercises, nature lore, handicrafts, science and art, and upon many living books, for we know that our business is not to teach him all about anything.",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-way-of-will",
    rule_refs: ["first_principles"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 8 'The Way of the Will'",
    page_range: "p. 128",
    quote:
      "We may offer to children two guides to moral and intellectual self-management which we may call 'the Way of the Will' and 'the Way of the Reason.'",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-written-narration",
    rule_refs: ["narration.rules", "lesson_shape.stage_notes.logic"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "'A Short Synopsis' (principle 14) and Book I, Ch. 10",
    page_range: "p. xxx (synopsis); p. 182",
    quote:
      "As knowledge is not assimilated until it is reproduced, children should 'tell back' after a single reading or hearing: or should write on some part of what they have read.",
    url: VOL6,
    basis: "mason",
    note:
      "The oral-first boundary is hers too: Form I books are 'narrated by them until they are well in their tenth year' (p. 182); written narration grows from there.",
  },
  {
    id: "vol6-exams-by-narration",
    rule_refs: ["assessment.exam_practice", "daily_rhythm.term_structure"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Introduction",
    page_range: "p. 6",
    quote:
      "the reading is tested by narration, or by writing on a test passage. When the terminal examination is at hand so much ground has been covered that revision is out of the question; what the children have read they know.",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-no-prizes",
    rule_refs: ["living_books.twaddle_signals", "assessment.signals_of_drift"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Introduction (results summary, item h)",
    page_range: "p. 7",
    quote:
      "Marks, prizes, places, rewards, punishments, praise, blame, or other inducements are not necessary to secure attention, which is voluntary, immediate and surprisingly perfect.",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-picture-study",
    rule_refs: ["weekly_rhythms"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 10 'The Curriculum', Section III (Art)",
    page_range: "p. 214",
    quote:
      "the little pictures are studied one at a time; that is, children learn, not merely to see a picture but to look at it, taking in every detail. Then the picture is turned over and the children tell what they have seen.",
    url: VOL6,
    basis: "mason",
    note:
      "One artist per term is on the same page: 'reproductions of the work of some single artist, term by term.'",
  },
  {
    id: "vol6-composer-study",
    rule_refs: ["weekly_rhythms"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 10, 'Musical Appreciation' (Mrs. Glover, quoted by Mason)",
    page_range: "pp. 217–218",
    quote:
      "Musical Appreciation, of course, has nothing to do with playing the piano.",
    url: VOL6,
    basis: "mason",
    note:
      "The one-composer-per-term formula is programme practice, stated verbatim in a Parents' Review account of a PNEU school: 'The P.N.E.U. curriculum has one of the great composers down for study each term' (Moore, 'Examinations and the P.N.E.U.', hosted at charlottemasonpoetry.org).",
  },
  {
    id: "vol6-shakespeare",
    rule_refs: ["weekly_rhythms"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 10 'The Curriculum', Section II (Literature)",
    page_range: "p. 182",
    quote:
      "Their power to understand, visualise, and 'tell' a play of Shakespeare from nine years old and onwards is very surprising.",
    url: VOL6,
    basis: "mason",
    note:
      "Grounds the pack's Shakespeare-from-Form-II placement (real text from ~9; retellings before that).",
  },
  {
    id: "vol6-afternoon-work",
    rule_refs: ["daily_rhythm.morning_lessons_only", "daily_rhythm.afternoon"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Introduction",
    page_range: "p. 9",
    quote:
      "All intellectual work is done in the hours of morning school, and the afternoons are given to field nature studies, drawing, handicrafts, etc.",
    url: VOL6,
    basis: "mason",
  },
  {
    id: "vol6-bible",
    rule_refs: ["lesson_shape.subject_order"],
    source: "Towards a Philosophy of Education",
    volume: 6,
    chapter: "Book I, Ch. 10 'The Curriculum', Section I 'The Knowledge of God'",
    page_range: "p. 158",
    quote:
      "Of the three sorts of knowledge proper to a child, the knowledge of God, of man, and of the universe,—the knowledge of God ranks first in importance, is indispensable, and most happy-making.",
    url: VOL6,
    basis: "mason",
    note:
      "The PNEU time-tables place the Bible lesson in the opening 9.0–9.20 block on most days, matching this ranking in practice.",
  },

  // ── PNEU Parents' Union School practice (printed time-tables etc.) ─────
  {
    id: "pneu-start-times",
    rule_refs: ["daily_rhythm.school_start", "daily_rhythm.morning_end_by_stage"],
    source:
      "PNEU Parents' Union School time-tables (Franklin 1900/1908; 'A Liberal Education for All', PNEU 1928)",
    volume: null,
    chapter: "Printed time-tables, Forms I–VI",
    page_range: null,
    quote:
      "Form I's printed table opens '9.0—9.20, Old Testament' and its last row is '11.20—11.30'; Form II runs to '11.30—12.0'; Forms III–IV to '12.15—12.45'; Forms V–VI to '12.15—1.0'.",
    url: PNEU_TIMETABLES,
    basis: "pneu-practice",
    note:
      "The quoted times are verbatim table cells from the harmonized PUS time-tables; the pack's per-stage morning-end estimates round these printed end times.",
  },
  {
    id: "pneu-lesson-lengths",
    rule_refs: ["lesson_shape.max_block_minutes_by_age", "lesson_shape.forms", "weekly_rhythms"],
    source:
      "The Parents' Review, 'Examinations and the P.N.E.U.' (A. V. C. Moore, Wavertree PNEU Preparatory School), with the printed PUS time-tables",
    volume: null,
    chapter: "PR article; printed time-tables, Forms I–VI",
    page_range: null,
    quote:
      "The answer is that the periods of work are short, never longer than half an hour.",
    url: PNEU_EXAMS,
    basis: "pneu-practice",
    note:
      "The printed tables give the per-Form bands the pack interpolates: Form I blocks of 10–20 min ('9.0—9.20', '11.10—11.20'), Form II arithmetic '9.20—9.50', Forms V–VI blocks up to 45 min ('11.0—11.45'). See parents-union-school-time-tables at the same site.",
  },
  {
    id: "pneu-alternation",
    rule_refs: ["lesson_shape.variety_rule", "daily_rhythm.ordering_rules", "weekly_rhythms"],
    source: "Home Education (doctrine); PNEU time-tables (printed practice)",
    volume: 1,
    chapter: "Part IV, §I 'The Habit of Attention'",
    page_range: "p. 142",
    quote:
      "if the lessons be judiciously alternated—sums first, say, while the brain is quite fresh; then writing, or reading—some more or less mechanical exercise, by way of a rest… a 'thinking' lesson first, and a 'painstaking' lesson to follow.",
    url: VOL1,
    basis: "mason",
    note:
      "The printed Form I table embodies it: Number at 10.0–10.20 is followed by Drill or Dancing at 10.20–10.35, then Play or Drill, before the next book lesson (parents-union-school-time-tables, charlottemasonpoetry.org).",
  },
  {
    id: "pneu-afternoons",
    rule_refs: ["daily_rhythm.afternoon", "good_day_definition", "assessment.signals_of_health"],
    source:
      "PNEU Parents' Union School time-tables; Towards a Philosophy of Education",
    volume: 6,
    chapter: "Printed time-tables (no afternoon blocks); Vol VI Introduction",
    page_range: "p. 9",
    quote:
      "All intellectual work is done in the hours of morning school, and the afternoons are given to field nature studies, drawing, handicrafts, etc.",
    url: PNEU_TIMETABLES,
    basis: "pneu-practice",
    note:
      "No form's printed table contains any block after the midday close (11.30 for Form I, 1.0 for Forms V–VI); the quote is Mason describing that same school practice in Vol VI.",
  },
  {
    id: "pneu-handicrafts-named",
    rule_refs: ["handicrafts.age_appropriate"],
    source: "Home Education (named crafts); PNEU time-tables (standing Handicrafts and Sloyd slots)",
    volume: 1,
    chapter: "Part V (closing section, 'Handicrafts and Drills')",
    page_range: "p. 315",
    quote:
      "The Handicrafts best fitted for children under nine seem to me to be chair-caning, carton-work, basket-work, Smyrna rugs, Japanese curtains, carving in cork, samplers on coarse canvas showing a variety of stitches, easy needlework, knitting (big needles and wool), etc.",
    url: VOL1,
    basis: "mason",
    note:
      "The printed Form I table carries standing Handicrafts blocks (e.g. 10.0–10.20), and cardboard sloyd appears in PUS practice; the pack's exact age ladder is a labeled modern application.",
  },
  {
    id: "pneu-forms-ages",
    rule_refs: ["lesson_shape.forms", "lesson_shape.stage_notes"],
    source:
      "PUS Form structure (editorial correspondence table in the AmblesideOnline hosted Vol VI; age ranges per PUS programmes)",
    volume: null,
    chapter: "Hosted Vol VI, editorial note at p. 218",
    page_range: null,
    quote:
      "Form I (roughly grades 1-3): IB (age 6), IA (age 7-9). Form II (roughly grades 4-6): IIB (age 9), IIA (age 10-12). Form III and IV (roughly grades 7-9). Form V and VI (roughly grades 10-12).",
    url: VOL6,
    basis: "pneu-practice",
    note:
      "The quote is AmblesideOnline's editorial gloss embedded in the hosted text, not Mason's prose; the underlying age bands match those printed in the PUS programmes (cf. the source notes on the charlottemasonpoetry time-tables page).",
  },
  {
    id: "terms-three-per-year",
    rule_refs: ["daily_rhythm.term_structure", "scheduling_notes"],
    source:
      "PUS Programme 94 (printed programme, Armitt Collection scan, Internet Archive)",
    volume: null,
    chapter: "Programme cover, autumn term 1922",
    page_range: null,
    quote:
      "Programme 094 and Examination. Parents' National Educational Union. The Parents' Union School. September to December, 1922. (January to March, 1923, in the Dominions.)",
    url: "https://archive.org/details/BoxCM14FileCMC96p094",
    basis: "pneu-practice",
    note:
      "Three terms a year follows from the numbering: PUS Term 1 programmes date to 1892 (AmblesideOnline's PNEU programme index), so 94 programmes across ~31 school years is exactly three per year; the September-to-December span shows the ~12-week term length.",
  },
];

const byId = new Map<CitationId, Citation>(citations.map((c) => [c.id, c]));

/** Look up the citations behind a pack rule, for reasoning traces. */
export function citationsForRule(ruleRef: string): Citation[] {
  return citations.filter((c) =>
    c.rule_refs.some((r) => r === ruleRef || ruleRef.startsWith(`${r}.`) || ruleRef.startsWith(`${r}[`))
  );
}

/** Resolve one citation id; throws on unknown id so bad references fail loudly. */
export function citationById(id: CitationId): Citation {
  const c = byId.get(id);
  if (!c) throw new Error(`unknown citation id: ${id}`);
  return c;
}
