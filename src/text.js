/* eslint-disable */
// Shared by scripts/build-index.mjs and src/search.js so indexing and searching
// normalize words the same way.
import { nameAlternates } from './data/names.js';

// Lowercase and strip accents/tone marks so "Ṣadé" and "Sade" match.
export const normalize = (s) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// The indexed words inside one whitespace-separated token ("Ṣadé," -> ["sade"]).
export const wordsIn = (token) => normalize(token).match(/\p{L}{2,}/gu) || [];

export const shardFor = (word) => (/[a-z]/.test(word[0]) ? word[0] : '_');

// A name and its alternates form one group: "folashade" -> ["sade", "folashade", "folasade"].
export const aliasGroup = (word) => {
  for (const [key, alternates] of Object.entries(nameAlternates)) {
    const group = [key, ...alternates];
    if (group.includes(word)) return group;
  }
  return [word];
}
