# Guadalajara Spanish Tutor — Project Reference

## What This Project Is

Stan completed a 4-week Spanish language class in Guadalajara (taught by Aura in the mornings and Lalo in the afternoons). This project builds a structured, queryable Spanish learning resource anchored in the **Tapatio/Guadalajara dialect**. The goal is vocabulary reinforcement and exercise generation — not a textbook, but a machine-readable building block for flashcards, fill-in-the-blank exercises, grammar drills, and topic-based conversation practice.

Stan is starting from elementary vocabulary and grammar. Tapatio-specific content is explicitly flagged and celebrated. See the project instructions (set in Claude settings) for tutoring tone and style.

---

## File Inventory

| File | Purpose |
|------|---------|
| `spanish_dictionary.json` | Primary data file. 1000 entries as of June 2026. Every word from the class plus high-frequency level-appropriate additions, fully enriched. |
| `index.html` | **Central launcher** for the app suite. Talavera card grid driven by an `APPS` array in JS — add a new app = add one entry. Links to the flashcards, sentence maker, and dictionary editor. `netlify.toml` serves `/` → this page. |
| `flashcards_vocabulario.html` | Full-deck interactive flashcard app. **localStorage-backed** — automatically loads dictionary and Leitner progress from browser storage; drag-drop JSON only needed first time or to update. Category selection, Talavera design, deal-in animation, grammar callout, bidirectional flip. **Leitner System integrated** — Leitner mode is the only mode. Supports Clic and Escribir (typed-answer) practice modes. Live at **guadalajara-spanish-flashcards.netlify.app**. |
| `sentence_maker.html` | **Constructor de Oraciones** — dynamic fill-in-the-blank drills. Sentences are generated on demand (never stored) from the dictionary, B2-and-below. Rounds of 10, up to 5 (50 max), no repeats, up to 3 blanks each. Tests verbs, articles, adjectives, and pronouns (subject, possessive, direct object, indirect object, reflexive, gustar). Two difficulty modes: ⌨ Escribir (typed, graded by SpellingHandler) and 🔘 Opción múltiple. Loads dictionary via localStorage + fetch fallback; **shares the flashcards' `tapatio_leitner` store** (weights weak/due words, writes back grades). Setup screen shows the loaded word count and a **🔄 Actualizar diccionario** button (`updateDict()`) that re-fetches the JSON and overwrites the cache while preserving Leitner progress. English help only on request. Uses sibling scripts `sentence_engine.js` + `spelling_handler.js`. |
| `sentence_engine.js` | **Source of truth** for the sentence generator (Node-testable, browser global `SentenceEngine`). Classifies entries, runs 11 agreement-aware templates, uses only dictionary conjugations, Leitner-weighted target selection, and a light semantic-compatibility layer (coarse noun/adjective/verb classes). Spec documented in `grammar_reference.md` Part B — keep them in sync. |
| `dictionary_editor.html` | CRUD editor for `spanish_dictionary.json`. File-load + drag-and-drop, searchable/filterable table, full edit modal with verb conjugation handling, exports sorted JSON with correct field order. Also serves as the **Leitner control panel** — reset boxes globally, by filtered view, or by category. Open in browser, load the JSON, edit, export. |
| `grammar_catalog.md` | Read-only reference. 41 sections of class notes from Aura and Lalo covering all grammar topics taught. Tapatio content marked with 🌵. **Primary grammar authority — do not modify.** |
| `grammar_reference.md` | CEFR A1/A2/B1 framework for Mexican Spanish. Gap-filler companion to the catalog — covers topics not explicitly taught in class (subject pronouns, negation, numbers, modal verbs, diminutives, future/conditional tenses, subjunctive, por vs para, si clauses, relative pronouns, indirect speech, and Mexican Spanish appendix). **Part B (added Session 23)** is the Sentence Generation Spec mirroring `sentence_engine.js`. **Fallback only — catalog takes priority. If conflict arises, trust the catalog.** |
| `spelling_handler.js` | Standalone Spanish spelling evaluator. Returns `exact`, `accent_only`, `close`, or `wrong` with Spanish feedback strings. Handles slash variants, article-optional matching, accent/ñ detection, space/hyphen-collapse, Levenshtein fuzzy matching. Compatible with browser (global `SpellingHandler`) and Node. |
| `notes_transcription.md` | Transcription of handwritten class notes from photos. Reference material only — the dictionary is the authoritative data source. |
| `archive/` | 111 photos (IMG_2458.jpeg … IMG_2569.jpeg) of handwritten class notes from the 4-week course. Source material for `notes_transcription.md`. Archived June 2026 — content already captured; images not needed for ongoing work. ~2GB. |

Scripts used to build the dictionary live in the session outputs folder (not in this project folder) and are not needed for ongoing work — the JSON file is the authoritative source.

---

## Dictionary Schema

Every entry in `spanish_dictionary.json` follows this field order exactly. Do not reorder fields when adding entries.

```json
{
  "word": "string — the Spanish word or phrase",
  "english": "string — English translation/gloss",
  "part_of_speech": "string — see POS values below",
  "grammar_notes": "string — human-readable usage notes, irregularities, examples",
  "grammar_rule": "string — machine-readable rule label from the taxonomy below",
  "categories": ["array", "of", "category strings"],
  "gerund": "string — VERBS ONLY (omit field entirely for non-verbs)",
  "past_participle": "string — VERBS ONLY",
  "present_conjugation": { "object — VERBS ONLY, see conjugation keys below" },
  "tapatio": true/false,
  "tapatio_notes": "string — empty string if tapatio is false",
  "leitner_box": 1-5,
  "leitner_sessions_until_due": 0
}
```

**Critical**: `gerund`, `past_participle`, and `present_conjugation` are present **only on verb entries**. They are entirely absent from nouns, adjectives, adverbs, etc. — not null, not empty string, just not there.

### Part-of-Speech Values (common)
`noun (m)`, `noun (f)`, `noun (m pl)`, `noun (f pl)`, `noun (m/f)`, `noun phrase (m)`, `noun phrase (f)`, `verb`, `verb (reflexive)`, `adjective`, `adjective/participle`, `adverb`, `adverb phrase`, `interrogative`, `grammar term`, `interjection`, `conjunction`, `preposition + infinitive`

### Present Conjugation Keys

**Standard verbs** use subject pronouns:
```json
{ "yo": "...", "tú": "...", "él/ella": "...", "nosotros": "...", "ellos/ellas": "..." }
```

**Gustar-type verbs** (reverse-subject structure) use indirect object pronouns instead:
```json
{ "me": "gusta / gustan", "te": "gusta / gustan", "le": "gusta / gustan", "nos": "gusta / gustan", "les": "gusta / gustan" }
```
This is intentional and machine-readable — the different key set signals the grammatical difference.

### Gerund Formation Rules (for reference when adding verbs)
- Regular -AR verbs: stem + **-ando** (caminar → caminando)
- Regular -ER/-IR verbs: stem + **-iendo** (comer → comiendo, vivir → viviendo)
- Vowel-stem -ER/-IR: **-yendo** (leer → leyendo, oír → oyendo)
- **-IR stem-changing verbs only** change stem in gerund: o→u (dormir → durmiendo), e→i (pedir → pidiendo). -AR and -ER stem-changers do NOT change in gerund.
- Reflexive gerunds get accent shift: -ando+se → **-ándose**, -iendo+se → **-iéndose**

---

## Category Taxonomy

All 18 categories. Every entry has at least one. Multi-category entries are common — use arrays liberally when a word genuinely belongs to more than one context.

| Category | Count | Purpose / Exercise Type |
|----------|-------|------------------------|
| Alimentación | 141 | Food, drinks, ingredients, cooking — market and restaurant scenarios |
| Anatomía y cuerpo | 102 | Body parts, organs, blood, tissues — human body exercises |
| Animales | 100 | Animals — pets, farm animals, wildlife, insects — naming and describing animals |
| Medicina y tratamiento | 121 | Conditions, procedures, medications, medical roles, lab values — clinic/hospital scenarios |
| Salud y síntomas | 86 | Symptoms, how you feel, illness — describing health to a doctor |
| Ropa y accesorios | 42 | Clothing, accessories — shopping and description exercises |
| Casa y hogar | 33 | Home, furniture, rooms — describing your living space |
| Ciudad y transporte | 79 | Streets, vehicles, navigation, places in a city — getting around GDL |
| Orientación y direcciones | 26 | Directional language — giving/following directions |
| Familia y relaciones | 40 | Family members, relationships — talking about people you know |
| Emociones y estados | 73 | Feelings, moods, emotional states — expressing yourself |
| Descripción personal | 65 | Physical appearance, personality traits — describing people |
| Rutinas diarias | 123 | Daily activities and action verbs — present tense practice |
| Tiempo y frecuencia | 38 | Time expressions, seasons, frequency adverbs — scheduling and habits |
| Cantidades y comparaciones | 45 | Numbers, sizes, quantities — shopping and comparison |
| Comunicación y cortesía | 101 | Greetings, politeness, conversation connectors — social interaction |
| Gramática funcional | 58 | Pronouns, articles, prepositions, conjunctions — structural vocabulary |
| Cultura tapatía | 152 | Tapatio-specific slang, food, customs — local flavor overlay |

Counts last verified June 23, 2026 (Session 24) by direct tally of `spanish_dictionary.json`. Entries are multi-category, so the sum of this column exceeds the 1000 total entries.

**Cultura tapatía is an overlay category**, not standalone — a Tapatio entry also belongs to its functional category (e.g., birria → Alimentación + Cultura tapatía). Every entry with `tapatio: true` has Cultura tapatía in its categories array.

---

## Grammar Rule Taxonomy (Selected Key Labels)

The `grammar_rule` field uses human-readable labels designed to be pedagogically useful. Key patterns:

**Nouns**: `Masculine noun`, `Feminine noun`, `Feminine noun (takes 'el' before stressed a-)`, `Noun: invariable form`, `Compound noun phrase`, `Noun phrase with adjective agreement`

**Adjectives**: `Adjective: used with SER (permanent trait)`, `Adjective: used with ESTAR (temporary state)`, `Adjective: SER vs ESTAR — meaning shifts`, `Adjective with -o/-a gender agreement`, `Adjective invariable by gender (ends in -e)`

**Verbs**:
- `Regular -AR verb`, `Regular -ER verb`, `Regular -IR verb`
- `Regular -AR verb (reflexive)`, `Regular -ER verb (reflexive)`
- `Stem-changing verb: e→ie`, `Stem-changing verb: o→ue`, `Stem-changing verb: e→i`, `Stem-changing verb: u→ue` (jugar only)
- `Irregular yo form` (e.g., salir → salgo)
- `Mixed irregular: yo-irregular (tengo) + stem-change e→ie` (tener, venir pattern)
- `Mixed irregular: yo-irregular (digo) + stem-change e→i + strong preterite` (decir)
- `Gustar-type verb (reverse-subject structure)`
- `Fully irregular verb` (ser, ir, etc.)
- `Irregular -UIR verb (inserts -y- except nosotros/vosotros)` (construir, producir)

**Special**: `Frequency adverb (habitual present tense)`, `Interrogative word (always written with accent mark)`, `Acronym / invariable`, `Loanword (invariable spelling)`

---

## Tapatio Flagging Convention

- `"tapatio": true` — the word is specific to or strongly associated with Guadalajara/Mexican usage, regional slang, or Tapatio culture
- `"tapatio": false` — standard Spanish
- When `tapatio` is true, `tapatio_notes` contains a human-readable explanation of the regional relevance (never empty)
- 133 entries are currently Tapatio-flagged (all notes in Spanish), verified June 23, 2026

**Example Tapatio notes format**: "🌵 Jerga tapatía esencial — la escucharás constantemente en Guadalajara."

---

## Workflow Convention

- **One chat per working session.** Start a new chat each day, do all the work for that session in it (vocabulary editing, flashcard fixes, grammar questions, tutoring — whatever the session needs), then let it end. Session notes go into CLAUDE.md via "Accepted."
- **Tutoring gets its own persistent chat.** Spanish conversation practice lives in a dedicated tutoring chat, kept separate from engineering/editing work. That chat has continuity worth preserving; working session chats do not.
- **CLAUDE.md is the institutional memory.** Chat history is ephemeral. Everything worth keeping goes here.

---

## Key Decisions & Conventions (Do Not Re-Litigate)

**Why adverbs are checked before verbs in classification logic**: `"verb" in pos` catches "adverb" as a substring. Any script classifying parts of speech must check `pos in ("adverb", "adverb phrase", ...)` **before** checking for verbs.

**tener/venir are "mixed irregular"**, not plain stem-changers: their grammar_notes list full conjugations without using the keyword "e→ie", so they need explicit overrides. Rule: `"Mixed irregular: yo-irregular (tengo) + stem-change e→ie"`.

**quedarse is reflexive, not gustar-type**: quedarse means "to stay" — a regular reflexive. The verb quedar can be gustar-type ("me queda bien"), but quedarse in this dictionary means to stay/remain. Do not reclassify.

**Medicina y anatomía was deliberately split**: It was originally one category. Session 1 created it. Session 2 split it into Anatomía y cuerpo (body parts) and Medicina y tratamiento (conditions/procedures). Do not recombine.

**Conjugation field keys are significant**: Standard verbs use yo/tú/él-ella/nosotros/ellos-ellas. Gustar-type verbs use me/te/le/nos/les. The different key set is intentional — it signals grammatical structure, not just a formatting choice.

**Vosotros is omitted**: This is Mexican Spanish. Vosotros conjugations are not used in Guadalajara and are not included anywhere in the dictionary.

**All grammar_notes and tapatio_notes are in Spanish**: Translated in Session 8. Do not add new notes in English.

---

## Verb Conjugation Field Order

All conjugation-related fields appear only on verb entries, in this order:

```
gerund → past_participle → present_conjugation → preterite_conjugation → imperfect_conjugation
```

Standard verbs use yo/tú/él-ella/nosotros/ellos-ellas keys.
Gustar-type verbs use me/te/le/nos/les keys across ALL conjugation fields.
Reflexive verbs prefix me/te/se/nos/se to the conjugated form.

---

## Current Dictionary Stats (June 2026)

| Metric | Value |
|--------|-------|
| Total entries | 1000 |
| Verb entries (with all conjugation fields) | 186 |
| Tapatio-flagged entries | 133 |
| Categories | 18 |
| Conjugation fields per verb | 5 (gerund, past participle, present, preterite, imperfect) |
| Largest category | Cultura tapatía (152) |
| Anatomía y cuerpo | 102 entries |
| Removed duplicates | pulmón (kept pulmones), leucocitos (kept glóbulos blancos) |

Refreshed June 23, 2026 (Session 24) after expanding the dictionary to 1000 words — see Session 24 below.

---

## Session History (Chronological)

### Session 1 (June 9, 2026)
- Read `grammar_catalog.md` and `spanish_dictionary.json` (627 original entries)
- Added `grammar_rule` field to all 627 entries using a ~50-label taxonomy
- Fixed adverb/verb classification bug (substring match issue)
- Fixed tener, venir, decir, oír, construir, detener misclassifications
- Fixed quedarse (reflexive, not gustar-type) and abrir (regular present, irregular participle)
- Added `gerund`, `past_participle`, `present_conjugation` to all 102 verb entries
- Designed and applied 16-category taxonomy; patched 154 uncategorized entries

### Session 2 (June 9, 2026)
- Split "Medicina y anatomía" → "Anatomía y cuerpo" + "Medicina y tratamiento"
- Fixed 6 misfiled entries (pera→Alimentación, ropa→Ropa y accesorios, aprender→Gramática funcional, miedo→Emociones y estados, palillo→Alimentación, oír→Anatomía y cuerpo + Gramática funcional)
- Added 59 liver-transplant vocabulary entries (A1–B1 medical Spanish for Shawnda's transplant context): trasplante, donante, rechazo, INR, bilirrubina, creatinina, diálisis, stent, catéter, UCI, inmunosupresor, hepatólogo, cirujano, and more
- Added chido/chida and gacho/gacha (core Tapatio slang pair)
- Built CLAUDE.md (this file)

### Session 3 (June 9, 2026)
- Added `preterite_conjugation` field to all 107 verb entries — full irregular coverage (ser/ir, dar, oír, hacer, strong u-stems, j-stems, construir), stem-changing -IR 3rd-person changes (dormir→durmió, pedir→pidió), orthographic yo-form changes (-zar→-cé, -car→-qué, -gar→-gué), gustar-type (me/te/le/nos/les keys), reflexive pronoun prefixes
- Added `imperfect_conjugation` field to all 107 verb entries — only 3 true irregulars (ser, ir, ver); everything else regular -aba/-ía pattern; stem-changers do NOT change in imperfect
- Added 26 Tapatio slang entries across four flavors: everyday expressions (güey, órale, ándale, chale, híjole, mande, sale, a poco, no manches, padre), compliments/insults (chingón, naco, gandalla, cuate, chavo), money/work (lana, feria, chamba, chambear, paro), street slang (neta, qué pedo, buena onda, mala onda, fierro, chido al cien)
- **Total entries: 714**

### Session 4 (June 9, 2026)
- Built `flashcards_anatomia.html` — interactive Spanish→English flashcard app for Anatomía y cuerpo (90 cards, 9×10 rounds, Fisher-Yates shuffle, round summaries, missed-word tracking)
- Added `esternón` (sternum/breastbone) to dictionary and Anatomía y cuerpo to reach 90 entries
- Fixed `cabello`/`pelo` English labels to distinguish Mexican vs. general usage on flashcard backs
- **Total entries: 715**

### Session 5 (June 9–10, 2026)
- Added 9 anatomy terms to Anatomía y cuerpo: axila, senos paranasales, fémur, tibia, peroné, húmero, radio, cúbito, sistema circulatorio
- *(No additional session notes were recorded for this session)*

### Session 6 (June 10, 2026)
- Removed `aneurisma` from Anatomía y cuerpo (it's a condition/event, not a body part); kept in Medicina y tratamiento + Salud y síntomas
- Added `ombligo` (navel/belly button, noun m) to dictionary and Anatomía y cuerpo — restores clean 100-entry / 10×10 deck
- Fixed flashcard blank display bug: card data rebuild had used `es`/`en` field names instead of `word`/`english` expected by JS
- Simplified between-round recall drill navigation: merged "Ver →" and "Siguiente →" into a single button
- **Total entries: 725**

### Session 7 (June 10, 2026)
- Built `flashcards_vocabulario.html` — full rebuild of the flashcard app with all 725 dictionary entries embedded
- Added category selection screen: multi-select grid of all 17 categories + "Todas," balanced sampling up to 100 cards, deck size snaps to nearest multiple of 10, default selection is "Todas"
- Talavera visual redesign: cobalt (#1B4F8A), terracotta (#C1440E), marigold (#E8971A), cream (#F5F0E8) palette; Oswald/Playfair Display/Barlow typography via Google Fonts
- Play header pill: [emoji + category name] · Ronda X de Y · Tarjeta X de Y; click to expand category list
- Card-to-card transition: deal-in animation — card flies in from lower-right at 14° rotation, glides flat on landing
- Fixed translation peek bug: back face content loads at animation midpoint (220ms setTimeout)

### Session 8 (June 10, 2026)
- All grammar_notes and tapatio_notes translated to Spanish (3-pass regex + manual fixes); 0 significant English markers remain
- Removed duplicate entries: `pulmón` (kept `pulmones`) and `leucocitos` (kept `glóbulos blancos`) — **723 entries total**
- Moved ❌ Repaso / ✅ ¡Lo sé! grade buttons onto the card back face
- Grammar callout: empty/grey before flip, reveals grammar_notes + tapatio_notes on flip; bidirectional flip supported
- Dictionary re-embedded in HTML with 723-entry JSON after all fixes

### Session 9 (June 10, 2026)
- Deleted `flashcards_anatomia.html` — superseded by `flashcards_vocabulario.html`
- Fixed recall drill blank screen bug: `recall-input-row` div was missing its `id` attribute
- Recall drill button now hidden after one completed pass (or skip)
- Removed POS badge from card front face entirely; fixed POS badge on card back (JS was reading `c.pos` instead of `c.part_of_speech`)
- Translation display split: card back shows only core translation; parenthetical clarification moves to grammar callout as `#callout-english`
- Fixed `reviewAllMissed()` on final screen: was reading from `allMissed` instead of `firstEncounterMissed`
- Pixel-perfect word alignment: grade buttons `position: absolute; bottom: 28px`, font matched at 2.4rem on both faces
- `reviewAllMissed()` now launches recall drill; `recallFromFinal` flag routes completion back to final screen
- Recall answer box always visible — grey/empty before reveal, transitions to blue callout on reveal

### Session 10 (June 11, 2026)
- Built `dictionary_editor.html` — browser-based CRUD editor for `spanish_dictionary.json`
- Features: drag-and-drop or file-input JSON load; searchable/filterable table (by word/translation, POS, category, Tapatío toggle); sortable columns; full edit modal with all fields; verb section auto-shows/hides based on POS; gustar-type toggle switches conjugation key set; Cultura tapatía auto-added when Tapatío checked; add new entries; delete with confirmation; export downloads sorted JSON with strict field order
- ⌘S keyboard shortcut triggers export

### Session 11 (June 11, 2026)
- **Leitner System — dictionary schema**: Added `leitner_box` (1–5) and `leitner_sessions_until_due` fields. State stored in the JSON itself for cross-session persistence. Fields appended at end of field order.
- **dictionary_editor.html — Leitner management**: Leitner stats strip, box filter, Leitner panel modal with bar chart distribution and reset controls, box radio buttons in edit modal, export includes leitner fields
- **flashcards_vocabulario.html — Full Leitner integration**: Load screen for JSON drag-drop; Libre/Leitner mode toggle; session mechanics (decrement sessions_until_due, filter pool); grading promotes/demotes; box intervals `[0,0,1,3,7,15]`; final screen export "⬇ Guardar progreso (JSON)"

### Session 12 (June 14, 2026)
- Built `grammar_reference.md` — CEFR A1/A2/B1 companion to `grammar_catalog.md`
- Covers 20 grammar topics not in the catalog: subject pronouns, noun gender patterns, negation, personal "a", numbers/ordinals, days/months/seasons, colors, sentence structure, modal verbs, change-of-state verbs, conjunctions, relative clause intro, impersonal se, time expressions, diminutives, weather, por vs para, future tense, conditional tense, present subjunctive, si clauses, relative pronouns, indirect speech, superlatives
- Appendix: 6 Mexican Spanish/Tapatio-specific topics including no-vosotros pronoun system, Nahuatl loanwords, diminutives as cultural marker
- **Priority rule**: `grammar_catalog.md` is primary authority; `grammar_reference.md` is fallback only

### Session 13 (June 14, 2026)
- Built `spelling_handler.js` — standalone Spanish spelling evaluator (browser + Node compatible)
- Four result statuses: `exact`, `accent_only`, `close`, `wrong`; `result.correct` true for exact and accent_only
- Handles: slash variants, article-optional matching, parenthetical articles, leading ¿¡/trailing ?! stripped
- Levenshtein fuzzy match with length-scaled threshold (1 for ≤6 chars, 2 for ≤12 chars)
- `strict: true` and `articleOptional: false` options available
- 42 automated tests, all passing

### Session 14 (June 14, 2026)
- Integrated `SpellingHandler` into `flashcards_vocabulario.html` as reinforcement typing
- **Main card spell zone**: input below each card; Enter triggers SpellingHandler feedback + auto-flip; input locks on reveal; auto-focus after deal animation
- **Recall drill**: SpellingHandler feedback appears in answer box on reveal
- `engTarget()` helper strips parenthetical notes and adds "to"-less variants for verb entries
- Feedback color coding: jade green (exact), amber (accent_only/close), muted gray (wrong) — no red, reinforcement only
- SpellingHandler module embedded inline; `spelling_handler.js` remains source of truth

### Session 15 (June 15, 2026)
- Added **Tipo de práctica** mode selector: 🖱 Clic (existing behavior) vs ⌨ Escribir (typed-answer mode)
- **Escribir mode**: click-to-flip disabled; spell zone visible; Enter → SpellingHandler → auto-flip → single result button; Leitner grade applied automatically; card waits for tap or Enter to advance
- Refactored `grade()` into `applyGrade(knew)` + `advanceCard()` + `grade()` wrapper
- Extracted `doFlipToBack()` from `flipCard()` — critical fix preventing immediate advance on programmatic flip
- `setGameMode(mode)` toggles button styles and hint text
- **Selection screen order**: Tipo de práctica buttons appear above ¡Jugar! button

### Session 16 (June 15, 2026)
- Added pinstripe borders to flashcard faces: cobalt on front, semi-transparent white on back
- Fixed mode button hover color: active button now shows `var(--cream)` text on hover (was unreadable cobalt-on-cobalt)
- Removed 5-second auto-advance in Escribir mode: card now waits for tap or Enter key after reveal
- Recall drill Enter-to-advance: pressing Enter after reveal advances to next card
- UX: deselecting all categories automatically snaps back to "Todas"
- Fixed recall drill Enter-to-reveal simultaneously advancing: `setTimeout(0)` defers advance listener past bubble phase
- Fixed recall answer box clipping grammar notes: changed to `min-height: 80px` (no overflow restriction)

### Session 17 (June 15, 2026)
- Added `ojo` (eye, noun m) — Anatomía y cuerpo + Descripción personal
- Grammar notes: TENER + definite article for eye descriptions; uninflected color adjectives in Mexican informal speech (*ojos café*); *¡Ojo!* = ¡Cuidado! interjection
- Added to both `spanish_dictionary.json` and embedded HTML dictionary
- **Total entries: 724**
- Added **space/hyphen-collapse check** to `spelling_handler.js` and embedded HTML version: stripping spaces/hyphens from both strings before comparing returns `accent_only` (correct=true) — spacing conventions don't penalize Leitner
- Updated `columna vertebral` English field to include "spinal column" as valid slash variant

### Session 18 (June 15, 2026)
- Project cleanup and archival
- Moved 111 note photos (IMG_2458.jpeg … IMG_2569.jpeg, ~2GB) to `archive/` subfolder — source material for `notes_transcription.md`, not needed for ongoing work
- Reorganized CLAUDE.md: corrected session history to chronological order, added missing Session 5 stub, fixed stale entry counts (723→724, Tapatio count, Anatomía y cuerpo count), removed stray `---` dividers from session list, updated file inventory to reflect archive

### Session 19 (June 15, 2026)
- Fixed recall drill input auto-focus: `inp.focus()` was called while `#recall-screen` had `display:none` — added explicit `.focus()` after making screen visible in both `startRecall()` and `reviewAllMissed()`
- Scanned and corrected ~150+ broken `=` patterns in `spanish_dictionary.json`: self-referential X = X entries (where both sides were the same Spanish phrase) replaced with meaningful descriptions; ~33 English fragments translated to Spanish
- **Divorced embedded JSON from HTML**: removed 362KB `var DICTIONARY = [...]` block from `flashcards_vocabulario.html` (450KB → ~87KB); restored missing constants (`ROUND_SIZE`, `MAX_DECK`, `CAT_META`, `CAT_COUNTS`, `selectedCats`) that were accidentally included in the removal; removed "play without tracking" option — Leitner mode is now the only mode; load screen now requires `spanish_dictionary.json` to proceed
- File inventory and CLAUDE.md updated to reflect divorce

### Session 20 (June 15, 2026)
- **Created GitHub repo** `sjmisina/guadalajara-spanish-flashcards` (public) — all 9 project files pushed in initial commit `bc035ae`; `.gitignore` excludes `archive/` (~2GB photos), `.DS_Store`, and scratch files
- **localStorage persistence** added to `flashcards_vocabulario.html` (commit `57ce794`):
  - Two-key strategy: `tapatio_dict_v` stores the full dictionary JSON; `tapatio_leitner` stores a lightweight `{word: {box, due}}` delta
  - On startup, `tryLoadFromStorage()` checks for cached dict — if found, skips load screen and goes straight to category selection
  - `saveDictToStorage()` called after every JSON file load; `saveLeitnerToStorage()` called after every Leitner grade and `decrementSessions()`
  - `applyStoredLeitner()` merges stored Leitner progress onto newly loaded dict entries by word key — Leitner history survives dictionary updates
  - "🔄 Actualizar diccionario" subtle button on selection screen to force a fresh JSON load without losing progress
- **Deployed to Netlify**: `https://guadalajara-spanish-flashcards.netlify.app` — GitHub → Netlify CI/CD pipeline; every `git push` to `main` auto-deploys; no build command (pure HTML/JS/JSON static site)

### Session 21 (June 15, 2026)
- Added `netlify.toml` — fixes 404 on root URL by redirecting `/` → `/flashcards_vocabulario.html` (status 200 rewrite); committed `feb3f29`
- Fixed `ombligo` english field: `"navel; belly button"` → `"navel / belly button"` — semicolons are not recognized by SpellingHandler as alt-answer separators; only slashes work
- **Auto-fetch dictionary from server** (`fetchDictFromServer()`) — on init, if localStorage is empty, app now `fetch()`es `spanish_dictionary.json` from the same Netlify origin; falls back to drag-drop screen only if fetch fails (e.g., running locally via `file://`); committed `0dca245`
- Updated `showUpdateDictScreen()` — "🔄 Actualizar diccionario" now re-fetches from server instead of showing drag-drop; drag-drop remains as fallback
- **Net result**: visiting the Netlify URL for the first time loads the app fully automatically — no drag-drop ever required

### Session 22 (June 16–17, 2026)
- Added `Animales` category — 94 new entries (94 added on top of the existing dictionary, reaching 818 total); committed `648f6f5`
- Selection-screen polish: scrollable category box (max ~3.5 rows, scroll-fade affordance), mobile overflow fixes, mode buttons moved above category grid, categories alphabetized with "Todas" pinned first; committed `7b106e3`
- Left-aligned the Clic/Escribir hint text under the button group instead of centering it under the full row; added an available-card-count note under the Rondas selector; committed `e096de2`
- **Bug fix**: available-card-count note was reading `buildPool()`'s result, which intentionally caps at `MAX_DECK` (100) for deck-building — so selecting any category (or combo) over 100 words showed "100" instead of the true count. Added `distinctPoolSize(cats)`, a true uncapped distinct-word counter, and pointed the note at it instead. Verified with a synthetic-data Node harness across several category sizes; committed `8e18575`
- Verified `fisherYates()`/`buildPool()` randomization is genuine (20,000-trial position-frequency check, max deviation 6.6%) and confirmed category/mode/rounds selections persist across rounds within a session but correctly reset on page refresh — no code changes needed for either, just verification
- **Full project review** (punch list, no changes during the pass itself): found CLAUDE.md's stats/category tables stale relative to the dictionary (724→818 entries, 17→18 categories, all per-category counts drifted) — refreshed in this same session; found `ultrasonido` had `tapatio: false` with non-empty `tapatio_notes`, violating the documented convention — judgment call: flipped to `tapatio: true` (+ added `Cultura tapatía` to its categories) rather than deleting the notes, since the note content ("en Guadalajara y en todo México...") fits the Tapatio-flagging definition; found `spelling_handler.js` (standalone) and its embedded copy in `flashcards_vocabulario.html` had drifted on one wrong-answer message string — synced the embedded copy to match the standalone source (5 entries initially flagged as "non-verb with verb fields" — `dar la vuelta`, `haber`, `hay`, `pedir prestado`, `quepo` — turned out to be a false positive from an incomplete POS whitelist in the check script, not a real data issue)
- All commits for this session confirmed pushed to `origin/main` from Stan's own terminal (sandbox session has no GitHub credentials, so pushing is always handed off to Stan)

### Session 23 (June 23, 2026)
- **Built the Constructor de Oraciones (sentence maker)** — a sophisticated, dynamic fill-in-the-blank generator. Sentences are never stored; every exercise is assembled at runtime from `spanish_dictionary.json`.
  - `sentence_engine.js` — Node-testable source of truth (browser global `SentenceEngine`). Classifies entries (82 standard verbs / 20 reflexive / 5 gustar / 507 nouns / 63 adjectives), runs **11 agreement-aware templates**, and uses **only conjugations present in the dictionary** (present/preterite/imperfect — a verb is skipped for a tense unless all five person-forms exist; nothing is invented). No vosotros.
  - Tests verbs, articles, adjectives, and pronouns: subject, possessive, direct object, indirect object, reflexive, plus gustar-type agreement. Up to 3 blanks per sentence.
  - **SER vs ESTAR** copula is chosen from the adjective's `grammar_rule` tag (not random), so e.g. *"Ellos están concentrados"* / *"Él es pelirrojo"* are correct.
  - **Leitner-weighted** target selection: weight `(6 − box)`, doubled if due → ~3× over-representation of box-1/due words (verified). Shares the flashcards' `tapatio_leitner` store and writes grades back (promote/demote, `BOX_INTERVALS=[0,0,1,3,7,15]`). One battery = one decremented session. Pronoun-only blanks never touch Leitner.
  - **Light semantic-compatibility layer**: coarse noun classes (person/animal/food/body/place/clothing/thing) and adjective domains keep pairings sensible (adjectives only land on compatible nouns; person-subjects avoid food/weather adjectives; *comer*→food objects, *doler*→body, gustar→food/animals, transfer verbs only for IO frames). Grammar tested is always correct; some pairings remain intentionally quirky by design.
  - `sentence_maker.html` — Talavera-styled app. Rounds of 10, up to 5 (50 max), **no repeats** (dedup by filled sentence). Difficulty selectable: **⌨ Escribir** (typed, graded by SpellingHandler — accent-tolerant) or **🔘 Opción múltiple** (3–4 options, answer always present, same-type distractors). English help only on request (per project rules). Loads via localStorage + fetch fallback; references sibling `sentence_engine.js` + `spelling_handler.js`.
- **Built `index.html`** — central launcher for the app suite (extensible `APPS` array). Updated `netlify.toml` to serve `/` → `/index.html` (was → flashcards).
- **Documented the spec** in `grammar_reference.md` **Part B — Sentence Construction & Generation Spec** (person table, slot types, agreement rules, SER/ESTAR logic, tense cues, template catalog, Leitner mechanics). Mirrors `sentence_engine.js`.
- **Data fix**: corrected `abrazar` preterite *yo* `abrazé` → `abracé` (-zar→-cé rule) so the generator never teaches the wrong form. (Note: this was the only orthographic conjugation error scanned for — a full audit of -car/-gar/-zar preterites and -cer/-cir/-uir present forms across all 101 other verbs is a recommended future pass.)
- **Verification**: Node harness (50 sentences × both modes = 0 failures: uniqueness, ≤3 blanks, every verb/ser-estar answer is a real dictionary form, MC options always contain the answer); integration test (SpellingHandler accepts 100% of generated answers, accent-tolerant; Leitner writeback promotes correctly); full jsdom play-through of both modes to the final screen with shared store written.

### Session 24 (June 23, 2026)
- **Full verb-conjugation audit** (the punch-list item from Session 23). Built four independent checkers (targeted orthographic rules, a regular-verb regenerator, a curated 18-verb / 155-form irregular table, and imperfect/nosotros regularity), cross-checked by manual eyeball of every stem-changer and irregular. Across ~2,750 conjugated forms the dictionary held up extremely well: only real issues were **`brincal`→`brincar`** (headword typo; all conjugations were already correct for *brincar*) and **`pedir prestado`** (restored "prestado" in the preterite and imperfect, which had dropped it). Tightened **`nacer`**'s label to `Irregular yo form (c→zc): nazco` (was "Regular -ER verb"); confirmed `abrir`'s label was already precise. All remaining audit flags are documented false positives (strong preterites like *trajo/anduve*, correct irregular participles *escrito/abierto*, the *envío* accent verb, and multi-word verb phrases that trip naive stem-splitting).
- **Two engine bugs surfaced by the audit and fixed in `sentence_engine.js`**: (1) `doPron` hard-coded `ver` (not a dictionary entry) for its setup clause, producing *"Ellos veo…"* for non-*yo* subjects — now uses the chosen in-dictionary verb for both clauses; (2) feminine nouns with a stressed initial *a-* now correctly take **el/un** in the singular (*el agua, un águila*) via `defArtForNoun`/`indefArtForNoun` keyed off the dictionary's `grammar_rule`, while agreement stays feminine. Verified across 800 batteries (43 occurrences, 0 wrong articles).
- **Expanded the dictionary 818 → 1000 words** (Stan's goal). Added **78 verbs** — every conjugation machine-generated by a stem-change/orthographic conjugator with explicit overrides for the irregulars (ver, poner, caer, andar, irse, enviar, freír, conseguir, ir-based forms; irregular participles escrito/muerto/visto/puesto/frito), then run through the full audit suite (0 flags). Fills core A1 gaps (ver, poner, leer, escribir, tomar, llegar, necesitar…), stem-changers, irregulars, daily-routine reflexives, and chef/medical themed verbs. Added **104 non-verbs** across five themes Stan chose — Numbers/quantities/adjectives, Travel & city, Food & cooking, Medical & health, Entertainment & culture — with **25 new Tapatío/Jalisco-flagged** items (mariachi, tequila, torta ahogada, jericalla, tejuino, cahuama, molcajete, charrería, aventón, cuadra…). Merge sorted with a Spanish-collation key (á≈a, n<ñ<o) that reproduces the file's existing order, so existing entries didn't churn. New stats: 186 verb entries, 133 Tapatío-flagged, largest category Cultura tapatía (152).
- **`sentence_maker.html`**: added the **🔄 Actualizar diccionario** button + loaded-word-count display on the setup screen (`updateDict()` re-fetches the JSON, overwrites the `tapatio_dict_v` cache, preserves Leitner progress). Returning users must click it (or the flashcards' equivalent — they share the cache) to pull the new 1000-word set.
- **Verification**: final audit clean (0 real flags); engine harness 50 unique sentences × both modes = 0 failures with 1000 words; jsdom play-through passes and writes 1000 words to the shared Leitner store; refresh button verified in jsdom.

---

## Potential Next Steps

- Add future tense conjugation field to all verb entries (would let the sentence maker add a future template) — now higher value with 186 verbs
- Add conditional tense conjugation field to all verb entries
- Build a "lesson" structure mapping dictionary entries to grammar_catalog sections
- Add more sentence-maker templates (double-object pronouns, negation, comparatives) and an optional category filter
- Optionally strengthen the semantic layer (some grammatically-correct pairings remain intentionally quirky, e.g. *"El tequila es muy largo"*)
- Add subjunctive mood field to verbs (advanced)
