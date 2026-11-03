// Persistence + spaced repetition (SM-2 style with short learning steps).
const KEY = 'francais-pro-v1';
const DAY = 86400000, MIN = 60000;

const Store = (() => {
  const defaults = {
    cards: {},          // id -> { due, ivl (days), ease, reps, lapses, seen, flag }
    log: {},            // 'YYYY-MM-DD' -> { reviews, correct, newSeen }
    quiz: [],           // [{ date, score, total, kind }]
    settings: { newPerDay: 20, rate: 0.95, slowRate: 0.6, voice: '', direction: 'fr-en', autoplay: true, levels: [1, 2, 3] },
  };
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { data = {}; }
  data = { ...defaults, ...data, settings: { ...defaults.settings, ...(data.settings || {}) } };

  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ } }
  return {
    get cards() { return data.cards; },
    get log() { return data.log; },
    get quiz() { return data.quiz; },
    get settings() { return data.settings; },
    save,
    exportJSON: () => JSON.stringify(data, null, 1),
    importJSON(json) { const d = JSON.parse(json); if (!d || typeof d !== 'object' || !d.cards) throw new Error('Not a Français Pro backup'); data = { ...defaults, ...d, settings: { ...defaults.settings, ...(d.settings || {}) } }; save(); },
    reset() { data = JSON.parse(JSON.stringify(defaults)); save(); },
  };
})();

function today(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function dayLog(key = today()) {
  return Store.log[key] || (Store.log[key] = { reviews: 0, correct: 0, newSeen: 0 });
}

const SRS = {
  state(id) { return Store.cards[id]; },
  isNew(id) { return !Store.cards[id] || !Store.cards[id].seen; },
  isDue(id, now = Date.now()) { const s = Store.cards[id]; return s && s.seen && s.due <= now; },

  // Card maturity bucket for progress display.
  bucket(id) {
    const s = Store.cards[id];
    if (!s || !s.seen) return 'new';
    if (s.ivl >= 21) return 'mastered';
    if (s.ivl >= 3) return 'review';
    return 'learning';
  },
  isDifficult(id) {
    const s = Store.cards[id];
    return !!s && (s.flag || s.lapses >= 2 || (s.seen && s.ease < 2.1));
  },

  // Preview the next interval for each grade (for button labels).
  preview(id) {
    return [1, 2, 3, 4].map(g => SRS.next(Store.cards[id], g).due - Date.now());
  },

  // Pure function: compute next state. grade 1=Again 2=Hard 3=Good 4=Easy
  next(prev, grade, now = Date.now()) {
    const s = prev ? { ...prev } : { ivl: 0, ease: 2.5, reps: 0, lapses: 0, seen: 0, flag: false };
    s.seen = (s.seen || 0) + 1;
    if (grade === 1) {
      if (s.reps > 0) s.lapses += 1;
      s.reps = 0; s.ivl = 0;
      s.ease = Math.max(1.3, s.ease - 0.2);
      s.due = now + 1 * MIN;
      return s;
    }
    if (s.reps === 0) {
      // Learning phase: Hard -> 10 min, Good -> 1 day, Easy -> 4 days
      s.ivl = grade === 2 ? 0 : grade === 3 ? 1 : 4;
      if (grade === 2) { s.ease = Math.max(1.3, s.ease - 0.15); s.due = now + 10 * MIN; s.reps = 0; return s; }
    } else if (grade === 2) {
      s.ivl = Math.max(1, s.ivl * 1.2);
      s.ease = Math.max(1.3, s.ease - 0.15);
    } else if (grade === 3) {
      s.ivl = s.reps === 1 ? Math.max(3, s.ivl * s.ease) : s.ivl * s.ease;
    } else {
      s.ivl = Math.max(4, s.ivl * s.ease * 1.3);
      s.ease += 0.15;
    }
    s.ivl = Math.min(365, Math.round(s.ivl * 10) / 10);
    s.reps += 1;
    s.due = now + s.ivl * DAY;
    return s;
  },

  grade(id, grade) {
    const wasNew = SRS.isNew(id);
    Store.cards[id] = SRS.next(Store.cards[id], grade);
    const l = dayLog();
    l.reviews += 1;
    if (grade >= 3) l.correct += 1;
    if (wasNew) l.newSeen += 1;
    Store.save();
  },

  toggleFlag(id) {
    const s = Store.cards[id] || (Store.cards[id] = { ivl: 0, ease: 2.5, reps: 0, lapses: 0, seen: 0, due: 0, flag: false });
    s.flag = !s.flag;
    Store.save();
    return s.flag;
  },

  newLeftToday() { return Math.max(0, Store.settings.newPerDay - dayLog().newSeen); },

  // Build a session queue: due cards first (most overdue first), then today's allowance of new cards.
  buildQueue({ deckIds = null, levels = Store.settings.levels, mode = 'mixed', limit = 60 } = {}) {
    const now = Date.now();
    const pool = CARDS.filter(c => (!deckIds || deckIds.includes(c.deck)) && levels.includes(c.lvl));
    const due = pool.filter(c => SRS.isDue(c.id, now)).sort((a, b) => Store.cards[a.id].due - Store.cards[b.id].due);
    if (mode === 'difficult') return shuffle(pool.filter(c => SRS.isDifficult(c.id))).slice(0, limit);
    if (mode === 'due') return due.slice(0, limit);
    const fresh = pool.filter(c => SRS.isNew(c.id)).sort((a, b) => a.lvl - b.lvl || a.idx - b.idx); // easier first, topics interleaved
    const nNew = mode === 'new' ? limit : Math.min(SRS.newLeftToday(), Math.max(0, limit - due.length));
    const picked = mode === 'new' ? [] : due;
    // Interleave new cards among due cards so a session doesn't end on a wall of new material.
    const out = [...picked];
    fresh.slice(0, nNew).forEach((c, i) => out.splice(Math.min(out.length, i * 3 + 1), 0, c));
    return out.slice(0, limit);
  },

  streak() {
    let n = 0; const d = new Date();
    if (!(Store.log[today(d)] || {}).reviews) d.setDate(d.getDate() - 1); // today not done yet doesn't break it
    while ((Store.log[today(d)] || {}).reviews) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },
};

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function fmtIvl(ms) {
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`;
  const d = ms / DAY;
  if (d < 30) return `${Math.round(d)}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}
