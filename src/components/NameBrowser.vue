<template>
  <div class="browse">
    <div class="browse-controls text-center">
      <button class="sort-toggle underline" type="button" v-on:click="sortByCount = !sortByCount">
        {{sortByCount ? 'Sort A–Z' : 'Sort by most songs'}}
      </button>
      <nav class="letters" v-if="!sortByCount" aria-label="Jump to letter">
        <button class="letter" type="button" v-for="letter in letters" :key="letter" v-on:click="jumpTo(letter)">{{letter}}</button>
      </nav>
    </div>

    <ul class="names-container">
      <li class="list-none mt-4 px-2 text-center" v-for="entry in sortedNames" :key="entry.name"
        :data-letter="firstLetter(entry.name)">
        <a class="browse-name" :href="'#' + toHash(entry.name)">
          <span class="name">{{entry.name}}</span>
          <span class="count"> · {{entry.count}} {{entry.count === 1 ? 'song' : 'songs'}}</span>
          <span class="pending" v-if="entry.pending"><i>pending review</i></span>
        </a>
      </li>
    </ul>
  </div>
</template>

<script>
/* eslint-disable */
import { normalize } from '../text.js';

export const toHash = (name) => encodeURIComponent(normalize(name).trim().replace(/\s+/g, '-'));

export default {
  name: 'NameBrowser',
  props: ['names'],
  data() {
    return {
      sortByCount: false
    }
  },
  computed: {
    sortedNames() {
      const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
      return [...this.names].sort(this.sortByCount ? (a, b) => b.count - a.count || byName(a, b) : byName);
    },
    letters() {
      return [...new Set(this.names.map(entry => this.firstLetter(entry.name)))].sort();
    }
  },
  methods: {
    toHash,
    firstLetter: (name) => normalize(name).charAt(0).toUpperCase(),
    // Scrolls without touching the URL hash, which holds the selected name
    jumpTo(letter) {
      const item = this.$el.querySelector(`[data-letter="${letter}"]`);
      if (item) item.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
</script>

<style>
.browse-controls {
  font-family: 'EB Garamond', serif;
  padding-top: 1em;
}

.letters {
  padding-top: 0.5em;
}

.letter {
  padding: 0 0.3em;
  transition: opacity 0.5s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.letter:hover {
  opacity: 0.5;
}

.browse-name .count {
  font-size: 0.5em;
  text-transform: none;
}
</style>
