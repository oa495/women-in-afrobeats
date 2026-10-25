<template>
  <section class="name-view">
    <a class="back-link underline" href="#">← All names</a>
    <h2 class="name-heading text-center">{{displayName}}</h2>

    <p class="name-message text-center" v-if="error"><i>{{error}}</i></p>
    <p class="name-message text-center" v-else-if="results && results.length === 0"><i>No songs found for {{displayName}}.</i></p>
    <template v-else-if="results">
      <p class="name-message text-center">
        <i>{{results.length}} {{results.length === 1 ? 'song mentions' : 'songs mention'}} {{displayName}}</i>
      </p>
      <form class="suggest text-center" v-if="canSuggest" v-on:submit.prevent="suggest">
        <input class="hidden" v-model="botField" name="bot-field" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="underline" type="submit">Suggest {{displayName}} for the list</button>
      </form>
      <p class="name-message text-center" v-if="suggested"><i>Thanks! {{displayName}} was sent for review.</i></p>
      <song-list :results="results"/>
    </template>
  </section>
</template>

<script>
/* eslint-disable */
import SongList from './SongList.vue';
import { searchName, findListedName } from '../search.js';
import { normalize, aliasGroup } from '../text.js';

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default {
  name: 'NameView',
  components: { SongList },
  props: ['name', 'listedNames'],
  emits: ['suggest'],
  data() {
    return {
      results: null,
      listedName: null,
      error: '',
      botField: '',
      suggested: false
    }
  },
  computed: {
    displayName() {
      return this.listedName || capitalize(this.name.trim());
    },
    canSuggest() {
      // Not for names already listed, including alternate forms ("Folashade" when "Sade" is listed)
      const forms = aliasGroup(normalize(this.name).trim());
      return !this.suggested && this.results.length > 0 &&
        !this.listedNames.some(listed => forms.includes(normalize(listed)));
    }
  },
  watch: {
    name: { immediate: true, handler: 'load' }
  },
  methods: {
    async load() {
      const name = this.name;
      this.results = null;
      this.error = '';
      this.suggested = false;
      try {
        const [listedName, results] = await Promise.all([findListedName(name), searchName(name)]);
        if (name !== this.name) return; // a newer name was requested
        this.listedName = listedName;
        this.results = results;
      } catch (e) {
        if (name !== this.name) return;
        this.error = 'Search is unavailable right now. Try again in a moment.';
      }
    },
    suggest() {
      this.suggested = true;
      this.$emit('suggest', { name: this.displayName, count: this.results.length, botField: this.botField });
    }
  }
}
</script>

<style>
.name-view {
  font-family: 'EB Garamond', serif;
  padding-top: 1em;
}

.back-link {
  font-size: 1rem;
}

.name-heading {
  font-size: 2em;
  text-transform: uppercase;
}

.name-message {
  font-size: 1rem;
}

.suggest {
  font-size: 1rem;
}
</style>
