// Français Pro — views and interaction.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const REG = { F: ['Formal', 'f'], N: ['Neutral', 'n'], I: ['Informal', 'i'] };
const LVL = { 1: 'Core', 2: 'Fluent', 3: 'Polished' };
const deckById = id => DECKS.find(d => d.id === id);

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200); }
window.toast = toast;

// ---------- shared renderers ----------
function regBadge(c) { const [label, cls] = REG[c.reg] || REG.N; return `<span class="badge reg-${cls}">${label}</span>`; }
function lvlBadge(c) { return `<span class="badge lvl">${'●'.repeat(c.lvl)}${'○'.repeat(3 - c.lvl)} ${LVL[c.lvl]}</span>`; }
function audioBtns(text, label = '') {
  const t = esc(text);
  return `<span class="audio">${label ? `<span class="audio-label">${label}</span>` : ''}<button class="icon-btn" data-say="${t}" title="Play (P)" aria-label="Play">▶</button><button class="icon-btn slow" data-say="${t}" data-slow="1" title="Play slowly (S)" aria-label="Play slowly">🐢</button></span>`;
}
function renderLines(text, cls = '') {
  const lines = String(text).split('\n');
  if (lines.length === 1) return `<p class="${cls}">${esc(text)}</p>`;
  return `<div class="dialogue ${cls}">${lines.map(l => {
    const m = l.match(/^([AB]):\s*(.*)$/);
    return m ? `<div class="line"><span class="who who-${m[1].toLowerCase()}">${m[1]}</span><span>${esc(m[2])}</span></div>` : `<div class="line"><span>${esc(l)}</span></div>`;
  }).join('')}</div>`;
}
function cardBack(c) {
  return `
    <div class="meaning">${esc(c.en)}</div>
    <div class="example">
      <div class="ex-head"><span class="label">Example</span>${audioBtns(c.ex)}</div>
      ${renderLines(c.ex, 'fr')}
      ${renderLines(c.exEn, 'en')}
    </div>
    <div class="note"><span class="label">${REG[c.reg][0]} · when to use</span><p>${esc(c.note)}</p></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (b) { e.stopPropagation(); Speech.speak(b.dataset.say, { slow: !!b.dataset.slow }); }
  const go = e.target.closest('[data-go]');
  if (go) { if (location.hash.slice(1) === go.dataset.go) route(); else location.hash = go.dataset.go; }
});

// ---------- router ----------
const views = { home, study, browse, quiz, listen, settings };
let cleanup = null;
function route() {
  Speech.stop();
  if (cleanup) { cleanup(); cleanup = null; }
  const [name, qs] = (location.hash.slice(1) || 'home').split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === name));
  (views[name] || home)(params);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ---------- HOME ----------
function home() {
  const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
  CARDS.forEach(c => counts[SRS.bucket(c.id)]++);
  const due = CARDS.filter(c => SRS.isDue(c.id)).length;
  const newToday = Math.min(SRS.newLeftToday(), counts.new);
  const tl = dayLog();
  const acc = tl.reviews ? Math.round((tl.correct / tl.reviews) * 100) : null;
  const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); const k = today(d); return { k, d, n: (Store.log[k] || {}).reviews || 0 }; });
  const max = Math.max(10, ...days.map(x => x.n));
  const seen = CARDS.length - counts.new;

  app.innerHTML = `
  <section class="hero">
    <div>
      <p class="eyebrow">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      <h1>${due ? `${due} card${due > 1 ? 's' : ''} to review` : seen ? 'You’re caught up.' : 'Bienvenue.'}</h1>
      <p class="sub">${due || newToday ? `${newToday} new phrase${newToday === 1 ? '' : 's'} available today.` : 'Come back tomorrow, or drill difficult cards and quizzes.'} ${CARDS.length.toLocaleString()} phrases across ${DECKS.length} topics.</p>
      <div class="row">
        <button class="btn primary" data-go="study?auto=1" ${due || newToday ? '' : 'disabled'}>Start review</button>
        <button class="btn" data-go="listen">Listening practice</button>
        <button class="btn ghost" data-go="study?mode=difficult&auto=1" ${CARDS.some(c => SRS.isDifficult(c.id)) ? '' : 'disabled'}>Drill difficult</button>
      </div>
    </div>
    <div class="streak"><span class="big">${SRS.streak()}</span><span>day streak</span></div>
  </section>

  <section class="stats">
    ${stat('Mastered', counts.mastered, 'interval ≥ 3 weeks')}
    ${stat('In review', counts.review, 'interval 3–20 days')}
    ${stat('Learning', counts.learning, 'seen, still fresh')}
    ${stat('Not started', counts.new, 'of ' + CARDS.length)}
    ${stat('Today', tl.reviews, acc === null ? 'reviews' : `reviews · ${acc}% correct`)}
  </section>

  <section class="panel">
    <div class="panel-head"><h2>Last 14 days</h2><span class="muted">${days.reduce((a, b) => a + b.n, 0)} reviews</span></div>
    <div class="bars">${days.map(x => `<div class="bar" title="${x.k}: ${x.n} reviews"><i style="height:${(x.n / max) * 100}%"></i><span>${x.d.toLocaleDateString('en-US', { weekday: 'narrow' })}</span></div>`).join('')}</div>
  </section>

  <section>
    <div class="panel-head"><h2>Topics</h2><span class="muted">Bars show mastered · in review · learning</span></div>
    <div class="decks">${DECKS.map(deckTile).join('')}</div>
  </section>`;
}
function stat(label, n, sub) { return `<div class="stat"><span class="n">${n.toLocaleString()}</span><span class="l">${label}</span><span class="s">${sub}</span></div>`; }
function deckTile(d) {
  const b = { new: 0, learning: 0, review: 0, mastered: 0 };
  d.cardIds.forEach(id => b[SRS.bucket(id)]++);
  const n = d.cardIds.length, due = d.cardIds.filter(id => SRS.isDue(id)).length;
  const pct = k => (b[k] / n) * 100;
  return `<article class="deck">
    <div class="deck-top"><span class="deck-icon">${d.icon}</span><div><h3>${esc(d.name)}</h3><p class="fr-title">${esc(d.fr)}</p></div></div>
    <p class="deck-desc">${esc(d.desc)}</p>
    <div class="prog"><i class="m" style="width:${pct('mastered')}%"></i><i class="r" style="width:${pct('review')}%"></i><i class="l" style="width:${pct('learning')}%"></i></div>
    <div class="deck-foot"><span class="muted">${n} cards${due ? ` · <b>${due} due</b>` : ''}</span>
      <span class="row tight"><button class="btn sm" data-go="study?deck=${d.id}&auto=1">Study</button><button class="btn sm ghost" data-go="quiz?deck=${d.id}">Quiz</button><button class="btn sm ghost" data-go="browse?deck=${d.id}">Browse</button></span></div>
  </article>`;
}

// ---------- STUDY ----------
function deckSelect(id, selected = '') {
  return `<select id="${id}"><option value="">All topics</option>${DECKS.map(d => `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${d.icon} ${esc(d.name)}</option>`).join('')}</select>`;
}
function study(params) {
  const mode = params.mode || 'mixed';
  if (params.auto) return runStudy({ deckIds: params.deck ? [params.deck] : null, mode });
  app.innerHTML = `
  <section class="panel narrow">
    <h1>Review session</h1>
    <p class="sub">Due cards come first, then up to ${Store.settings.newPerDay} new phrases a day (change in settings).</p>
    <label class="field"><span>Topic</span>${deckSelect('s-deck', params.deck)}</label>
    <label class="field"><span>Cards</span><select id="s-mode">
      <option value="mixed">Due + new (recommended)</option>
      <option value="due">Due only</option>
      <option value="new">New only (ignores daily limit)</option>
      <option value="difficult">Difficult & flagged</option>
      <option value="cram">Cram: everything in the topic, shuffled</option>
    </select></label>
    <button class="btn primary" id="s-go">Start</button>
  </section>`;
  $('#s-mode').value = mode;
  $('#s-go').onclick = () => { const d = $('#s-deck').value; runStudy({ deckIds: d ? [d] : null, mode: $('#s-mode').value }); };
}

function runStudy({ deckIds, mode }) {
  let queue;
  if (mode === 'cram') queue = shuffle(CARDS.filter(c => (!deckIds || deckIds.includes(c.deck)) && Store.settings.levels.includes(c.lvl))).slice(0, 50);
  else queue = SRS.buildQueue({ deckIds, mode });
  const scoped = deckIds ? deckById(deckIds[0]) : null;
  if (!queue.length) {
    app.innerHTML = `<section class="panel narrow center"><h1>Nothing due${scoped ? ` in ${esc(scoped.name)}` : ''}.</h1>
      <p class="sub">${SRS.newLeftToday() ? '' : 'You’ve hit today’s new-card limit. '}Try new cards only, a quiz, or the listening drills.</p>
      <div class="row center"><button class="btn primary" data-go="study?mode=new&auto=1${scoped ? '&deck=' + scoped.id : ''}">Learn new cards</button><button class="btn" data-go="quiz${scoped ? '?deck=' + scoped.id : ''}">Take a quiz</button></div></section>`;
    return;
  }
  const total = queue.length; let done = 0, again = 0, flipped = false, card;
  const reverse = Store.settings.direction === 'en-fr';
  const cram = mode === 'cram';

  function show() {
    card = queue[0];
    if (!card) return finish();
    flipped = false;
    const st = SRS.state(card.id);
    const isNew = SRS.isNew(card.id);
    const d = deckById(card.deck);
    app.innerHTML = `
    <section class="study">
      <div class="study-top">
        <button class="btn sm ghost" data-go="home">✕ End</button>
        <div class="meter"><i style="width:${(done / total) * 100}%"></i></div>
        <span class="muted">${done}/${total}</span>
      </div>
      <article class="flash ${isNew ? 'is-new' : ''}" id="flash" tabindex="0">
        <div class="flash-meta">
          <span class="badge deck-b">${d.icon} ${esc(d.name)}</span>${regBadge(card)}${lvlBadge(card)}${isNew ? '<span class="badge new">New</span>' : ''}
          <button class="icon-btn flag ${st && st.flag ? 'on' : ''}" id="flag" title="Flag as difficult (F)" aria-label="Flag as difficult">⚑</button>
        </div>
        <div class="front">
          ${reverse ? `<div class="phrase en-phrase">${esc(card.en)}</div><p class="hint">Say it in French, then flip.</p>`
                    : `<div class="phrase">${esc(card.fr)}</div>${audioBtns(card.fr)}`}
        </div>
        <div class="back" id="back" hidden>
          ${reverse ? `<div class="phrase answer">${esc(card.fr)}</div>${audioBtns(card.fr)}` : ''}
          ${reverse ? cardBack({ ...card, en: '' }).replace('<div class="meaning"></div>', '') : cardBack(card)}
        </div>
      </article>
      <div class="controls" id="controls">
        <button class="btn primary wide" id="flip">Show answer <kbd>Space</kbd></button>
      </div>
    </section>`;
    $('#flip').onclick = flip;
    $('#flag').onclick = () => { const on = SRS.toggleFlag(card.id); $('#flag').classList.toggle('on', on); toast(on ? 'Flagged as difficult' : 'Flag removed'); };
    if (!reverse && Store.settings.autoplay) Speech.speak(card.fr);
  }
  function flip() {
    if (flipped) return; flipped = true;
    $('#back').hidden = false;
    $('#flash').classList.add('flipped');
    const pv = SRS.preview(card.id);
    const labels = [['Again', 'again'], ['Difficult', 'hard'], ['Good', 'good'], ['Easy', 'easy']];
    $('#controls').innerHTML = labels.map(([l, cls], i) => `<button class="grade ${cls}" data-g="${i + 1}"><b>${l}</b><span>${cram ? '' : fmtIvl(pv[i])}</span><kbd>${i + 1}</kbd></button>`).join('');
    $$('#controls .grade').forEach(b => (b.onclick = () => grade(+b.dataset.g)));
    if (Store.settings.autoplay) Speech.speak(reverse ? card.fr : card.ex);
  }
  function grade(g) {
    Speech.stop();
    if (!cram) SRS.grade(card.id, g);
    else if (g === 2 && !(SRS.state(card.id) || {}).flag) SRS.toggleFlag(card.id); // in cram, "Difficult" flags the card
    queue.shift();
    if (g === 1) { again++; queue.splice(Math.min(queue.length, 4), 0, card); }
    else done++;
    show();
  }
  function finish() {
    const tl = dayLog();
    app.innerHTML = `<section class="panel narrow center">
      <p class="eyebrow">Session complete</p><h1>Bien joué.</h1>
      <p class="sub">${total} card${total > 1 ? 's' : ''} reviewed${again ? `, ${again} repeat${again > 1 ? 's' : ''}` : ''}. Today: ${tl.reviews} reviews, ${tl.reviews ? Math.round((tl.correct / tl.reviews) * 100) : 0}% correct.</p>
      <div class="row center"><button class="btn primary" data-go="home">Home</button><button class="btn" data-go="quiz${deckIds ? '?deck=' + deckIds[0] : ''}">Quiz yourself</button><button class="btn" data-go="listen">Listening</button></div></section>`;
  }
  function onKey(e) {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipped ? grade(3) : flip(); }
    else if (flipped && '1234'.includes(e.key)) grade(+e.key);
    else if (e.key.toLowerCase() === 'p') Speech.speak(flipped ? card.ex : card.fr);
    else if (e.key.toLowerCase() === 's') Speech.speak(flipped ? card.ex : card.fr, { slow: true });
    else if (e.key.toLowerCase() === 'f') $('#flag').click();
  }
  document.addEventListener('keydown', onKey);
  cleanup = () => document.removeEventListener('keydown', onKey);
  show();
}

// ---------- BROWSE ----------
function browse(params) {
  app.innerHTML = `
  <section class="browse-head">
    <h1>Browse</h1>
    <div class="filters">
      <input id="b-q" type="search" placeholder="Search French or English…" value="${esc(params.q || '')}">
      ${deckSelect('b-deck', params.deck)}
      <select id="b-reg"><option value="">Any register</option><option value="F">Formal</option><option value="N">Neutral</option><option value="I">Informal</option></select>
      <select id="b-lvl"><option value="">Any level</option><option value="1">Core</option><option value="2">Fluent</option><option value="3">Polished</option></select>
      <select id="b-st"><option value="">Any status</option><option value="new">Not started</option><option value="learning">Learning</option><option value="review">In review</option><option value="mastered">Mastered</option><option value="difficult">Difficult / flagged</option></select>
    </div>
    <p class="muted" id="b-count"></p>
  </section>
  <section id="b-list" class="list"></section>`;
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let shown = 60;
  function render() {
    const q = norm($('#b-q').value.trim()), dk = $('#b-deck').value, rg = $('#b-reg').value, lv = $('#b-lvl').value, st = $('#b-st').value;
    const res = CARDS.filter(c => (!dk || c.deck === dk) && (!rg || c.reg === rg) && (!lv || c.lvl === +lv)
      && (!st || (st === 'difficult' ? SRS.isDifficult(c.id) : SRS.bucket(c.id) === st))
      && (!q || norm(c.fr + ' ' + c.en + ' ' + c.ex + ' ' + c.exEn).includes(q)));
    $('#b-count').textContent = `${res.length} card${res.length === 1 ? '' : 's'}`;
    $('#b-list').innerHTML = res.slice(0, shown).map(c => `
      <details class="item" data-id="${c.id}">
        <summary><span class="fr">${esc(c.fr)}</span><span class="en">${esc(c.en)}</span><span class="tags">${regBadge(c)}<span class="dot b-${SRS.bucket(c.id)}" title="${SRS.bucket(c.id)}"></span></span></summary>
        <div class="item-body">
          <div class="row spread">${audioBtns(c.fr, 'Phrase')}<span class="row tight">${lvlBadge(c)}<span class="badge deck-b">${deckById(c.deck).icon} ${esc(deckById(c.deck).name)}</span><button class="icon-btn flag ${(SRS.state(c.id) || {}).flag ? 'on' : ''}" data-flag="${c.id}" title="Flag as difficult">⚑</button></span></div>
          ${cardBack(c)}
        </div>
      </details>`).join('') + (res.length > shown ? `<button class="btn wide ghost" id="b-more">Show more (${res.length - shown} left)</button>` : '');
    const more = $('#b-more'); if (more) more.onclick = () => { shown += 100; render(); };
    $$('[data-flag]').forEach(b => (b.onclick = e => { e.preventDefault(); b.classList.toggle('on', SRS.toggleFlag(b.dataset.flag)); }));
  }
  ['b-q', 'b-deck', 'b-reg', 'b-lvl', 'b-st'].forEach(id => $('#' + id).addEventListener('input', () => { shown = 60; render(); }));
  render();
}

// ---------- QUIZ ----------
// Returns the expression's fixed text as it appears in the example (for gap-fill), or null.
function findInExample(c) {
  const ex = c.ex.replace(/’/g, "'");
  const parts = c.fr.replace(/’/g, "'").replace(/\(.*?\)/g, '').split(/\s*(?:\/|…|\.\.\.|qqch|qqn|\bX\b)\s*/).map(s => s.trim().replace(/[?!.,]+$/, '')).filter(s => s.length >= 5);
  parts.sort((a, b) => b.length - a.length);
  for (const p of parts) {
    const i = ex.toLowerCase().indexOf(p.toLowerCase());
    if (i >= 0) return { start: i, len: p.length, text: ex.substr(i, p.length) };
  }
  return null;
}
function distractors(c, n, field, pool) {
  const same = pool.filter(x => x.id !== c.id && x[field] !== c[field]);
  const sameDeck = shuffle(same.filter(x => x.deck === c.deck));
  const others = shuffle(same.filter(x => x.deck !== c.deck));
  const seen = new Set([c[field]]); const out = [];
  for (const x of [...sameDeck, ...others]) { if (!seen.has(x[field])) { seen.add(x[field]); out.push(x); } if (out.length >= n) break; }
  return out;
}
function makeQuestion(c, kind, pool) {
  if (kind === 'gap') {
    const f = findInExample(c);
    if (!f) return makeQuestion(c, 'fr-en', pool);
    const ex = c.ex.replace(/’/g, "'");
    const blanked = ex.slice(0, f.start) + '_____' + ex.slice(f.start + f.len);
    const opts = shuffle([f.text, ...distractors(c, 3, 'fr', pool).map(x => (x.fr.split(/\s*\/\s*/)[0]).replace(/\(.*?\)/g, '').trim())]);
    return { c, kind, prompt: 'Complete the sentence', body: renderLines(blanked, 'fr') + `<p class="muted small">${esc(c.exEn.split('\n').join(' '))}</p>`, opts, answer: f.text };
  }
  if (kind === 'reg') {
    const opts = ['Formal', 'Neutral', 'Informal'];
    return { c, kind, prompt: 'What register is this?', body: `<div class="phrase sm">${esc(c.fr)}</div>${audioBtns(c.fr)}`, opts, answer: REG[c.reg][0] };
  }
  if (kind === 'en-fr') {
    const opts = shuffle([c.fr, ...distractors(c, 3, 'fr', pool).map(x => x.fr)]);
    return { c, kind, prompt: 'Which French expression means…', body: `<div class="phrase sm en-phrase">${esc(c.en)}</div>`, opts, answer: c.fr };
  }
  const opts = shuffle([c.en, ...distractors(c, 3, 'en', pool).map(x => x.en)]);
  return { c, kind: 'fr-en', prompt: c.deck === 'lines' ? 'What do they actually mean?' : 'What does this mean?', body: `<div class="phrase sm">${esc(c.fr)}</div>${audioBtns(c.fr)}`, opts, answer: c.en };
}

function quiz(params) {
  app.innerHTML = `
  <section class="panel narrow">
    <h1>Quiz</h1>
    <p class="sub">Short mixed quizzes: meaning, reverse recall, fill the gap, and register. Cards you’ve already studied are prioritised.</p>
    <label class="field"><span>Topic</span>${deckSelect('q-deck', params.deck)}</label>
    <label class="field"><span>Length</span><select id="q-len"><option>10</option><option>20</option><option>30</option></select></label>
    <label class="field"><span>Question types</span><span class="checks">
      <label><input type="checkbox" value="fr-en" checked> French → English</label>
      <label><input type="checkbox" value="en-fr" checked> English → French</label>
      <label><input type="checkbox" value="gap" checked> Fill the gap</label>
      <label><input type="checkbox" value="reg"> Formal / neutral / informal</label></span></label>
    <button class="btn primary" id="q-go">Start quiz</button>
    ${Store.quiz.length ? `<h3 class="mt">Recent scores</h3><ul class="history">${Store.quiz.slice(-6).reverse().map(q => `<li><span>${q.date}</span><span>${esc(q.label)}</span><b>${q.score}/${q.total}</b></li>`).join('')}</ul>` : ''}
  </section>`;
  $('#q-go').onclick = () => {
    const kinds = $$('.checks input:checked').map(i => i.value);
    if (!kinds.length) return toast('Pick at least one question type.');
    const dk = $('#q-deck').value;
    runQuiz({ deckId: dk, n: +$('#q-len').value, kinds });
  };
}

function pickQuizCards(deckId, n) {
  const pool = CARDS.filter(c => (!deckId || c.deck === deckId) && Store.settings.levels.includes(c.lvl));
  const studied = shuffle(pool.filter(c => !SRS.isNew(c.id)));
  const rest = shuffle(pool.filter(c => SRS.isNew(c.id)));
  return { pool, picks: [...studied, ...rest].slice(0, n) };
}

function runQuiz({ deckId, n, kinds }) {
  const { pool, picks } = pickQuizCards(deckId, n);
  const qs = picks.map((c, i) => makeQuestion(c, kinds[i % kinds.length], pool));
  shuffle(qs);
  let i = 0, score = 0; const missed = [];
  const label = deckId ? deckById(deckId).name : 'All topics';
  function show() {
    const q = qs[i];
    if (!q) return end();
    app.innerHTML = `
    <section class="quiz">
      <div class="study-top"><button class="btn sm ghost" data-go="quiz">✕ Quit</button><div class="meter"><i style="width:${(i / qs.length) * 100}%"></i></div><span class="muted">${i + 1}/${qs.length}</span></div>
      <article class="panel">
        <p class="eyebrow">${q.prompt}</p>
        ${q.body}
        <div class="opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}"><kbd>${k + 1}</kbd><span>${esc(o)}</span></button>`).join('')}</div>
        <div id="q-fb"></div>
      </article>
    </section>`;
    $$('.opt').forEach(b => (b.onclick = () => answer(+b.dataset.k)));
    if (q.kind === 'reg' || q.kind === 'fr-en') { if (Store.settings.autoplay) Speech.speak(q.c.fr); }
  }
  let answered = false;
  function answer(k) {
    if (answered) return; answered = true;
    const q = qs[i], ok = q.opts[k] === q.answer;
    if (ok) score++; else missed.push(q.c);
    $$('.opt').forEach((b, j) => { b.disabled = true; if (q.opts[j] === q.answer) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
    $('#q-fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}"><b>${ok ? 'Exactement.' : 'Pas tout à fait.'}</b>
      <div class="fb-card"><div class="row spread"><span class="phrase xs">${esc(q.c.fr)}</span>${audioBtns(q.c.fr)}</div>${cardBack(q.c)}</div>
      <button class="btn primary" id="q-next">Next <kbd>Enter</kbd></button></div>`;
    $('#q-next').onclick = next;
    $('#q-next').focus();
  }
  function next() { answered = false; i++; show(); }
  function end() {
    Store.quiz.push({ date: today(), score, total: qs.length, label });
    Store.save();
    app.innerHTML = `<section class="panel narrow">
      <p class="eyebrow">Quiz complete · ${esc(label)}</p>
      <h1>${score}/${qs.length}</h1>
      <p class="sub">${score === qs.length ? 'Sans faute.' : score / qs.length >= 0.7 ? 'Solide.' : 'Worth another pass — missed cards are listed below.'}</p>
      ${missed.length ? `<button class="btn" id="q-flag">Flag ${missed.length} missed card${missed.length > 1 ? 's' : ''} as difficult</button>
        <ul class="missed">${missed.map(c => `<li><span class="fr">${esc(c.fr)}</span><span class="en">${esc(c.en)}</span>${audioBtns(c.fr)}</li>`).join('')}</ul>` : ''}
      <div class="row"><button class="btn primary" id="q-again">Another quiz</button><button class="btn" data-go="home">Home</button></div></section>`;
    $('#q-again').onclick = () => runQuiz({ deckId, n, kinds });
    const f = $('#q-flag'); if (f) f.onclick = () => { missed.forEach(c => { if (!(SRS.state(c.id) || {}).flag) SRS.toggleFlag(c.id); }); f.disabled = true; f.textContent = 'Flagged — find them under Review › Difficult'; };
  }
  function onKey(e) {
    if (e.target.matches('input, select, textarea')) return;
    if (!answered && /^[1-4]$/.test(e.key)) { const k = +e.key - 1; if (qs[i] && k < qs[i].opts.length) answer(k); }
    else if (answered && e.key === 'Enter') { e.preventDefault(); next(); }
  }
  document.addEventListener('keydown', onKey);
  cleanup = () => document.removeEventListener('keydown', onKey);
  show();
}

// ---------- LISTENING ----------
function listen(params) {
  app.innerHTML = `
  <section class="panel narrow">
    <h1>Listening</h1>
    <p class="sub">Hear the phrase in a realistic sentence or two-voice dialogue — no text until you answer.</p>
    ${Speech.supported ? '' : '<p class="warn">Your browser doesn’t support speech synthesis, so listening drills won’t play. Try Chrome, Edge or Safari.</p>'}
    <label class="field"><span>Topic</span>${deckSelect('l-deck', params.deck)}</label>
    <label class="field"><span>Exercise</span><select id="l-mode">
      <option value="meaning">What did they say? — pick the translation</option>
      <option value="spot">Spot the expression — which phrase was used?</option>
      <option value="dialogue">Dialogues only — follow a two-person exchange</option>
      <option value="dictation">Dictation — type the phrase you hear</option>
    </select></label>
    <label class="field"><span>Length</span><select id="l-len"><option>10</option><option>20</option></select></label>
    <button class="btn primary" id="l-go">Start</button>
  </section>`;
  $('#l-go').onclick = () => runListen({ deckId: $('#l-deck').value, mode: $('#l-mode').value, n: +$('#l-len').value });
}

function runListen({ deckId, mode, n }) {
  let pool = CARDS.filter(c => (!deckId || c.deck === deckId) && Store.settings.levels.includes(c.lvl));
  let cands = mode === 'dialogue' ? pool.filter(c => c.ex.includes('\n')) : mode === 'spot' ? pool.filter(c => findInExample(c)) : pool;
  if (cands.length < 4) cands = pool;
  const studied = shuffle(cands.filter(c => !SRS.isNew(c.id))), rest = shuffle(cands.filter(c => SRS.isNew(c.id)));
  const items = [...studied, ...rest].slice(0, n);
  let i = 0, score = 0, answered = false;
  const norm = s => s.toLowerCase().replace(/[’']/g, "'").replace(/[«»"“”.,!?;:…—–-]/g, ' ').replace(/\s+/g, ' ').trim();
  const loose = s => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

  function show() {
    const c = items[i]; if (!c) return end();
    answered = false;
    const audioText = mode === 'dictation' ? c.fr.split(/\s*\/\s*/)[0] : c.ex;
    let body;
    if (mode === 'dictation') {
      body = `<input id="l-in" class="dict" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type what you hear…"><button class="btn primary" id="l-check">Check <kbd>Enter</kbd></button>`;
    } else {
      const field = mode === 'spot' ? 'fr' : 'exEn';
      const right = mode === 'spot' ? c.fr : c.exEn;
      const opts = shuffle([right, ...distractors(c, 3, field, pool).map(x => x[field])]);
      body = `<div class="opts">${opts.map((o, k) => `<button class="opt" data-k="${k}"><kbd>${k + 1}</kbd><span>${esc(o.replace(/\n/g, ' / '))}</span></button>`).join('')}</div>`;
      items[i]._opts = opts; items[i]._right = right;
    }
    app.innerHTML = `
    <section class="quiz">
      <div class="study-top"><button class="btn sm ghost" data-go="listen">✕ Quit</button><div class="meter"><i style="width:${(i / items.length) * 100}%"></i></div><span class="muted">${i + 1}/${items.length}</span></div>
      <article class="panel">
        <p class="eyebrow">${mode === 'dictation' ? 'Type the phrase' : mode === 'spot' ? 'Which expression did you hear?' : 'What did they say?'}</p>
        <div class="listen-play"><button class="play-big" data-say="${esc(audioText)}" aria-label="Play">▶</button><button class="btn sm" data-say="${esc(audioText)}" data-slow="1">🐢 Slower</button></div>
        ${body}
        <div id="l-fb"></div>
      </article>
    </section>`;
    setTimeout(() => Speech.speak(audioText), 250);
    if (mode === 'dictation') {
      const inp = $('#l-in'); inp.focus();
      const check = () => {
        if (answered) return; answered = true;
        const target = audioText, got = inp.value;
        const ok = loose(got) === loose(target), nearly = !ok && loose(got).length > 0 && similarity(loose(got), loose(target)) > 0.8;
        if (ok || nearly) score++;
        inp.disabled = true; $('#l-check').remove();
        feedback(c, ok ? 'Parfait.' : nearly ? 'Presque — check the spelling.' : 'Pas tout à fait.', ok || nearly, `<p class="dict-target">${diffWords(norm(got), target)}</p>`);
      };
      $('#l-check').onclick = check;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); answered ? next() : check(); } });
    } else {
      $$('.opt').forEach(b => (b.onclick = () => choose(+b.dataset.k)));
    }
  }
  function choose(k) {
    if (answered) return; answered = true;
    const c = items[i], ok = c._opts[k] === c._right;
    if (ok) score++;
    $$('.opt').forEach((b, j) => { b.disabled = true; if (c._opts[j] === c._right) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
    feedback(c, ok ? 'Bien entendu.' : 'Pas tout à fait.', ok);
  }
  function feedback(c, title, ok, extra = '') {
    $('#l-fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}"><b>${title}</b>${extra}
      <div class="fb-card"><div class="row spread"><span class="phrase xs">${esc(c.fr)}</span>${audioBtns(c.fr)}</div>${cardBack(c)}</div>
      <button class="btn primary" id="l-next">Next <kbd>Enter</kbd></button></div>`;
    $('#l-next').onclick = next;
    if (mode !== 'dictation') $('#l-next').focus();
  }
  function next() { i++; show(); }
  function end() {
    Store.quiz.push({ date: today(), score, total: items.length, label: 'Listening · ' + mode });
    Store.save();
    app.innerHTML = `<section class="panel narrow center"><p class="eyebrow">Listening complete</p><h1>${score}/${items.length}</h1>
      <div class="row center"><button class="btn primary" id="l-again">Again</button><button class="btn" data-go="listen">Change exercise</button><button class="btn" data-go="home">Home</button></div></section>`;
    $('#l-again').onclick = () => runListen({ deckId, mode, n });
  }
  function onKey(e) {
    if (e.target.matches('input, select, textarea')) return;
    if (!answered && /^[1-4]$/.test(e.key) && mode !== 'dictation') choose(+e.key - 1);
    else if (answered && e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key.toLowerCase() === 'r') $('.play-big') && $('.play-big').click();
  }
  document.addEventListener('keydown', onKey);
  cleanup = () => document.removeEventListener('keydown', onKey);
  show();
}
function similarity(a, b) {
  const m = a.length, n = b.length; if (!m || !n) return 0;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
// Show the target with words the learner missed highlighted.
function diffWords(got, target) {
  const have = new Set(got.split(' ').map(w => w.normalize('NFD').replace(/[̀-ͯ]/g, '')));
  return target.split(/(\s+)/).map(w => {
    const k = w.toLowerCase().replace(/[’']/g, "'").replace(/[«»"“”.,!?;:…]/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '');
    return /\s+/.test(w) || !k ? esc(w) : have.has(k) ? `<span class="hit">${esc(w)}</span>` : `<span class="miss">${esc(w)}</span>`;
  }).join('');
}

// ---------- SETTINGS ----------
function settings() {
  const s = Store.settings;
  app.innerHTML = `
  <section class="panel narrow">
    <h1>Settings</h1>
    <h3>Audio</h3>
    <label class="field"><span>French voice</span><select id="st-voice"></select></label>
    <p class="muted small" id="st-voice-note"></p>
    <label class="field"><span>Normal speed <b id="st-rate-v">${s.rate}</b></span><input id="st-rate" type="range" min="0.7" max="1.2" step="0.05" value="${s.rate}"></label>
    <label class="field"><span>Slow speed <b id="st-slow-v">${s.slowRate}</b></span><input id="st-slow" type="range" min="0.4" max="0.85" step="0.05" value="${s.slowRate}"></label>
    <div class="row">${audioBtns('Bonjour à tous, on fait un point rapide sur les chiffres du trimestre ?', 'Test')}</div>
    <label class="check"><input type="checkbox" id="st-auto" ${s.autoplay ? 'checked' : ''}> Play audio automatically on each card</label>

    <h3 class="mt">Study</h3>
    <label class="field"><span>New cards per day</span><input id="st-new" type="number" min="0" max="200" value="${s.newPerDay}"></label>
    <label class="field"><span>Card direction</span><select id="st-dir"><option value="fr-en">French → English (recognise)</option><option value="en-fr">English → French (produce)</option></select></label>
    <label class="field"><span>Levels to include</span><span class="checks" id="st-lv">
      ${[1, 2, 3].map(l => `<label><input type="checkbox" value="${l}" ${s.levels.includes(l) ? 'checked' : ''}> ${'●'.repeat(l)} ${LVL[l]}</label>`).join('')}</span></label>

    <h3 class="mt">Your data</h3>
    <p class="muted small">Progress is saved in this browser only. Export a backup to move it to another device.</p>
    <div class="row"><button class="btn" id="st-exp">Export progress</button><label class="btn">Import<input type="file" id="st-imp" accept="application/json" hidden></label><button class="btn danger" id="st-reset">Reset all progress</button></div>

    <h3 class="mt">Keyboard</h3>
    <p class="muted small"><kbd>Space</kbd> flip / Good · <kbd>1</kbd>–<kbd>4</kbd> Again · Difficult · Good · Easy · <kbd>P</kbd> play · <kbd>S</kbd> slow · <kbd>F</kbd> flag · <kbd>R</kbd> replay in listening</p>
  </section>`;
  const fillVoices = () => {
    const sel = $('#st-voice'); if (!sel) return;
    const vs = Speech.voices;
    sel.innerHTML = vs.length ? vs.map(v => `<option value="${esc(v.name)}" ${v.name === s.voice ? 'selected' : ''}>${esc(v.name)} (${v.lang})</option>`).join('') : '<option>No French voices found</option>';
    $('#st-voice-note').textContent = vs.length ? `${vs.length} French voice${vs.length > 1 ? 's' : ''} available. Dialogues alternate between two voices when possible.` : 'Install a French voice in your system settings (macOS: Spoken Content › System voice › Manage voices; Windows: Time & Language › Speech).';
  };
  fillVoices(); Speech.onVoices(fillVoices);
  const upd = () => Store.save();
  $('#st-voice').onchange = e => { s.voice = e.target.value; upd(); Speech.speak('Bonjour, je serai votre voix.'); };
  $('#st-rate').oninput = e => { s.rate = +e.target.value; $('#st-rate-v').textContent = s.rate; upd(); };
  $('#st-slow').oninput = e => { s.slowRate = +e.target.value; $('#st-slow-v').textContent = s.slowRate; upd(); };
  $('#st-auto').onchange = e => { s.autoplay = e.target.checked; upd(); };
  $('#st-new').onchange = e => { s.newPerDay = Math.max(0, Math.min(200, +e.target.value || 0)); upd(); };
  $('#st-dir').value = s.direction; $('#st-dir').onchange = e => { s.direction = e.target.value; upd(); };
  $$('#st-lv input').forEach(i => (i.onchange = () => { const v = $$('#st-lv input:checked').map(x => +x.value); if (!v.length) { i.checked = true; return toast('Keep at least one level.'); } s.levels = v; upd(); }));
  $('#st-exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' })); a.download = `francais-pro-progress-${today()}.json`; a.click(); };
  $('#st-imp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { Store.importJSON(t); toast('Progress imported.'); route(); } catch (err) { toast('Import failed: ' + err.message); } }); };
  $('#st-reset').onclick = () => { if (confirm('Erase all progress, flags and quiz history? This can’t be undone.')) { Store.reset(); toast('Progress reset.'); route(); } };
}

route();
