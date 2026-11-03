// Text-to-speech using the browser's built-in French voices (Web Speech API).
const Speech = (() => {
  const synth = window.speechSynthesis;
  let voices = [];
  const listeners = [];

  // Higher-quality voices first when the browser offers them.
  const PREFERRED = [/google français/i, /amélie|amelie/i, /thomas/i, /audrey/i, /marie/i,
    /denise/i, /henri/i, /eloise|éloïse/i, /vivienne/i, /remy|rémy/i, /natural/i, /premium|enhanced/i];

  function score(v) {
    let s = 0;
    if (/^fr[-_]FR/i.test(v.lang)) s += 100; else if (/^fr/i.test(v.lang)) s += 40;
    PREFERRED.forEach((re, i) => { if (re.test(v.name)) s += 30 - i; });
    if (v.localService === false) s += 5; // cloud voices tend to sound better
    return s;
  }

  function load() {
    if (!synth) return;
    voices = synth.getVoices().filter(v => /^fr/i.test(v.lang)).sort((a, b) => score(b) - score(a));
    listeners.forEach(fn => fn(voices));
  }
  if (synth) {
    load();
    synth.onvoiceschanged = load;
  }

  function primary() {
    const chosen = Store.settings.voice;
    return voices.find(v => v.name === chosen) || voices[0] || null;
  }
  // A second, different voice for the other speaker in dialogues.
  function secondary() {
    const p = primary();
    return voices.find(v => v !== p && /^fr[-_]FR/i.test(v.lang)) || voices.find(v => v !== p) || p;
  }

  function utter(text, voice, rate) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = (voice && voice.lang) || 'fr-FR';
    if (voice) u.voice = voice;
    u.rate = rate;
    return u;
  }

  // Strip "A:"/"B:" speaker tags and speak dialogue lines with alternating voices.
  function speak(text, { slow = false, onend } = {}) {
    if (!synth) { toast('Audio is not supported in this browser.'); return; }
    synth.cancel();
    const rate = slow ? Store.settings.slowRate : Store.settings.rate;
    const lines = String(text).split('\n').map(s => s.trim()).filter(Boolean);
    const p = primary(), q = secondary();
    if (!p && !Speech.warned) { Speech.warned = true; toast('No French voice found — install one in your OS speech settings for better audio.'); }
    lines.forEach((line, i) => {
      const m = line.match(/^([AB]):\s*(.*)$/);
      const content = m ? m[2] : line;
      const voice = m ? (m[1] === 'A' ? p : q) : p;
      const u = utter(content, voice, rate);
      if (i === lines.length - 1 && onend) u.onend = onend;
      synth.speak(u);
    });
  }

  function stop() { if (synth) synth.cancel(); }

  return { speak, stop, get voices() { return voices; }, onVoices: fn => listeners.push(fn), supported: !!synth };
})();
