// node tools/validate.js — checks card data integrity
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {} }; ctx.window.window = ctx.window; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/registry.js'), 'utf8'), ctx);
ctx.deck = ctx.window.deck;
const files = fs.readdirSync(path.join(__dirname, '../data')).filter(f => f.endsWith('.js')).sort();
for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '../data', f), 'utf8'), ctx, { filename: f });
const { DECKS, CARDS } = ctx.window;
let errors = 0;
const seen = new Map();
for (const c of CARDS) {
  const bad = [];
  if (!c.fr || !c.en || !c.ex || !c.exEn || !c.note) bad.push('missing field');
  if (!['F', 'N', 'I'].includes(c.reg)) bad.push('bad register ' + c.reg);
  if (![1, 2, 3].includes(c.lvl)) bad.push('bad level ' + c.lvl);
  if (c.ex && c.exEn && c.ex.split('\n').length !== c.exEn.split('\n').length) bad.push('dialogue line mismatch');
  if (bad.length) { errors++; console.log('ERR', c.id, c.fr, bad.join(', ')); }
  const k = c.fr.toLowerCase().replace(/[’']/g, "'").replace(/[.!?…\s]+$/, '');
  if (seen.has(k)) console.log('DUP', c.id, 'vs', seen.get(k), '—', c.fr); else seen.set(k, c.id);
}
for (const d of DECKS) console.log(String(d.cardIds.length).padStart(4), d.id, d.name);
const by = k => CARDS.reduce((a, c) => (a[c[k]] = (a[c[k]] || 0) + 1, a), {});
console.log('TOTAL', CARDS.length, 'register', by('reg'), 'level', by('lvl'), 'dialogues', CARDS.filter(c => c.ex.includes('\n')).length);
process.exit(errors ? 1 : 0);
