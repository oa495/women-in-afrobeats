<template>
  <ul class="songs">
    <li class="song-result list-none" v-for="result in results" :key="result.song.id">
      <a class="underline" :href="songLink(result.song)" target="_blank" rel="noopener">{{songLabel(result.song)}}</a>
      <a class="lyrics-link" v-if="tracks[result.song.id] && result.song.url" :href="result.song.url" target="_blank" rel="noopener">lyrics</a>
      <span class="matched" v-if="result.alternate"><i>matched “{{capitalize(result.form)}}”</i></span>
      <span class="lyric-line block" v-for="(line, i) in result.lines" :key="i">
        <template v-for="(part, j) in highlight(line, result.form)" :key="j">
          <template v-if="part.match">{{part.before}}<mark>{{part.word}}</mark>{{part.after}}</template>
          <template v-else>{{part.text}}</template>
        </template>
      </span>
    </li>
  </ul>
</template>

<script>
/* eslint-disable */
import { wordsIn } from '../text.js';
import { findTrack, displaySong, spotifySearchUrl } from '../spotify.js';

export default {
  name: 'SongList',
  props: ['results'],
  data() {
    return {
      tracks: {} // song id -> matching Spotify track
    }
  },
  watch: {
    // Each song links to Spotify once its track is found, else to its lyrics page or a Spotify search
    results: {
      immediate: true,
      handler(results) {
        for (const { song } of results || []) {
          if (song.id in this.tracks) continue;
          findTrack(song).then(track => { this.tracks[song.id] = track; }).catch(() => {});
        }
      }
    }
  },
  methods: {
    capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1),
    songLink(song) {
      return this.tracks[song.id]?.url || song.url || spotifySearchUrl(song);
    },
    songLabel(song) {
      const { artist, title } = displaySong(song, this.tracks[song.id]);
      return artist ? `${artist} – ${title}` : title;
    },
    // Splits a line into parts, flagging the words that matched; only their letters get marked
    highlight(line, form) {
      return line.split(/(\s+)/).map(text => {
        if (!wordsIn(text).includes(form)) return { text, match: false };
        const [, before, word, after] = text.match(/^(\P{L}*)(.*?)(\P{L}*)$/su);
        return { text, match: true, before, word, after };
      });
    }
  }
}
</script>

<style>
.songs {
  line-height: 1.4;
  max-width: 40em;
  margin: 0 auto;
}

.song-result {
  font-family: 'EB Garamond', serif;
  font-size: 1rem;
  text-transform: none;
  padding-top: 1em;
  text-align: center;
}

.lyrics-link,
.matched {
  opacity: 0.6;
  padding-left: 0.5em;
}

.lyrics-link {
  font-size: 0.85em;
  text-decoration: underline;
}

.lyric-line {
  opacity: 0.8;
}

mark {
  background: black;
  color: white;
  padding: 0 0.15em;
}
</style>
