/* eslint-disable */
import axios from 'axios';
import { normalize } from './text.js';

const CACHE_KEY = 'spotify-tracks-v3';
const MAX_CONCURRENT = 4;

// Track lookups are cached by song title, in memory and in localStorage.
// A null entry means Spotify had no match, so we don't search for it again.
const loadCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

const trackCache = loadCache();
const pending = {};

const saveCache = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(trackCache));
  } catch (e) {}
}

let token = null;

const getAccessToken = () => {
  if (!token || token.expiresAt < Date.now()) {
    const request = axios.get('/.netlify/functions/spotify-token').then(({ data }) => {
      if (!data?.access_token) throw new Error('No Spotify token (is the Netlify function running?)');
      // Refresh a minute early so a request never goes out with an expired token
      current.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
      return data.access_token;
    });
    const current = token = { request, expiresAt: Infinity };
    request.catch(() => { if (token === current) token = null; });
  }
  return token.request;
}

// Limit simultaneous Spotify requests so prefetching doesn't hit rate limits
let active = 0;
const queue = [];

const runLimited = (task) => new Promise((resolve, reject) => {
  queue.push(() => task().then(resolve, reject).finally(() => {
    active--;
    next();
  }));
  next();
});

const next = () => {
  if (active >= MAX_CONCURRENT || queue.length === 0) return;
  active++;
  queue.shift()();
}

const SEARCH_LIMIT = 5;
const MAX_RETRIES = 3;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const searchTracks = async (query) => {
  for (let attempt = 0; ; attempt++) {
    const access_token = await getAccessToken();
    try {
      const { data } = await axios({
        method: 'GET',
        url: `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${SEARCH_LIMIT}`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${access_token}`
        }
      });
      return (data?.tracks?.items || []).filter(Boolean).map(track => ({
        name: track.name,
        url: track.external_urls.spotify,
        artists: track.artists.map(artist => artist.name)
      }));
    } catch (e) {
      // Rate limited: wait as long as Spotify asks, then try again
      if (e.response?.status !== 429 || attempt >= MAX_RETRIES) throw e;
      await sleep((Number(e.response.headers['retry-after']) || 2) * 1000);
    }
  }
}

// Resolves to Spotify's top tracks for a search, [{ name, url, artists: [names] }].
// Rejects on network/auth errors, which are not cached.
const getTracks = (query) => {
  if (query in trackCache) return Promise.resolve(trackCache[query]);
  if (!pending[query]) {
    pending[query] = runLimited(() => searchTracks(query)).then(tracks => {
      trackCache[query] = tracks;
      saveCache();
      return tracks;
    }).finally(() => {
      delete pending[query];
    });
  }
  return pending[query];
}

// The Spotify search text for a song from public/data/songs.json
export const trackQuery = (song) => [song.artist, song.title].filter(Boolean).join(' ');

const slug = (s) => normalize(s).replace(/[^a-z0-9]/g, '');

// A title without "(feat. …)", "[Remix]" or "- Remix" parts
const baseTitle = (title) => normalize(title).replace(/\(.*?\)|\[.*?\]|\s-\s.*$/g, '').trim();

// One of the track's artists is named in the song's artist ("DJ ECOOL" has "Ecool"), and the
// song's title contains the track's ("Gobe Remix" has "Gobe"). Older songs without an
// artist have it at the start of the title.
const isSameSong = (song, track) => {
  const songArtist = slug(song.artist || song.title);
  const artistMatches = track.artists.some(artist => {
    const name = slug(artist);
    return name && (song.artist ? songArtist.includes(name) : songArtist.startsWith(name));
  });
  const trackTitle = slug(baseTitle(track.name));
  return artistMatches && !!trackTitle && slug(song.title).includes(trackTitle);
}

// The song on Spotify, or null. Searches by track and artist first, then as plain text,
// and only accepts a result that is the same song, so a wrong song is never linked.
export const findTrack = async (song) => {
  const queries = song.artist ? [`track:${baseTitle(song.title)} artist:${song.artist}`] : [];
  for (const query of [...queries, trackQuery(song)]) {
    const track = (await getTracks(query)).find(track => isSameSong(song, track));
    if (track) return track;
  }
  return null;
}

// The song's artist and title to show, as Spotify spells them when the track matched:
// "OLAMIDE" -> "Olamide", and older songs like "Ajebutter22 Regards To Your Mumsi" get split
export const displaySong = (song, track) => {
  if (!track) return { artist: song.artist, title: song.title };
  if (!song.artist) {
    const artist = track.artists.find(artist => slug(song.title).startsWith(slug(artist)));
    return { artist, title: track.name };
  }
  const artist = track.artists.find(artist => slug(artist) === slug(song.artist)) || song.artist;
  return { artist, title: song.title };
}

export const spotifySearchUrl = (song) => `https://open.spotify.com/search/${encodeURIComponent(trackQuery(song))}`;
