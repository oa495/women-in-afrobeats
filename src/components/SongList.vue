<template>
  <ul class="songs">
    <li class="song-result list-none" v-for="result in results" :key="result.song.id">
      <a class="underline" v-if="result.song.url" :href="result.song.url" target="_blank" rel="noopener">{{songLabel(result.song)}}</a>
      <span v-else>{{songLabel(result.song)}}</span>
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

export default {
  name: 'SongList',
  props: ['results'],
  methods: {
    capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1),
    songLabel(song) {
      return song.artist ? `${song.artist} – ${song.title}` : song.title;
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

.matched {
  opacity: 0.6;
  padding-left: 0.5em;
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
