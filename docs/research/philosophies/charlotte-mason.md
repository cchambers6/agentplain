# Charlotte Mason — Philosophy Pack (Chiron)

Machine-usable pack spec for the Charlotte Mason (CM) philosophy. All claims are grounded in
Mason's public-domain *Home Education* series (6 volumes, 1886–1923), hosted in full at
AmblesideOnline, and in the original PNEU (Parents' National Educational Union) school
timetables. Volume citations below use AmblesideOnline's hosted texts.

```yaml
pack:
  key: charlotte-mason
  version: 1
  # Mason: formal lessons begin at six; before that, children live an out-of-door
  # life and form habits informally (Home Education, Vol I, Parts II and V).
  formal_lessons_start_age: 6
  # Verified against Vol I ("lessons are short, seldom more than twenty minutes in
  # length for children under eight") and original PNEU Parents' Union School
  # timetables: Form I (ages ~6-9) lessons 10-20 min; Form II (~9-12) 20-30 min;
  # Forms III-IV (~12-15) 30-45 min; Forms V-VI average ~40 min.
  # 0 = no formal scheduled lesson blocks at this age.
  max_block_minutes_by_age:
    5: 0
    6: 15
    7: 20
    8: 20
    9: 20
    10: 30
    11: 30
    12: 30
    13: 40
    14: 45
    15: 45
    16: 45
  # PNEU timetables deliberately alternate kinds of effort: a disciplinary/abstract
  # subject (arithmetic, grammar, Latin) is followed by an inspirational or physical
  # one (poetry, singing, drill, drawing). Never schedule two abstract "brain-work"
  # subjects back-to-back for the same child.
  variety_rule: alternate disciplinary and inspirational subjects; no two abstract subjects back-to-back; interleave movement (drill, dancing, play) and hands-on work between book lessons
  prefer:
    - living-books        # whole, literary, author-with-a-passion books (Vol VI)
    - narration           # the child tells back after a single attentive reading (Vol I Part V; Vol VI)
    - nature-study        # daily outdoor observation, nature notebooks (Vol I Part II)
    - short-lessons       # attention trained by brevity + variety (Vol I Part V)
    - habit-formation     # "habit is ten natures" — education is a discipline (Vol I Part III)
    - first-hand-experience  # things before words; objects, places, specimens
    - copywork-dictation  # transcription then prepared dictation (Vol I Part V)
    - single-reading      # no re-reading crutch; attention is expected the first time
  avoid:
    - twaddle             # Mason's word for diluted, condescending children's books
    - dry-textbooks       # compendia of predigested facts, no literary life
    - excessive-workbooks # fill-in drill replaces the mind's own act of knowing
    - lectures            # teacher talk displacing the child's contact with sources
    - multiple-choice-drill  # recognition tasks instead of the child's own telling
    - rewards-and-prizes  # artificial stimulants; knowledge is its own reward (Vol VI)
    - long-lessons        # dawdling trains inattention (Vol I Part V)
  daily_question_style: narration   # "Tell back what you heard/read" — open retelling, never quizzing
  good_day_definition: A good day is one in which every short lesson got the child's full attention and ended with a genuine narration, and the child still had ample free afternoon hours outdoors — not one in which the most material was covered.
  weekly_rhythms:
    - nature-walk         # weekly long walk + daily outdoor time; nature notebook entries
    - picture-study       # one artist per term, one picture per week, studied then described
    - composer-study      # one composer per term, works listened to across the week
    - hymn-study          # hymn and folksong singing appear on PNEU timetables
    - handicrafts         # real, useful handwork held to adult standards of finish
    - bible-copywork      # daily Bible lesson + copywork/transcription in best hand
    - poetry-recitation   # daily repetition/recitation slots on PNEU timetables
  scheduling_notes: >
    Morning-only lessons: PNEU timetables start at 9:00; Form I finishes about 11:30,
    upper forms by about 1:00. Afternoons are reserved for outdoor life, handicrafts,
    and free play — never more book lessons. The school year runs in three terms of
    about twelve weeks each, ending in an exam week whose "exams" are narration
    prompts, not graded tests. Within a morning, order lessons so that reading/
    listening work, writing work, number work, and physical/musical work alternate.
```

## Core principles

Mason's final volume (*Towards a Philosophy of Education*, Vol VI, 1923) opens with a
synopsis of 20 principles. The first — "Children are born persons." — is the root of the
whole method: a child is not a blank slate or a bucket to fill, but a complete person with
an appetite for knowledge, entitled to real ideas and real books.

Load-bearing principles for an orchestrator:

1. **Children are born persons** (Principle 1, Vol VI synopsis). Respect for the child's
   mind rules out predigested pablum, manipulation by prizes, and busywork.
2. **Education is an atmosphere, a discipline, a life** (Principles 5–8, Vol VI synopsis).
   - *Atmosphere*: the child absorbs the real environment of the home — do not build a
     fake "child environment."
   - *Discipline*: the deliberate formation of habits — attention, obedience, truthfulness,
     perfect execution. Vol I Part III ("Habit Is Ten Natures") is the source text; habit
     makes the good path the easy path.
   - *Life*: the mind feeds on living ideas, not dry facts; curriculum must serve ideas
     through literary, first-hand material.
3. **The mind feeds on ideas; knowledge must be communicated in literary form** (Vol VI).
   This is the "living books" doctrine — books written by someone who loves the subject,
   in whole literary prose, versus "twaddle" and committee-written textbooks.
4. **The habit of attention is the master habit** (Vol I Part IV, Ch. I "The Habit of
   Attention"). Short lessons exist to train it: it is better to hold full attention
   briefly than to let attention wander through a long lesson and thereby train
   inattention.
5. **Self-education**: the teacher's job is to spread the feast and get out of the way;
   what a child digs out and tells back is what he owns (Vol VI). Narration is the
   mechanism.

## The method

- **Narration** (Vol I Part V, Ch. IX "The Art of Narrating"; Vol VI). After a *single*
  reading of a passage, the child tells it back in his own words. Oral until roughly age
  10, then increasingly written. Narration replaces comprehension questions, quizzes, and
  multiple-choice review. For a product: the daily check is "tell me what you heard,"
  scored by richness of telling, never by item-response.
- **Short lessons** (Vol I Part V). Under eight, lessons are "seldom more than twenty
  minutes"; reading lessons ~10–15 minutes; beginning writing 5–10 minutes. Lengths grow
  by form: PNEU Form II math ran 30 minutes; Forms V–VI averaged about 40. The timer is a
  feature, not a compromise — end the lesson while attention is still fresh.
- **Copywork → transcription → dictation** (Vol I Part V). Handwriting starts with a few
  perfectly-formed letters (better six perfect strokes than a page of careless ones), moves
  to transcribing passages from good books, then to prepared dictation where the child
  studies the passage first and is dictated it only once.
- **Living books over lectures**: the child's primary contact is with the book/thing
  itself; the adult narrates less, the child narrates more.
- **Nature study and out-of-door life** (Vol I Part II, "Out-of-Door Life for the
  Children"). Hours outdoors daily for young children; systematic observation; nature
  notebooks kept by the child, not graded.
- **Habit formation** (Vol I Part III, incl. Ch. VII "The Forming of a Habit — 'Shut the
  Door After You'"). One habit worked at a time, through watchfulness and repetition, never
  through nagging. An orchestrator can schedule a "habit focus" as a rotating slot.

## What a CM day looks like

- **Morning (approx. 9:00–11:30 for a 6–9-year-old; to ~1:00 for older forms)**: a
  sequence of short, varied lessons — e.g. Bible (with narration), arithmetic, reading,
  a movement break (drill/dance/play), copywork, poetry repetition, singing, natural
  history. Disciplinary subjects sit next to inspirational ones by design.
- **Afternoon**: no book lessons. Outdoor time, a long nature walk (weekly at minimum),
  handicrafts, free play. Afternoons-free is structural, not optional slack.
- **Weekly enrichments**: picture study (one artist per term), composer study, hymn and
  folk song, handicrafts.
- **Term structure**: three ~12-week terms; the PNEU sent out termly programmes and
  end-of-term examination questions answered by narration; exams were meant to encourage,
  not to grade or rank.

## Product mapping notes (Chiron)

- `daily_question_style: narration` means the end-of-block interaction is a free-form
  "tell back" captured as audio/text, evaluated for completeness of telling — never a
  quiz item bank.
- The scheduler must enforce `max_block_minutes_by_age` as a *hard cap* and the variety
  rule as an ordering constraint; a CM-pack "good day" metric weights attention/narration
  quality and outdoor time, not minutes-on-task.
- Book selection filters should down-rank abridgments, worksheet-driven curricula, and
  textbook compendia (`avoid: twaddle, dry-textbooks`) and up-rank single-author
  narrative sources (`prefer: living-books`).

## Sources

Verified (loaded during research):

- https://amblesideonline.org/cm/vol1 — *Home Education* (Vol I), full annotated text: Part II Out-of-Door Life; Part III "Habit Is Ten Natures"; Part IV Ch. I "The Habit of Attention"; Part V Ch. IX "The Art of Narrating".
- https://www.amblesideonline.org/cm/vol6 — *Towards a Philosophy of Education* (Vol VI), full text including the 20-principle synopsis ("Children are born persons.").
- https://archive.org/details/homeeducationser01masouoft — *Home Education Series*, Vol 1, London 1906–7 scan (University of Toronto / Internet Archive) — public-domain confirmation.
- https://charlottemasonpoetry.org/parents-union-school-time-tables/ — original PNEU Parents' Union School timetables: lesson lengths by Form, 9:00 start, Form I ending ~11:30, alternation of subject types.

Referenced via search results (content corroborated in multiple results; not fetched directly):

- https://www.amblesideonline.org/pneu-forms — PNEU form/age correspondences.
- https://charlottemasonpoetry.org/examinations-and-the-pneu/ — termly PNEU examinations sent out each ~12-week term.
