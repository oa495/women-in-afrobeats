// Build a fast, small search index from scraped lyrics. Runs at deploy time
// (see the "build" script in package.json) so full lyrics never reach the browser.
//
// Usage:  node scripts/build-index.mjs [src/data/lyrics.json] [public/data]
//
// Input:  JSON array of { title, lyrics, artist?, url? }. Older entries have only
//         title + lyrics, with titles like "Wizkid-true-love".
// Output: public/data/songs.json      -> [{ id, title, artist, url }]   (no lyrics)
//         public/data/words/<x>.json  -> { "word": [[songId, ["line", ...]], [songId], ...] }
//                                        one shard per first letter
//         public/data/by-name.json    -> { "Chioma": [[songId, ["line", ...], "form"], ...] }
//                                        every listed name with songs, aliases merged
//
// The browser loads songs.json once, then only the shard for a name's first
// letter, so a search is a single small fetch plus an object lookup.

import fs from "node:fs";
import path from "node:path";
import { names, nameAlternates } from "../src/data/names.js";
import { normalize, wordsIn, shardFor, aliasGroup } from "../src/text.js";

const [, , inFile = "src/data/lyrics.json", outDir = "public/data"] = process.argv;

const LINE_MAX_WORDS = 15; // longer lines are trimmed around the match
const LINES_PER_SONG = 3; // different lines stored per word per song
const MAX_PUBLISHED_WORDS = 45; // build fails if one word's lines in one song exceed this
// Words in more songs than this get song ids only; names always get lines.
// Override with LYRIC_LINES_MAX_SONGS=0 to publish lines for names only.
const LINES_MAX_SONGS = Number(process.env.LYRIC_LINES_MAX_SONGS ?? 50);
const FILE_WARN_BYTES = 500 * 1024;

const slug = (s) => normalize(s).replace(/[^a-z0-9]/g, "");
const pretty = (segments) =>
  segments.map((s) => (s === "and" ? s : s.charAt(0).toUpperCase() + s.slice(1))).join(" ");

// Older entries: Genius lyrics start with "<Song> Lyrics". Only strip it when the song
// name matches part of the title slug, so songs without the header never lose real lyrics.
// The match also tells us where the artist ends: "Kizz-daniel-ada" + "Ada" -> Kizz Daniel.
const parseOldSong = ({ title, lyrics }) => {
  let text = lyrics.replace(/[​-‍﻿]/g, "");
  const segments = title.split("-").filter(Boolean);
  const segmentSlugs = segments.map(slug);
  let song = { title: pretty(segments) };

  const header = text.match(/^\s*(.{1,120}?) Lyrics\b/s);
  const target = header && slug(header[1]);
  if (target) {
    const matches = [];
    for (let i = 0; i < segments.length; i++) {
      let joined = "";
      for (let j = i; j < segments.length && target.startsWith(joined); j++) {
        joined += segmentSlugs[j];
        if (joined === target) matches.push([i, j + 1]);
      }
    }
    // Prefer a match that ends the title; the rest is usually "remix" or similar
    const [start, end] = matches.find(([, end]) => end === segments.length) || matches[0] || [];
    if (start !== undefined) {
      text = text.slice(header[0].length);
      const rest = segments.slice(end);
      song = {
        title: header[1].trim() + (rest.length ? " " + pretty(rest) : ""),
        ...(start > 0 && { artist: pretty(segments.slice(0, start)) }),
        url: `https://genius.com/${title}-lyrics`,
      };
    }
  }
  return { song, text };
};

const parseSong = (s) => {
  const { song, text } = s.artist && s.url
    ? { song: { title: s.title, artist: s.artist, url: s.url }, text: s.lyrics }
    : parseOldSong(s);
  return { song, text: text.replace(/\d*\s*Embed\s*$/, "") };
};

const songKey = (s) => slug((s.artist ? s.artist + " " : "") + s.title);

const raw = JSON.parse(fs.readFileSync(inFile, "utf8"));

// Drop duplicate songs (the same song can come from both Genius and AfrikaLyrics).
const seen = new Set();
const songs = [];
for (const s of raw) {
  if (!s?.title || !s?.lyrics) continue;
  const key = songKey(s);
  if (seen.has(key)) continue;
  seen.add(key);
  songs.push(s);
}

// The word range of a line to publish: the full line, or LINE_MAX_WORDS around the match.
const lineRange = (tokens, index) => {
  if (tokens.length <= LINE_MAX_WORDS) return [0, tokens.length];
  const start = Math.max(0, Math.min(index - Math.floor(LINE_MAX_WORDS / 2), tokens.length - LINE_MAX_WORDS));
  return [start, start + LINE_MAX_WORDS];
};

const lyricLine = (tokens, [start, end]) =>
  (start > 0 ? "…" : "") + tokens.slice(start, end).join(" ") + (end < tokens.length ? "…" : "");

// Words as published: whitespace-separated, ignoring a bare "…" marker
// For every song, record where each word appears: up to LINES_PER_SONG different
// lines (choruses repeat), as [lineIndex, tokenIndex]. Lines are separated by 2+ spaces.
const songLines = [];
const occurrences = []; // songId -> Map(word -> [[lineIndex, tokenIndex], ...])
const songCount = new Map(); // word -> number of songs containing it
let headersStripped = 0;

const meta = songs.map((s, id) => {
  const { song, text } = parseSong(s);
  if (!s.url && song.url) headersStripped++;

  const lines = text.split(/\s{2,}/).map((line) => line.trim().split(/\s+/)).filter((t) => t[0]);
  const found = new Map();
  const lineTexts = new Map(); // word -> Set of published line texts already used
  lines.forEach((tokens, li) => {
    tokens.forEach((token, ti) => {
      for (const word of wordsIn(token)) {
        const used = lineTexts.get(word) || lineTexts.set(word, new Set()).get(word);
        if (used.size >= LINES_PER_SONG) continue;
        // Compare lines as they'd be published, ignoring case and punctuation
        const lineText = normalize(lyricLine(tokens, lineRange(tokens, ti))).replace(/[^\p{L}\p{N}]/gu, "");
        if (used.has(lineText)) continue;
        used.add(lineText);
        (found.get(word) || found.set(word, []).get(word)).push([li, ti]);
      }
    });
  });
  for (const word of found.keys()) songCount.set(word, (songCount.get(word) || 0) + 1);

  songLines.push(lines);
  occurrences.push(found);
  return { id, ...song };
});

const nameWords = new Set([
  ...names.flatMap(wordsIn),
  ...Object.entries(nameAlternates).flatMap(([key, alternates]) => [key, ...alternates]).flatMap(wordsIn),
]);

const wordCount = (line) => line.split(/\s+/).filter((token) => token && token !== "…").length;

const shards = {}; // letter -> { word -> [[songId, [lines]?], ...] }
// songId -> lineIndex -> which of its words are published somewhere
const published = songLines.map((lines) => lines.map((tokens) => new Uint8Array(tokens.length)));
const overLimit = [];
let entriesWithLines = 0;

occurrences.forEach((found, id) => {
  for (const [word, positions] of found) {
    const withLines = nameWords.has(word) || songCount.get(word) <= LINES_MAX_SONGS;
    let entry = [id];
    if (withLines) {
      const lines = positions.map(([li, ti]) => {
        const range = lineRange(songLines[id][li], ti);
        published[id][li].fill(1, ...range);
        return lyricLine(songLines[id][li], range);
      });
      const words = lines.reduce((sum, line) => sum + wordCount(line), 0);
      if (words > MAX_PUBLISHED_WORDS) overLimit.push(`${meta[id].title} / "${word}": ${words} words`);
      entriesWithLines++;
      entry = [id, lines];
    }
    ((shards[shardFor(word)] ??= {})[word] ??= []).push(entry);
  }
});

if (overLimit.length) {
  console.error(`Build failed: published lines over ${MAX_PUBLISHED_WORDS} words for one word in one song:`);
  overLimit.slice(0, 20).forEach((line) => console.error(`  ${line}`));
  process.exit(1);
}

// Every listed name with songs, merged across its alternate forms, one entry per song,
// preferring the name's own form when a song has several. Sorted by artist, then title.
const lookup = (word) => (shards[shardFor(word)] || {})[word] || [];
const compareSongs = (a, b) =>
  (meta[a].artist || "").localeCompare(meta[b].artist || "", "en", { sensitivity: "base" }) ||
  meta[a].title.localeCompare(meta[b].title, "en", { sensitivity: "base" });

const byName = {};
for (const name of names) {
  const own = normalize(name);
  const forms = [own, ...aliasGroup(own).filter((form) => form !== own)];
  const entries = new Map();
  for (const form of forms) {
    for (const [id, lines = []] of lookup(form)) {
      if (!entries.has(id)) entries.set(id, [id, lines, form]);
    }
  }
  if (entries.size) {
    byName[name] = [...entries.keys()].sort(compareSongs).map((id) => entries.get(id));
  }
}

fs.rmSync(path.join(outDir, "words"), { recursive: true, force: true });
fs.rmSync(path.join(outDir, "ranking.json"), { force: true }); // replaced by by-name.json
fs.mkdirSync(path.join(outDir, "words"), { recursive: true });
fs.writeFileSync(path.join(outDir, "songs.json"), JSON.stringify(meta));
fs.writeFileSync(path.join(outDir, "by-name.json"), JSON.stringify(byName));
for (const [letter, words] of Object.entries(shards)) {
  fs.writeFileSync(path.join(outDir, "words", `${letter}.json`), JSON.stringify(words));
}

const sizeOf = (file) => fs.statSync(file).size;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const files = fs.readdirSync(outDir, { recursive: true })
  .map((f) => path.join(outDir, f))
  .filter((f) => fs.statSync(f).isFile());
const total = files.reduce((sum, f) => sum + sizeOf(f), 0);

// How much of the lyrics is readable from public/data, across all published lines
const lyricWords = songLines.reduce((sum, lines) => sum + lines.reduce((n, t) => n + t.length, 0), 0);
const publishedWords = published.reduce((sum, lines) => sum + lines.reduce((n, flags) => n + flags.reduce((a, b) => a + b, 0), 0), 0);

console.log(`${raw.length} songs in, ${songs.length} after removing duplicates`);
console.log(`${headersStripped} "<Song> Lyrics" headers stripped from older entries`);
console.log(`${songCount.size} words indexed, ${entriesWithLines} word/song matches with lyric lines`);
console.log(`Published lyric lines cover ~${Math.round((100 * publishedWords) / lyricWords)}% of all lyric words (lines kept for names and words in <= ${LINES_MAX_SONGS} songs)`);
console.log(`${Object.keys(shards).length} shards written to ${outDir}/words`);
console.log(`${Object.keys(byName).length} names from the list found in lyrics`);
console.log(`Total size of ${outDir}: ${kb(total)} in ${files.length} files`);

for (const f of files.filter((f) => sizeOf(f) > FILE_WARN_BYTES)) {
  console.warn(`WARNING: ${f} is ${kb(sizeOf(f))} (over ${kb(FILE_WARN_BYTES)})`);
}
