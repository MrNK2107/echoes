// CommonJS mirror of mobile/src/domain/communities.ts and profanity.ts; both are tested against
// fixtures/domain/communities.json.
const GEO_THRESHOLD = 5;

function normalizeName(s) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase();
}

function searchRange(q) {
  const start = normalizeName(q);
  if ([...start].length < 2) return null;
  return { start, end: start + "" };
}

function yearCommunity(createdAt) {
  const y = createdAt.getUTCFullYear();
  return { id: `time-${y}`, name: `${y} Memories` };
}

function eraCommunity(createdAt) {
  const d = Math.floor(createdAt.getUTCFullYear() / 10) * 10;
  return { id: `era-${d}s`, name: `${d}s Era` };
}

function geoCommunity(place) {
  return { id: `geo-${place.id}`, name: `${place.name} Circle` };
}

// R21: lib/profanity.json is an exact copy of fixtures/domain/profanity.json (the functions
// bundle cannot reach the repo root); test/domain.test.js asserts they are equal.
const PROFANITY_WORDS = require("./profanity.json");
const WORD_SET = new Set(PROFANITY_WORDS);
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" };

function deLeet(token) {
  return token.replace(/[013457@$]/g, (c) => LEET[c] ?? c);
}

function containsProfanity(text) {
  const tokens = normalizeName(text).split(/[^\p{L}\p{N}@$]+/u);
  return tokens.some((t) => t.length > 0 && (WORD_SET.has(t) || WORD_SET.has(deLeet(t))));
}

module.exports = {
  PROFANITY_WORDS,
  containsProfanity,
  GEO_THRESHOLD,
  normalizeName,
  searchRange,
  yearCommunity,
  eraCommunity,
  geoCommunity,
};
