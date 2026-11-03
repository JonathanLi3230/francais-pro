// Card registry. Each data file calls deck(meta, cards).
// Card tuple: [french, english, example, exampleEnglish, register, level, note]
//   register: "F" formal · "N" neutral · "I" informal
//   level:    1 core (B1+) · 2 fluent (B2) · 3 polished (C1)
//   example:  a sentence, or a short dialogue with lines separated by "\n" and starting "A:" / "B:"
// Card IDs are deckId + index, so append new cards at the end of a deck to keep saved progress aligned.
window.DECKS = [];
window.CARDS = [];
window.CARD_BY_ID = {};

window.deck = function (meta, cards) {
  const d = { ...meta, cardIds: [] };
  cards.forEach((c, i) => {
    const [fr, en, ex, exEn, reg, lvl, note] = c;
    const card = { id: `${meta.id}-${i}`, deck: meta.id, idx: i, fr, en, ex, exEn, reg, lvl, note };
    window.CARDS.push(card);
    window.CARD_BY_ID[card.id] = card;
    d.cardIds.push(card.id);
  });
  window.DECKS.push(d);
};
