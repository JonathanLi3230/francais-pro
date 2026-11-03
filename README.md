# Français Pro

Spoken business French flashcards for intermediate learners working in a French (France) office — tuned for a sales & trading floor, with extra weight on small talk, presenting & feedback, and meetings.

**1,025 cards across 15 topics.** Every card has:

- the French phrase and its natural English meaning
- audio at normal and slow speed (🐢)
- a realistic example sentence or two-person dialogue, with translation
- a register tag (formal / neutral / informal) and a short note on when to use it
- a level: Core · Fluent · Polished

## Topics

| Topic | Cards |
|---|---|
| Small talk with colleagues (à la machine à café) | 108 |
| Trading floor & markets | 99 |
| Meetings & calls | 91 |
| Presenting | 80 |
| Idioms at work | 79 |
| Giving & receiving feedback | 68 |
| Reading between the lines (what colleagues *actually* mean) | 61 |
| Sales & negotiation | 61 |
| Polite disagreement | 59 |
| Asking for clarification | 55 |
| Deadlines & priorities | 55 |
| Networking & relationships | 54 |
| Making requests | 54 |
| Conversational shortcuts (du coup, bref, t'inquiète…) | 51 |
| Following up | 50 |

## Features

- **Spaced repetition** (SM-2 style): Again · Difficult · Good · Easy, with the next interval shown on each button. Due cards first, then a daily allowance of new cards (default 20).
- **Flag cards** as difficult (⚑) and drill them separately.
- **Progress**: mastered / in review / learning counts, per-topic progress bars, a 14-day activity chart, streak and daily accuracy.
- **Quizzes**: French → English, English → French, fill-the-gap in the example sentence, and "formal, neutral or informal?". Missed cards can be flagged in one click.
- **Listening**: hear a sentence or dialogue with no text and pick the translation; spot which expression was used; follow two-voice dialogues; or type what you hear (dictation with word-level feedback).
- **Browse & search** all cards by topic, register, level and status.
- **Settings**: French voice, normal/slow speed, card direction (recognise or produce), levels, autoplay, export/import of progress.

Keyboard: `Space` flip · `1`–`4` grade · `P` play · `S` slow · `F` flag · `R` replay (listening).

## Running it

No build step and no dependencies. Open `index.html` in Chrome, Edge or Safari, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

To host it, enable GitHub Pages on this repo (Settings › Pages › Deploy from branch › `main` / root).

### Audio

Audio uses the browser's built-in French voices (Web Speech API), so quality depends on your system. For the most natural sound:

- **macOS / iOS**: System Settings › Accessibility › Spoken Content › System voice › Manage voices → download a French (France) voice such as *Amélie* or *Thomas* (Enhanced/Premium).
- **Windows**: Settings › Time & language › Speech → add French (France). Edge's online "Natural" voices (e.g. *Denise*) are excellent.
- **Chrome** includes *Google français*.

Then pick the voice in ⚙ Settings. Dialogues alternate between two voices when two are available.

### Progress

Progress is stored in your browser's `localStorage`. Use **Settings › Export progress** to back it up or move it to another device.

## Adding cards

Cards live in `data/*.js`, one file per topic:

```js
// [french, english, example, exampleEnglish, register F|N|I, level 1|2|3, note]
["On fait un point rapide ?", "Shall we do a quick catch-up?",
 "On fait un point rapide à 14h sur le dossier Total ?", "Shall we do a quick catch-up at 2 on the Total file?",
 "N", 1, "« Faire un point » is the everyday way to say have a quick status meeting."],
```

For a dialogue, separate lines with `\n` and prefix them `A:` / `B:` (in both languages). Card IDs are `topic-index`, so **append** new cards to the end of a topic to keep saved progress aligned. Run `node tools/validate.js` to check fields and spot duplicates.
