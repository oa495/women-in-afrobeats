<template>
  <h1 class="text-center text-8xl"><a href="#">Nigerian Women's Names in Afrobeats</a></h1>
  <span class="instructions text-center"><i>[Search any name, or pick one below to see the songs it's featured
      in]</i></span>
  <button class="text-4xl mb-4 about-button px-4" v-on:click="toggleAbout">
    <span v-if="!isAboutVisible">?</span>
    <span v-if="isAboutVisible">X</span>
  </button>
  <main class="container px-8 pt-10 mx-auto lg:px-4">
    <search-names :model-value="query" v-on:update:model-value="onType" v-on:search="openName" />

    <name-view v-if="currentName" :name="currentName" :listed-names="names.map(entry => entry.name)"
      v-on:suggest="suggest" />
    <name-browser v-else :names="names" :filter="query" />
  </main>
  <footer class="about pt-4 pb-4" v-if="isAboutVisible">
    <hr>
    <p>After I listened to <a class="underline" href="https://www.youtube.com/watch?v=OyeCxH9wbDc">Finesse by Pheelz and
        BUJU</a> I was singing <i>"Folake for the night"</i> for days. Then I remembered Ckay singing <i>"Folake, stay a
        little longer, I need a little more of your love"</i> in <i>Jeje de Whine</i>. Then again I remembered
      <i>"Folake give me love"</i> by Tekno Miles from 2016. I started thinking, <i>What is it about Folake???</i> I had
      a hypothesis that Folake was the most common female name in Nigerian songs so I scraped over a thousand songs from
      Genius and AfrikaLyrics to find out. Turns out I was wrong and <strong>Omalicha is queen</strong>.
    </p>

    <p>
      You can add a name <a class="underline"
        href="https://github.com/oa495/women-in-afrobeats/blob/master/src/data/names.js">here</a> if you want it to go
      through the lyrics search and you can add a song and its lyrics <a class="underline"
        href="https://github.com/oa495/women-in-afrobeats/blob/master/src/data/lyrics.json">here.</a>
    </p>

    <p>till next time! - <a class="underline" href="https://twitter.com/YellzHeard">yeli</a></p>
  </footer>
</template>

<script>
/* eslint-disable */
import SearchNames from './components/SearchNames.vue';
import NameBrowser, { toHash } from './components/NameBrowser.vue';
import NameView from './components/NameView.vue';
import { getByName, searchName } from './search.js';

const ADDED_NAMES_KEY = 'added-names';

// Names visitors suggest are only kept in their own browser until they're added to names.js
const loadAddedNames = () => {
  try {
    return JSON.parse(localStorage.getItem(ADDED_NAMES_KEY)) || [];
  } catch (e) {
    return [];
  }
}

const saveAddedName = (name) => {
  try {
    localStorage.setItem(ADDED_NAMES_KEY, JSON.stringify([...loadAddedNames(), name]));
  } catch (e) { }
}

// Sends a suggested name to Netlify Forms for review (see the hidden form in public/index.html)
const suggestName = (name, songCount, botField) => {
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      'form-name': 'suggest-name',
      'name': name,
      'songs': songCount,
      'bot-field': botField
    }).toString()
  }).catch(() => { });
}

const nameFromHash = () => decodeURIComponent(location.hash.slice(1)).replace(/-/g, ' ').trim();

export default {
  name: 'App',
  data() {
    return {
      names: [],
      query: '',
      currentName: nameFromHash(),
      isAboutVisible: false
    }
  },
  components: {
    SearchNames,
    NameBrowser,
    NameView
  },
  methods: {
    toggleAbout() {
      this.isAboutVisible = !this.isAboutVisible;
    },
    // Typing filters the name list, leaving a name's page if one is open
    onType(value) {
      this.query = value;
      if (this.currentName) this.openName('');
    },
    // Replaces the current history entry so Back isn't flooded with searched names
    openName(name) {
      history.replaceState(null, '', name ? '#' + toHash(name) : location.pathname + location.search);
      this.currentName = name;
    },
    onHashChange() {
      this.currentName = nameFromHash();
      this.query = this.currentName;
      window.scrollTo(0, 0);
    },
    suggest({ name, count, botField }) {
      this.names.push({ name, count, pending: true });
      saveAddedName(name);
      suggestName(name, count, botField);
    }
  },
  async created() {
    this.query = this.currentName;
    window.addEventListener('hashchange', this.onHashChange);

    const byName = await getByName();
    const names = Object.entries(byName).map(([name, songs]) => ({ name, count: songs.length }));
    for (const name of loadAddedNames()) {
      if (names.some(entry => entry.name.toLowerCase() === name.toLowerCase())) continue;
      const results = await searchName(name).catch(() => []);
      if (results.length) names.push({ name, count: results.length, pending: true });
    }
    this.names = names;
  },
  unmounted() {
    window.removeEventListener('hashchange', this.onHashChange);
  }
}
</script>

<style>
h1 {
  text-transform: uppercase;
  font-family: 'League Gothic', sans-serif;
  font-weight: 600;
}

.names-container {
  display: flex;
  flex-direction: column;
}

li {
  font-family: 'EB Garamond', serif;
  font-size: 2em;
  display: inline-block;
  margin-bottom: 0;
  vertical-align: middle;
  text-transform: uppercase;
}

.name {
  padding-left: 0.25em;
}

.about-button {
  bottom: 0;
  position: fixed;
  right: 0;
  z-index: 100;
}

footer {
  position: fixed;
  bottom: 0;
  background: white;
  display: flex;
  flex-direction: column;
  border-top: 0.1em solid black;
  align-items: center;
}

footer p {
  max-width: 75%;
  padding: 1rem;
}

.instructions {
  display: block;
}

.pending {
  font-size: 0.4em;
  text-transform: none;
  opacity: 0.6;
  padding-left: 0.5em;
}
</style>
