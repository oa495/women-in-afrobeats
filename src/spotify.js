/* eslint-disable */
import axios from 'axios';

const CACHE_KEY = 'spotify-tracks-v2';
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

const searchTrack = async (song) => {
  const access_token = await getAccessToken();
  const { data } = await axios({
    method: 'GET',
    url: `https://api.spotify.com/v1/search?query=${encodeURIComponent(song)}&type=track&locale=en&offset=0&limit=1`,
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${access_token}`
    }
  });

  const track = data?.tracks?.items?.[0];
  if (!track) return null;
  return {
    name: track.name,
    url: track.external_urls.spotify,
    artists: track.artists.map(artist => artist.name).join(', ')
  };
}

// Resolves to { name, url, artists }, or null if Spotify has no match.
// Rejects on network/auth errors, which are not cached.
export const getTrack = (song) => {
  if (song in trackCache) return Promise.resolve(trackCache[song]);
  if (!pending[song]) {
    pending[song] = runLimited(() => searchTrack(song)).then(track => {
      trackCache[song] = track;
      saveCache();
      return track;
    }).finally(() => {
      delete pending[song];
    });
  }
  return pending[song];
}

// The Spotify search text for a song from public/data/songs.json
export const trackQuery = (song) => [song.artist, song.title].filter(Boolean).join(' ');

export const prefetchTracks = (songs) => {
  songs.forEach(song => getTrack(trackQuery(song)).catch(() => {}));
}
