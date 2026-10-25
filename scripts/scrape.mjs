// Scrape Nigerian song lyrics from AfrikaLyrics and Genius into src/data/lyrics.json.
//
// Usage:  node scripts/scrape.mjs [--source=all|genius|afrikalyrics] [--max-pages=N] [--out=src/data/lyrics.json]
//
// Sources:
//   AfrikaLyrics: /country/nigeria?page=N (artists) -> /artist/<slug> (songs) -> song page
//   Genius:       /tags/<nigeria|afrobeats>/all?page=N (songs) -> song page
//
// Incremental: songs already in the output file (by URL, or by artist + title) are skipped,
// and progress is saved as it goes, so the scrape can be stopped and resumed.
// Output entries: { title, artist, url, lyrics }, lyric lines joined by two spaces
// like the original scrape (scripts/build-index.mjs splits lines on /\s{2,}/).

import fs from "node:fs";
import * as cheerio from "cheerio";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("="))
);
const OUT = args.out || "src/data/lyrics.json";
const SOURCE = args.source || "all";
const MAX_PAGES = Number(args["max-pages"] || Infinity);

const USER_AGENT = "women-in-afrobeats-indexer/1.0 (+https://github.com/oa495/women-in-afrobeats)";
const DELAY_MS = 1500;
const MAX_CONSECUTIVE_ERRORS = 5;
const SAVE_EVERY = 20;
const GENIUS_TAGS = ["nigeria", "afrobeats"];
const MIN_LINES = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slug = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");

class TooManyErrors extends Error {}

// ---- fetching: one request at a time, at least DELAY_MS apart, giving up on repeated errors

let lastRequest = 0;
let consecutiveErrors = 0;

const fetchPage = async (url) => {
  for (let attempt = 1; ; attempt++) {
    await sleep(Math.max(0, lastRequest + DELAY_MS - Date.now()));
    lastRequest = Date.now();
    let error;
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (response.ok) {
        consecutiveErrors = 0;
        return cheerio.load(await response.text());
      }
      error = new Error(`HTTP ${response.status}`);
      // Rate limited or server trouble: back off once before counting it as an error
      if ((response.status === 429 || response.status >= 500) && attempt === 1) {
        console.warn(`  ${response.status} on ${url}, waiting 30s`);
        await sleep(30_000);
        continue;
      }
    } catch (e) {
      error = e;
    }
    if (++consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      throw new TooManyErrors(`${consecutiveErrors} errors in a row, last: ${error.message} (${url})`);
    }
    throw error;
  }
};

// ---- parsing

// Lines from a lyrics element: <br> separates lines, section labels like [Chorus] are dropped
const linesFrom = ($, element) => {
  $(element).find("br").replaceWith("\n");
  return $(element).text().split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !/^\[.*\]$/.test(line));
};

const parseGeniusSong = ($) => {
  const [artist, ...rest] = ($('meta[property="og:title"]').attr("content") || "").split(" – ");
  const containers = $("[data-lyrics-container]");
  containers.find("[data-exclude-from-selection]").remove(); // contributors + "<Song> Lyrics" header
  const lines = containers.toArray().flatMap((element) => linesFrom($, element));
  // "Future (Ft. Drake & Tems)" -> "Future", so the same song matches across both sites
  return { artist: artist.replace(/\s*\((?:Ft|Feat)\..*\)\s*$/i, "").trim(), title: rest.join(" – ").trim(), lines };
};

const parseAfrikaLyricsSong = ($) => {
  let recording = {};
  $('script[type="application/ld+json"]').each((i, script) => {
    try {
      const data = JSON.parse($(script).text().replace(/[\n\r\t]/g, " "));
      if (data["@type"] === "MusicRecording") recording = data;
    } catch (e) {}
  });
  const decode = (s) => cheerio.load(`<p>${s || ""}</p>`)("p").text().trim();
  const lyrics = $("div[oncontextmenu]").first();
  lyrics.find(".ad-slot, script, ins").remove();
  const lines = lyrics.find("p").toArray().flatMap((element) => linesFrom($, element));
  return { artist: decode(recording.byArtist?.name), title: decode(recording.name), lines };
};

// ---- song lists

async function* geniusSongUrls() {
  for (const tag of GENIUS_TAGS) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const $ = await fetchPage(`https://genius.com/tags/${tag}/all?page=${page}`);
      const urls = $(".search_result a[href$='-lyrics']").map((i, a) => $(a).attr("href")).get();
      if (urls.length === 0) break;
      console.log(`Genius #${tag} page ${page}: ${urls.length} songs`);
      yield* urls;
    }
  }
}

async function* afrikaLyricsSongUrls() {
  const seenArtists = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const $ = await fetchPage(`https://afrikalyrics.com/country/nigeria?page=${page}`);
    const artists = [...new Set($(".loop-item a[href*='/artist/']").map((i, a) => $(a).attr("href")).get())]
      .filter((url) => !seenArtists.has(url));
    if (artists.length === 0) break;
    console.log(`AfrikaLyrics artists page ${page}: ${artists.length} artists`);
    for (const artistUrl of artists) {
      seenArtists.add(artistUrl);
      let $artist;
      try {
        $artist = await fetchPage(artistUrl);
      } catch (error) {
        if (error instanceof TooManyErrors) throw error;
        console.warn(`  failed artist ${artistUrl}: ${error.message}`);
        continue;
      }
      // The artist's own songs are in the .col-xs-4 grid; .col-md-12 is a "trending" sidebar
      yield* new Set($artist(".col-xs-4 .item-title a[href$='-lyrics']").map((i, a) => $artist(a).attr("href")).get());
    }
  }
}

// ---- main

const originalText = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "[]";
const existing = JSON.parse(originalText);
const songs = [...existing];
// Older entries have no url; their titles are Genius slugs, so derive the URL to avoid refetching
const knownUrls = new Set(existing.map((s) => s.url || `https://genius.com/${s.title}-lyrics`));
const knownKeys = new Set(existing.map((s) => slug((s.artist ? s.artist + " " : "") + s.title)));
const urlKey = (url) => slug(url.split("/").pop().replace(/-lyrics$/, ""));

// Append new songs as text, so existing entries keep their exact formatting
const head = originalText.replace(/\]\s*$/, "").trimEnd();
const save = () => {
  const added = songs.slice(existing.length).map((s) => "  " + JSON.stringify(s, null, 2).replace(/\n/g, "\n  "));
  if (added.length === 0) return;
  const text = head + (existing.length ? ",\n" : "\n") + added.join(",\n") + "\n]\n";
  fs.writeFileSync(OUT + ".tmp", text);
  fs.renameSync(OUT + ".tmp", OUT);
};

const stats = { new: 0, skipped: 0, failed: 0 };
const sources = {
  genius: { urls: geniusSongUrls, parse: parseGeniusSong },
  afrikalyrics: { urls: afrikaLyricsSongUrls, parse: parseAfrikaLyricsSong },
};

let stopReason = null;
try {
  for (const [name, source] of Object.entries(sources)) {
    if (SOURCE !== "all" && SOURCE !== name) continue;
    for await (const url of source.urls()) {
      if (knownUrls.has(url) || knownKeys.has(urlKey(url))) {
        stats.skipped++;
        continue;
      }
      knownUrls.add(url);
      try {
        const { title, artist, lines } = source.parse(await fetchPage(url));
        const key = slug(artist + " " + title);
        // Some AfrikaLyrics pages hold only an artist bio instead of lyrics
        if (!title || lines.length < MIN_LINES) throw new Error(`no title or lyrics found (${lines.length} lines)`);
        if (knownKeys.has(key)) {
          stats.skipped++; // same song already saved from the other source
          continue;
        }
        knownKeys.add(key);
        songs.push({ title, artist, url, lyrics: lines.join("  ") });
        stats.new++;
        if (stats.new % SAVE_EVERY === 0) {
          save();
          console.log(`  saved: ${stats.new} new, ${stats.skipped} skipped, ${stats.failed} failed`);
        }
      } catch (error) {
        if (error instanceof TooManyErrors) throw error;
        stats.failed++;
        console.warn(`  failed ${url}: ${error.message}`);
      }
    }
  }
} catch (error) {
  if (!(error instanceof TooManyErrors)) throw error;
  stopReason = error.message;
}

save();
console.log(`\n${stats.new} new, ${stats.skipped} skipped, ${stats.failed} failed. ${songs.length} songs in ${OUT}`);
if (stopReason) {
  console.error(`Stopped early: ${stopReason}. Run again to resume.`);
  process.exit(1);
}
