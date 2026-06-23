/**
 * SentenceEngine — dynamic Spanish sentence generator for fill-in-the-blank drills.
 *
 * Guadalajara Spanish Tutor project. Sentences are NEVER stored: every exercise
 * is assembled on demand from the dictionary, respecting gender/number agreement
 * and using ONLY the verb conjugations that exist in the dictionary
 * (present / preterite / imperfect — no future, conditional, or subjunctive).
 *
 * Scope: B2-and-below grammar. Up to 3 blanks per sentence. Blanks can test
 * verbs, nouns, adjectives, articles, and pronouns (subject, possessive,
 * direct-object, indirect-object, reflexive).
 *
 * Leitner-aware: target words are chosen with weighting that favors low boxes
 * and due cards, so the battery reinforces what is least familiar.
 *
 * Public API:
 *   var model = SentenceEngine.classify(entries);
 *   var battery = SentenceEngine.generateBattery(model, {count:50, mode:'typed'|'choice', rng:fn});
 *   var grades = SentenceEngine.gradeExercise(exercise, perBlankCorrect);  // -> [{word, knew}]
 *
 * Companion spec lives in grammar_reference.md ("Sentence Construction & Generation Spec").
 * Keep the two in sync. Browser global SentenceEngine; Node module.exports.
 */
var SentenceEngine = (function () {
  'use strict';

  // ── Persons ───────────────────────────────────────────────────────────────
  // conjKey maps to the dictionary's conjugation keys. No vosotros (Mexican).
  var PERSONS = [
    { id: 'yo',    subj: 'yo',       conjKey: 'yo',          num: 'sing', gender: null, refl: 'me', io: 'me', doObj: 'me' },
    { id: 'tu',    subj: 'tú',       conjKey: 'tú',          num: 'sing', gender: null, refl: 'te', io: 'te', doObj: 'te' },
    { id: 'el',    subj: 'él',       conjKey: 'él/ella',     num: 'sing', gender: 'm',  refl: 'se', io: 'le', doObj: 'lo' },
    { id: 'ella',  subj: 'ella',     conjKey: 'él/ella',     num: 'sing', gender: 'f',  refl: 'se', io: 'le', doObj: 'la' },
    { id: 'nos',   subj: 'nosotros', conjKey: 'nosotros',    num: 'plur', gender: 'm',  refl: 'nos', io: 'nos', doObj: 'nos' },
    { id: 'ellos', subj: 'ellos',    conjKey: 'ellos/ellas', num: 'plur', gender: 'm',  refl: 'se', io: 'les', doObj: 'los' }
  ];
  function personById(id) { for (var i = 0; i < PERSONS.length; i++) if (PERSONS[i].id === id) return PERSONS[i]; return null; }
  // Persons whose conjugated forms are person-unique (safe to blank the subject pronoun)
  var UNIQUE_SUBJ_PERSONS = ['yo', 'tu', 'nos', 'ellos'];

  var ALL_SUBJ_PRON  = ['yo', 'tú', 'él', 'ella', 'nosotros', 'ellos'];
  var ALL_POSS_SING  = ['mi', 'tu', 'su', 'nuestro', 'nuestra'];
  var ALL_POSS_PLUR  = ['mis', 'tus', 'sus', 'nuestros', 'nuestras'];
  var ALL_DO         = ['lo', 'la', 'los', 'las', 'me', 'te', 'nos'];
  var ALL_IO         = ['me', 'te', 'le', 'nos', 'les'];
  var ALL_REFL       = ['me', 'te', 'se', 'nos'];
  var ALL_ART_DEF    = ['el', 'la', 'los', 'las'];

  // ── Tense cue phrases (front-of-sentence triggers) ────────────────────────
  var CUES = {
    present:   ['Todos los días', 'Normalmente', 'Cada mañana', 'Siempre', 'Ahora'],
    preterite: ['Ayer', 'Anoche', 'La semana pasada', 'El año pasado', 'Esta mañana'],
    imperfect: ['Cuando era niño', 'Antes', 'De vez en cuando, antes', 'En aquellos años']
  };

  // ── Small utilities ───────────────────────────────────────────────────────
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function endsVowel(s) { return /[aeiouáéíóú]$/i.test(s); }
  function pluralize(s) { return endsVowel(s) ? s + 's' : s + 'es'; }
  function cleanWord(w) { return (w || '').replace(/\(.*?\)/g, '').split('/')[0].trim(); }

  function makeRng(rng) { return typeof rng === 'function' ? rng : Math.random; }
  function pick(arr, rng) { return arr[Math.floor(makeRng(rng)() * arr.length)]; }
  function shuffle(arr, rng) {
    var a = arr.slice(), r = makeRng(rng);
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ── Noun gender/number from part_of_speech ────────────────────────────────
  function nounGN(entry) {
    var p = entry.part_of_speech || '';
    var gender = /\(f/.test(p) ? 'f' : 'm';
    var num = /pl\)/.test(p) ? 'plur' : 'sing';
    return { gender: gender, num: num };
  }

  // ── Adjective agreement forms ─────────────────────────────────────────────
  function adjForms(entry) {
    var w = cleanWord(entry.word);
    var ms, fs;
    if (/o$/.test(w)) { ms = w; fs = w.slice(0, -1) + 'a'; }
    else if (/dor$/.test(w)) { ms = w; fs = w + 'a'; }
    else { ms = w; fs = w; } // invariable by gender (-e, -consonant, etc.)
    return { ms: ms, fs: fs, mp: pluralize(ms), fp: pluralize(fs), genderVaries: ms !== fs };
  }
  function adjFor(entry, gender, num) {
    var f = adjForms(entry);
    if (gender === 'f') return num === 'plur' ? f.fp : f.fs;
    return num === 'plur' ? f.mp : f.ms;
  }

  // ── Possessive resolution ─────────────────────────────────────────────────
  function possFor(personId, gender, num) {
    var plural = num === 'plur';
    switch (personId) {
      case 'yo':  return plural ? 'mis' : 'mi';
      case 'tu':  return plural ? 'tus' : 'tu';
      case 'el': case 'ella': case 'ellos': return plural ? 'sus' : 'su';
      case 'nos': return 'nuestr' + (gender === 'f' ? 'a' : 'o') + (plural ? 's' : '');
      default: return 'su';
    }
  }

  // ── Direct-object / article resolution ────────────────────────────────────
  function doFor(gender, num) {
    if (gender === 'f') return num === 'plur' ? 'las' : 'la';
    return num === 'plur' ? 'los' : 'lo';
  }
  function defArt(gender, num) {
    if (gender === 'f') return num === 'plur' ? 'las' : 'la';
    return num === 'plur' ? 'los' : 'el';
  }
  function indefArt(gender, num) {
    if (gender === 'f') return num === 'plur' ? 'unas' : 'una';
    return num === 'plur' ? 'unos' : 'un';
  }
  // Feminine nouns beginning with a stressed a-/ha- take 'el'/'un' in the SINGULAR
  // (e.g. el agua, un águila) while still agreeing feminine elsewhere. Flagged in the dictionary.
  function elBeforeStressedA(noun) {
    return (noun.grammar_rule || '').indexOf("takes 'el' before stressed a-") >= 0;
  }
  function defArtForNoun(noun, num) {
    var gn = nounGN(noun);
    if (gn.gender === 'f' && num === 'sing' && elBeforeStressedA(noun)) return 'el';
    return defArt(gn.gender, num);
  }
  function indefArtForNoun(noun, num) {
    var gn = nounGN(noun);
    if (gn.gender === 'f' && num === 'sing' && elBeforeStressedA(noun)) return 'un';
    return indefArt(gn.gender, num);
  }

  // ── Reflexive / gustar parsing ────────────────────────────────────────────
  function isReflexive(entry) {
    return /reflexive/.test(entry.part_of_speech || '') ||
      (/se$/.test(entry.word || '') && entry.present_conjugation);
  }
  function splitReflexive(form) {
    // "me acuesto" -> {pron:'me', verb:'acuesto'}
    var m = (form || '').match(/^(me|te|se|nos)\s+(.+)$/);
    return m ? { pron: m[1], verb: m[2] } : null;
  }
  function isGustar(entry) {
    return entry.present_conjugation && entry.present_conjugation.hasOwnProperty('me') &&
      !entry.present_conjugation.hasOwnProperty('yo');
  }
  function splitGustar(str) {
    // "gusta / gustan" -> {sing:'gusta', plur:'gustan'}
    var parts = (str || '').split('/').map(function (s) { return s.trim(); });
    return { sing: parts[0] || str, plur: parts[1] || parts[0] || str };
  }

  // ── Tense object retrieval ────────────────────────────────────────────────
  function tenseObj(entry, tense) {
    if (tense === 'present') return entry.present_conjugation;
    if (tense === 'preterite') return entry.preterite_conjugation;
    if (tense === 'imperfect') return entry.imperfect_conjugation;
    return null;
  }
  function hasFullTense(entry, tense) {
    var o = tenseObj(entry, tense);
    if (!o) return false;
    var keys = ['yo', 'tú', 'él/ella', 'nosotros', 'ellos/ellas'];
    for (var i = 0; i < keys.length; i++) if (!o[keys[i]]) return false;
    return true;
  }

  // ── Classification ────────────────────────────────────────────────────────
  function classify(entries) {
    var model = {
      entries: entries,
      byWord: {},
      verbs: [],        // standard, non-reflexive, non-gustar, full present
      reflexives: [],
      gustars: [],
      nouns: [],        // singular common nouns with clean gender
      adjectives: [],
      adjGender: []      // adjectives whose form varies by gender (good for contrast)
    };
    entries.forEach(function (e) { model.byWord[e.word] = e; });

    entries.forEach(function (e) {
      var pos = e.part_of_speech || '';
      if (e.present_conjugation) {
        if (isGustar(e)) { model.gustars.push(e); return; }
        if (isReflexive(e)) {
          if (hasFullTense(e, 'present')) model.reflexives.push(e);
          return;
        }
        if (hasFullTense(e, 'present')) model.verbs.push(e);
        return;
      }
      // nouns: simple singular m/f nouns (skip pronoun-ish grammar terms)
      if (/^noun \((m|f)\)$/.test(pos) || /^noun phrase \((m|f)\)$/.test(pos)) {
        model.nouns.push(e);
      }
      if (pos === 'adjective') {
        model.adjectives.push(e);
        if (adjForms(e).genderVaries) model.adjGender.push(e);
      }
    });
    return model;
  }

  // ── Leitner weighting ─────────────────────────────────────────────────────
  function leitnerWeight(entry) {
    var box = entry.leitner_box || 1;            // 1..5
    var base = (6 - box);                        // box1->5 ... box5->1
    var due = (entry.leitner_sessions_until_due || 0) <= 0;
    return due ? base * 2 : base;                // due cards doubled
  }
  function weightedPick(arr, rng) {
    if (!arr.length) return null;
    var r = makeRng(rng), total = 0, i;
    for (i = 0; i < arr.length; i++) total += leitnerWeight(arr[i]);
    var t = r() * total, acc = 0;
    for (i = 0; i < arr.length; i++) { acc += leitnerWeight(arr[i]); if (t <= acc) return arr[i]; }
    return arr[arr.length - 1];
  }

  // ── Distractor builders (for multiple-choice mode) ────────────────────────
  function distractVerb(entry, tense, conjKey, rng) {
    var o = tenseObj(entry, tense) || {};
    var forms = [];
    Object.keys(o).forEach(function (k) { if (o[k]) forms.push(o[k]); });
    return forms;
  }
  function uniqueOptions(answer, pool, n, rng) {
    var opts = [answer], seen = {}; seen[answer.toLowerCase()] = 1;
    var sh = shuffle(pool, rng);
    for (var i = 0; i < sh.length && opts.length < n; i++) {
      var v = sh[i];
      if (v && !seen[v.toLowerCase()]) { seen[v.toLowerCase()] = 1; opts.push(v); }
    }
    return shuffle(opts, rng);
  }

  // ── Blank + token helpers ─────────────────────────────────────────────────
  function blank(role, answer, opts) {
    opts = opts || {};
    return {
      role: role,
      answer: answer,
      options: opts.options || null,
      wordKey: opts.wordKey || null,   // dictionary word for Leitner writeback
      gloss: opts.gloss || null,       // English gloss (revealed on request)
      note: opts.note || null          // grammar note (revealed on request)
    };
  }
  function T(v) { return { t: 'text', v: v }; }
  function B(b) { return { t: 'blank', b: b }; }

  function finalize(id, tense, personId, parts, rng) {
    var blanks = [];
    parts.forEach(function (p) { if (p.t === 'blank') blanks.push(p.b); });
    if (!blanks.length || blanks.length > 3) return null;
    // build display + answer strings
    var display = '', filled = '';
    parts.forEach(function (p) {
      if (p.t === 'text') { display += p.v; filled += p.v; }
      else { display += '____'; filled += p.b.answer; }
    });
    return {
      id: id, tense: tense, personId: personId,
      parts: parts, blanks: blanks,
      display: display.trim(), filled: filled.trim(),
      key: id + '|' + filled.trim().toLowerCase()
    };
  }

  // Bias nouns toward readable concrete categories for subjects/objects
  var SUBJECT_CATS = ['Animales', 'Familia y relaciones', 'Alimentación', 'Casa y hogar', 'Ciudad y transporte', 'Descripción personal'];

  // Reflexive verbs that form a complete clause without a direct object
  var ROUTINE_REFLEXIVES = ['levantarse', 'acostarse', 'bañarse', 'ducharse', 'despertarse',
    'vestirse', 'peinarse', 'maquillarse', 'afeitarse', 'dormirse', 'divertirse', 'relajarse', 'sentarse'];

  // Decide SER vs ESTAR from an adjective's grammar_rule tag
  function copulaForAdj(entry, rng) {
    var gr = entry.grammar_rule || '';
    if (/used with ESTAR/.test(gr)) return 'estar';
    if (/used with SER/.test(gr)) return 'ser';
    if (/SER.*ESTAR.*meaning shifts/.test(gr)) return makeRng(rng)() < 0.5 ? 'ser' : 'estar';
    return 'ser';
  }

  // ── Light semantic layer ──────────────────────────────────────────────────
  // Coarse classes keep noun↔adjective↔verb pairings sensible in context.
  function hasCat(e, c) { return (e.categories || []).indexOf(c) >= 0; }
  function nounClass(e) {
    if (hasCat(e, 'Animales')) return 'animal';
    if (hasCat(e, 'Familia y relaciones') || hasCat(e, 'Descripción personal')) return 'person';
    if (hasCat(e, 'Anatomía y cuerpo')) return 'body';
    if (hasCat(e, 'Alimentación')) return 'food';
    if (hasCat(e, 'Ropa y accesorios')) return 'clothing';
    if (hasCat(e, 'Ciudad y transporte') || hasCat(e, 'Casa y hogar') || hasCat(e, 'Orientación y direcciones')) return 'place';
    return 'thing';
  }
  // Adjectives that read fine on inanimate things too (size/aesthetic/quality)
  var NEUTRAL_ADJ = ['grande', 'bonito', 'feo', 'viejo', 'nuevo', 'largo', 'pequeño',
    'caro', 'barato', 'bueno/buen', 'malo/mal', 'corto', 'limpio', 'sucio'];
  // adjDomain: 'animate' (living beings), 'food', 'neutral' (anything), or 'special' (weather/quantity/medical — avoid as a plain descriptor)
  function adjDomain(e) {
    if (NEUTRAL_ADJ.indexOf(e.word) >= 0) return 'neutral';
    if (hasCat(e, 'Tiempo y frecuencia') || hasCat(e, 'Cantidades y comparaciones')) return 'special';
    if (hasCat(e, 'Emociones y estados') || hasCat(e, 'Salud y síntomas') || hasCat(e, 'Familia y relaciones')) return 'animate';
    if (hasCat(e, 'Alimentación') && !hasCat(e, 'Descripción personal')) return 'food';
    if (hasCat(e, 'Medicina y tratamiento') && !hasCat(e, 'Descripción personal')) return 'special';
    if (hasCat(e, 'Descripción personal') || hasCat(e, 'Cultura tapatía')) return 'animate';
    return 'neutral';
  }
  // Adjectives usable as a plain descriptor (excludes weather/quantity/medical specials)
  function describableAdj(e) { return adjDomain(e) !== 'special'; }
  // Which noun classes a given adjective can describe
  function nounClassesForAdj(e) {
    var d = adjDomain(e);
    if (d === 'food') return ['food'];
    if (d === 'animate') return ['person', 'animal'];
    return null; // neutral → any concrete noun
  }
  // Verb → plausible direct-object classes (for the DO-pronoun template)
  var VERB_OBJ_CLASS = {
    comer: ['food'], probar: ['food'], tomar: ['food'], cocinar: ['food'], preparar: ['food'],
    lavar: ['clothing', 'thing'], planchar: ['clothing'], comprar: ['food', 'clothing', 'thing'],
    vender: ['food', 'clothing', 'thing'], ver: ['person', 'animal', 'place', 'thing'],
    querer: ['person', 'animal', 'thing'], buscar: ['person', 'animal', 'thing', 'place'],
    traer: ['food', 'clothing', 'thing'], cuidar: ['person', 'animal'], leer: ['thing']
  };
  function nounPool(model, opts) {
    opts = opts || {};
    var pool = model.nouns;
    if (opts.classes) {
      pool = pool.filter(function (e) { return opts.classes.indexOf(nounClass(e)) >= 0; });
    } else if (opts.cats) {
      var filtered = pool.filter(function (e) {
        return (e.categories || []).some(function (c) { return opts.cats.indexOf(c) >= 0; });
      });
      if (filtered.length > 8) pool = filtered;
    }
    if (opts.gender) pool = pool.filter(function (e) { return nounGN(e).gender === opts.gender; });
    return pool;
  }

  // ════════════════════════════════════════════════════════════════════════
  // TEMPLATES — each returns a finalized exercise or null
  // ════════════════════════════════════════════════════════════════════════
  var TEMPLATES = [];

  // 1. Verb conjugation (subject given, verb blanked) — 3 tenses
  TEMPLATES.push(function (model, rng, mode) {
    var tense = pick(['present', 'present', 'preterite', 'imperfect'], rng);
    var elig = model.verbs.filter(function (e) { return hasFullTense(e, tense); });
    var v = weightedPick(elig, rng); if (!v) return null;
    var per = pick(PERSONS, rng);
    var form = tenseObj(v, tense)[per.conjKey];
    var cue = pick(CUES[tense], rng);
    var opts = mode === 'choice' ? uniqueOptions(form, distractVerb(v, tense, per.conjKey, rng), 4, rng) : null;
    var b = blank('verb', form, { options: opts, wordKey: v.word, gloss: v.english, note: v.grammar_notes });
    var parts = [T(cue + ', ' + per.subj + ' '), B(b), T('.')];
    return finalize('conjVerb', tense, per.id, parts, rng);
  });

  // 2. Subject pronoun blank (verb given) — unique persons only
  TEMPLATES.push(function (model, rng, mode) {
    var tense = pick(['present', 'preterite'], rng);
    var elig = model.verbs.filter(function (e) { return hasFullTense(e, tense); });
    var v = weightedPick(elig, rng); if (!v) return null;
    var per = personById(pick(UNIQUE_SUBJ_PERSONS, rng));
    var form = tenseObj(v, tense)[per.conjKey];
    var opts = mode === 'choice' ? uniqueOptions(cap(per.subj), ALL_SUBJ_PRON.map(cap), 4, rng) : null;
    var b = blank('subject-pronoun', cap(per.subj), { options: opts, note: 'Pronombre de sujeto (' + per.conjKey + ').' });
    var parts = [B(b), T(' ' + form + ' todos los días.')];
    return finalize('subjPron', tense, per.id, parts, rng);
  });

  // 3. Possessive adjective blank
  TEMPLATES.push(function (model, rng, mode) {
    var noun = weightedPick(nounPool(model, { cats: ['Familia y relaciones', 'Casa y hogar', 'Ropa y accesorios'] }), rng);
    if (!noun) return null;
    var gn = nounGN(noun);
    var per = pick(PERSONS, rng);
    var ans = possFor(per.id, gn.gender, gn.num);
    var pool = gn.num === 'plur' ? ALL_POSS_PLUR : ALL_POSS_SING;
    var opts = mode === 'choice' ? uniqueOptions(ans, pool, 4, rng) : null;
    var b = blank('possessive', ans, { options: opts, wordKey: noun.word, gloss: noun.english,
      note: 'Posesivo átono; concuerda con "' + noun.word + '" (' + gn.gender + ', ' + gn.num + ').' });
    var decir = model.byWord['decir'];
    var dForm = (decir && decir.present_conjugation[per.conjKey]) || 'dice';
    var parts = [T(cap(per.subj) + ' ' + dForm + ' que '), B(b), T(' ' + noun.word + ' es importante.')];
    return finalize('possessive', 'present', per.id, parts, rng);
  });

  // 4. Definite article blank (gender/number agreement)
  TEMPLATES.push(function (model, rng, mode) {
    var noun = weightedPick(nounPool(model, { cats: SUBJECT_CATS }), rng); if (!noun) return null;
    var gn = nounGN(noun);
    var ans = defArtForNoun(noun, gn.num);
    var verb = weightedPick(model.verbs.filter(function (e) { return hasFullTense(e, 'present'); }), rng);
    var vform = verb ? tenseObj(verb, 'present')[gn.num === 'plur' ? 'ellos/ellas' : 'él/ella'] : 'está aquí';
    var opts = mode === 'choice' ? uniqueOptions(ans, ALL_ART_DEF, 4, rng) : null;
    var b = blank('article', ans, { options: opts, wordKey: noun.word, gloss: noun.english,
      note: 'Artículo definido; concuerda con "' + noun.word + '" (' + gn.gender + ', ' + gn.num + ').' });
    var parts = [B({ role: b.role, answer: cap(ans), options: opts ? opts.map(cap) : null, wordKey: noun.word, gloss: noun.english, note: b.note }),
      T(' ' + noun.word + ' ' + vform + '.')];
    return finalize('article', 'present', null, parts, rng);
  });

  // 5. Adjective agreement blank
  TEMPLATES.push(function (model, rng, mode) {
    var adjPool = (model.adjGender.length ? model.adjGender : model.adjectives).filter(describableAdj);
    var adj = weightedPick(adjPool, rng); if (!adj) return null;
    var classes = nounClassesForAdj(adj);
    var noun = weightedPick(nounPool(model, classes ? { classes: classes } : { cats: SUBJECT_CATS }), rng); if (!noun) return null;
    var gn = nounGN(noun);
    var ans = adjFor(adj, gn.gender, gn.num);
    var f = adjForms(adj);
    var opts = mode === 'choice' ? uniqueOptions(ans, [f.ms, f.fs, f.mp, f.fp], 4, rng) : null;
    var b = blank('adjective', ans, { options: opts, wordKey: adj.word, gloss: adj.english,
      note: 'Concordancia del adjetivo con "' + noun.word + '" (' + gn.gender + ', ' + gn.num + '). Base: ' + f.ms + '.' });
    var lemma = model.byWord[copulaForAdj(adj, rng)];
    var copForm = lemma ? lemma.present_conjugation[gn.num === 'plur' ? 'ellos/ellas' : 'él/ella'] : (gn.num === 'plur' ? 'son' : 'es');
    var parts = [T(cap(defArtForNoun(noun, gn.num)) + ' ' + noun.word + ' ' + copForm + ' muy '), B(b), T('.')];
    return finalize('adjAgree', 'present', null, parts, rng);
  });

  // 6. SER vs ESTAR — conjugated form blank (copula chosen from the adjective's tag)
  TEMPLATES.push(function (model, rng, mode) {
    // subject is a person pronoun → only adjectives that describe living beings
    var serPool = model.adjectives.filter(function (a) { var d = adjDomain(a); return d === 'animate' || d === 'neutral'; });
    var adj = weightedPick(serPool, rng); if (!adj) return null;
    var which = copulaForAdj(adj, rng);
    var entry = model.byWord[which]; if (!entry) return null;
    var per = pick(PERSONS, rng);
    var form = entry.present_conjugation[per.conjKey];
    var aForm = adjFor(adj, per.gender === 'f' ? 'f' : 'm', per.num);
    var distract = []
      .concat(Object.keys(model.byWord['ser'].present_conjugation).map(function (k) { return model.byWord['ser'].present_conjugation[k]; }))
      .concat(Object.keys(model.byWord['estar'].present_conjugation).map(function (k) { return model.byWord['estar'].present_conjugation[k]; }));
    var opts = mode === 'choice' ? uniqueOptions(form, distract, 4, rng) : null;
    var b = blank('ser-estar', form, { options: opts, wordKey: entry.word, gloss: entry.english,
      note: (which === 'estar' ? 'ESTAR — estado/condición temporal ("' + adj.word + '").' : 'SER — rasgo permanente ("' + adj.word + '").') });
    var parts = [T(cap(per.subj) + ' '), B(b), T(' ' + aForm + '.')];
    return finalize('serEstar', 'present', per.id, parts, rng);
  });

  // 7. Indirect-object pronoun blank
  // Transfer verbs only — they take a physical object handed to a recipient
  var IO_VERBS = ['dar', 'traer', 'comprar', 'mandar', 'pedir', 'enseñar', 'regalar', 'mostrar', 'vender', 'escribir'];
  TEMPLATES.push(function (model, rng, mode) {
    var elig = model.verbs.filter(function (e) { return IO_VERBS.indexOf(e.word) >= 0 && hasFullTense(e, 'present'); });
    if (!elig.length) elig = model.verbs.filter(function (e) { return hasFullTense(e, 'present'); });
    var v = weightedPick(elig, rng); if (!v) return null;
    var per = pick(PERSONS, rng);                       // who is doing the action
    var recipient = pick(['le', 'les'], rng);           // 3rd person recipient
    var recName = recipient === 'le' ? 'a María' : 'a mis amigos';
    var form = v.present_conjugation[per.conjKey];
    var noun = weightedPick(nounPool(model, { classes: ['food', 'clothing', 'thing'] }), rng);
    var gn = noun ? nounGN(noun) : { gender: 'm', num: 'sing' };
    var obj = noun ? (indefArtForNoun(noun, gn.num) + ' ' + noun.word) : 'un regalo';
    var opts = mode === 'choice' ? uniqueOptions(recipient, ALL_IO, 4, rng) : null;
    var b = blank('io-pronoun', recipient, { options: opts, wordKey: v.word, gloss: v.english,
      note: 'Pronombre de objeto indirecto (reduplicado con "' + recName + '").' });
    var parts = [T(cap(per.subj) + ' '), B(b), T(' ' + form + ' ' + obj + ' ' + recName + '.')];
    return finalize('ioPron', 'present', per.id, parts, rng);
  });

  // 8. GUSTAR-type — IO pronoun + verb agreement (2 blanks)
  TEMPLATES.push(function (model, rng, mode) {
    var g = weightedPick(model.gustars, rng); if (!g) return null;
    var per = pick(PERSONS, rng);
    var ioAns = per.io;
    var expMap = { yo: 'A mí', tu: 'A ti', el: 'A él', ella: 'A ella', nos: 'A nosotros', ellos: 'A ellos' };
    var plural = makeRng(rng)() < 0.5;
    var classes = g.word === 'doler' ? ['body'] : ['food', 'animal'];
    var noun = weightedPick(nounPool(model, { classes: classes }), rng);
    var gn = noun ? nounGN(noun) : { gender: 'm', num: plural ? 'plur' : 'sing' };
    var num = noun ? gn.num : (plural ? 'plur' : 'sing');
    var verbForm = splitGustar(g.present_conjugation[per.io === 'le' ? 'le' : (per.io)] || g.present_conjugation['me'])[num === 'plur' ? 'plur' : 'sing'];
    var obj = noun ? (defArtForNoun(noun, num) + ' ' + noun.word) : (num === 'plur' ? 'los tacos' : 'el café');
    var ioOpts = mode === 'choice' ? uniqueOptions(ioAns, ALL_IO, 4, rng) : null;
    var gust = splitGustar(g.present_conjugation['me']);
    var vOpts = mode === 'choice' ? uniqueOptions(verbForm, [gust.sing, gust.plur], 2, rng) : null;
    var b1 = blank('io-pronoun', ioAns, { options: ioOpts, note: 'Objeto indirecto del verbo tipo gustar.' });
    var b2 = blank('gustar-verb', verbForm, { options: vOpts, wordKey: g.word, gloss: g.english,
      note: 'Concuerda con el sujeto pospuesto "' + obj + '" (' + num + ').' });
    var parts = [T(expMap[per.id] + ' '), B(b1), T(' '), B(b2), T(' ' + obj + '.')];
    return finalize('gustar', 'present', per.id, parts, rng);
  });

  // 9. Reflexive — reflexive pronoun + verb (2 blanks)
  TEMPLATES.push(function (model, rng, mode) {
    var tense = pick(['present', 'present', 'preterite'], rng);
    var elig = model.reflexives.filter(function (e) { return ROUTINE_REFLEXIVES.indexOf(e.word) >= 0 && hasFullTense(e, tense); });
    if (elig.length < 3) elig = model.reflexives.filter(function (e) { return hasFullTense(e, tense); });
    var v = weightedPick(elig, rng); if (!v) return null;
    var per = pick(PERSONS, rng);
    var raw = tenseObj(v, tense)[per.conjKey];
    var sp = splitReflexive(raw); if (!sp) return null;
    var cue = pick(CUES[tense], rng);
    var reflOpts = mode === 'choice' ? uniqueOptions(sp.pron, ALL_REFL, 4, rng) : null;
    var verbOpts = mode === 'choice' ? uniqueOptions(sp.verb, Object.keys(tenseObj(v, tense)).map(function (k) { var s = splitReflexive(tenseObj(v, tense)[k]); return s ? s.verb : tenseObj(v, tense)[k]; }), 4, rng) : null;
    var b1 = blank('reflexive-pronoun', sp.pron, { options: reflOpts, note: 'Pronombre reflexivo (concuerda con ' + per.subj + ').' });
    var b2 = blank('verb', sp.verb, { options: verbOpts, wordKey: v.word, gloss: v.english, note: v.grammar_notes });
    var parts = [T(cue + ', ' + per.subj + ' '), B(b1), T(' '), B(b2), T('.')];
    return finalize('reflexive', tense, per.id, parts, rng);
  });

  // 10. Near future: ir + a + infinitive (2 blanks: ir-form + infinitive)
  TEMPLATES.push(function (model, rng, mode) {
    var ir = model.byWord['ir']; if (!ir || !ir.present_conjugation) return null;
    var per = pick(PERSONS, rng);
    var irForm = ir.present_conjugation[per.conjKey];
    var v = weightedPick(model.verbs.filter(function (e) { return hasFullTense(e, 'present'); }), rng); if (!v) return null;
    var irOpts = mode === 'choice' ? uniqueOptions(irForm, Object.keys(ir.present_conjugation).map(function (k) { return ir.present_conjugation[k]; }), 4, rng) : null;
    var infOpts = mode === 'choice' ? uniqueOptions(v.word, shuffle(model.verbs, rng).slice(0, 5).map(function (e) { return e.word; }), 4, rng) : null;
    var b1 = blank('verb', irForm, { options: irOpts, wordKey: 'ir', gloss: ir.english, note: 'IR (presente) — futuro próximo.' });
    var b2 = blank('infinitive', v.word, { options: infOpts, wordKey: v.word, gloss: v.english, note: 'Infinitivo tras "ir a".' });
    var parts = [T('Mañana ' + per.subj + ' '), B(b1), T(' a '), B(b2), T('.')];
    return finalize('futuroProximo', 'present', per.id, parts, rng);
  });

  // 11. Direct-object pronoun (replace a known noun)
  TEMPLATES.push(function (model, rng, mode) {
    var v = weightedPick(model.verbs.filter(function (e) { return VERB_OBJ_CLASS[e.word] && hasFullTense(e, 'present'); }), rng);
    if (!v) return null;
    var noun = weightedPick(nounPool(model, { classes: VERB_OBJ_CLASS[v.word] }), rng); if (!noun) return null;
    var gn = nounGN(noun);
    var per = personById(pick(['yo', 'nos', 'ellos'], rng));
    var form = v.present_conjugation[per.conjKey];
    var ans = doFor(gn.gender, gn.num);
    var opts = mode === 'choice' ? uniqueOptions(ans, ALL_DO, 4, rng) : null;
    var b = blank('do-pronoun', ans, { options: opts, wordKey: noun.word, gloss: noun.english,
      note: 'Objeto directo; reemplaza "' + defArtForNoun(noun, gn.num) + ' ' + noun.word + '" (' + gn.gender + ', ' + gn.num + ').' });
    // Use the chosen (in-dictionary) verb for the setup clause too — never a hard-coded form
    var parts = [T(cap(per.subj) + ' ' + form + ' ' + defArtForNoun(noun, gn.num) + ' ' + noun.word + '. ' + cap(per.subj) + ' '), B(b), T(' ' + form + ' siempre.')];
    return finalize('doPron', 'present', per.id, parts, rng);
  });

  // ════════════════════════════════════════════════════════════════════════
  // BATTERY GENERATION
  // ════════════════════════════════════════════════════════════════════════
  function generateBattery(model, opts) {
    opts = opts || {};
    var count = opts.count || 50;
    var mode = opts.mode || 'typed';   // 'typed' | 'choice'
    var rng = makeRng(opts.rng);
    var out = [], seen = {}, guard = 0;
    var maxGuard = count * 60;
    while (out.length < count && guard < maxGuard) {
      guard++;
      var tpl = pick(TEMPLATES, rng);
      var ex;
      try { ex = tpl(model, rng, mode); } catch (e) { ex = null; }
      if (!ex) continue;
      if (seen[ex.key]) continue;
      // enforce blank count and that no blank answer is empty
      var ok = ex.blanks.length >= 1 && ex.blanks.length <= 3;
      ex.blanks.forEach(function (b) { if (!b.answer) ok = false; });
      if (!ok) continue;
      seen[ex.key] = 1;
      ex.index = out.length;
      ex.round = Math.floor(out.length / 10);
      ex.mode = mode;
      out.push(ex);
    }
    return out;
  }

  // ── Grading → Leitner words ───────────────────────────────────────────────
  // perBlankCorrect: array<boolean> aligned to exercise.blanks
  // returns [{word, knew}] for blanks that map to a dictionary word
  function gradeExercise(exercise, perBlankCorrect) {
    var agg = {};  // word -> knew (AND across blanks for that word)
    exercise.blanks.forEach(function (b, i) {
      if (!b.wordKey) return;
      var knew = !!perBlankCorrect[i];
      if (agg.hasOwnProperty(b.wordKey)) agg[b.wordKey] = agg[b.wordKey] && knew;
      else agg[b.wordKey] = knew;
    });
    return Object.keys(agg).map(function (w) { return { word: w, knew: agg[w] }; });
  }

  return {
    classify: classify,
    generateBattery: generateBattery,
    gradeExercise: gradeExercise,
    // exposed for testing
    PERSONS: PERSONS,
    leitnerWeight: leitnerWeight,
    adjForms: adjForms,
    possFor: possFor,
    nounGN: nounGN,
    splitGustar: splitGustar,
    splitReflexive: splitReflexive,
    hasFullTense: hasFullTense,
    TEMPLATES: TEMPLATES
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = SentenceEngine; }
