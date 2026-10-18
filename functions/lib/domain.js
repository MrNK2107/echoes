// CommonJS mirror of mobile/src/domain/communities.ts; both are tested against
// fixtures/domain/communities.json.
const GEO_THRESHOLD = 5;

function normalizeName(s) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
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

module.exports = {
  GEO_THRESHOLD,
  normalizeName,
  searchRange,
  yearCommunity,
  eraCommunity,
  geoCommunity,
};
