/* eslint-disable */
// Browser-side search against the files made by scripts/build-index.mjs.
// public/data is copied into the build, so Netlify serves it from its CDN.
import { normalize, shardFor, aliasGroup } from './text.js';

const cache = new Map();

// Each file is fetched once; a failed request is dropped so the next call tries again
const getJson = (url, fallback) => {
  if (!cache.has(url)) {
    const request = fetch(url).then((r) => (r.ok ? r.json() : fallback));
    request.catch(() => cache.delete(url));
    cache.set(url, request);
  }
  return cache.get(url);
};

export const getSongs = () => getJson('/data/songs.json', []);
export const getByName = () => getJson('/data/by-name.json', {});
const getShard = (letter) => getJson(`/data/words/${letter}.json`, {});

const bySongOrder = (a, b) =>
  (a.song.artist || '').localeCompare(b.song.artist || '', 'en', { sensitivity: 'base' }) ||
  a.song.title.localeCompare(b.song.title, 'en', { sensitivity: 'base' });

// The listed name matching `name` (case and accents ignored), or undefined
export const findListedName = async (name) => {
  const word = normalize(name).trim();
  return Object.keys(await getByName()).find((listed) => normalize(listed) === word);
};

// Songs whose lyrics contain the name, or one of its alternate forms, as a whole word.
// One entry per song, sorted by artist then title:
// [{ song: { id, title, artist, url }, lines: ["…"], form, alternate }]
// `form` is the word that matched; `alternate` is true when it isn't the searched name.
export async function searchName(name) {
  const word = normalize(name).trim();
  if (word.length < 2) return [];

  // Names in our list come prebuilt, aliases already merged
  const listed = await findListedName(name);
  if (listed) {
    const [songs, byName] = await Promise.all([getSongs(), getByName()]);
    return byName[listed].map(([id, lines, form]) => ({ song: songs[id], lines, form, alternate: form !== word }));
  }

  // Search the typed form first so it wins when a song has several forms
  const forms = [word, ...aliasGroup(word).filter((form) => form !== word)];
  const [songs, ...shards] = await Promise.all([
    getSongs(),
    ...forms.map((form) => getShard(shardFor(form))),
  ]);

  const results = new Map();
  forms.forEach((form, i) => {
    for (const [id, lines = []] of shards[i][form] || []) {
      if (!results.has(id)) {
        results.set(id, { song: songs[id], lines, form, alternate: form !== word });
      }
    }
  });
  return [...results.values()].sort(bySongOrder);
}
