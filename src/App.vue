<template>
  <h1 class="text-center text-8xl">Nigerian Women's Names in Afrobeats</h1>
      <span class="instructions text-center"><i>[Click on the name to see the songs it's featured in]</i></span>
  <button class="text-4xl mb-4 about-button px-4" v-on:click="toggleAbout">
    <span v-if="!isAboutVisible">?</span>
    <span v-if="isAboutVisible">X</span>
  </button>
  <main class="container px-8 pt-10 mx-auto lg:px-4">

    <ul class="names-container">
      <li class="list-none mt-4 px-2 text-center" v-for="(entry, index) in orderedNames" :key="entry.name">
        <div class="name-info">
          <span class="index">{{index + 1}}</span>
          <button class="toggle" v-on:click="toggleDetails(index)">
            <span class="name">{{entry.name}}</span>
            <!-- <span class="count">{{entry.count}}</span> -->
            <img class="arrow inline-block" v-bind:class="{ shown: !hideDetails && index === indexOfVisibleDetail }" src="./assets/arrow.svg">
          </button>
        </div>

        <transition name="fade">
          <name-details v-if="!hideDetails && index === indexOfVisibleDetail" :songs="entry.songs"/>
        </transition>
      </li>
    </ul>
  </main>
  <footer class="about pt-4 pb-4" v-if="isAboutVisible">
    <hr>
    <p>After I listened to <a class="underline" href="https://www.youtube.com/watch?v=OyeCxH9wbDc">Finesse by Pheelz and BUJU</a> I was singing <i>"Folake for the night"</i> for days. Then I remembered Ckay singing <i>"Folake, stay a little longer, I need a little more of your love"</i> in <i>Jeje de Whine </i>. Then again I remembered <i>"Folake give me love"</i> by Tekno Miles from 2016. I started thinking, <i>What is it about Folake???</i> I had a hypothesis that Folake was the most common female name in Nigerian songs so I scraped over a thousand songs from Genius to find out. Turns out I was wrong and <strong>Omalicha is queen</strong>.</p>

    <p>
      You can add a name <a class="underline" href="https://github.com/oa495/women-in-afrobeats/blob/master/src/data/names.js">here</a> if you want it to go through the lyrics search and you can add a song and its lyrics <a class="underline" href="https://github.com/oa495/women-in-afrobeats/blob/master/src/data/lyrics.json">here.</a>
    </p>

    <p>till next time! - <a class="underline" href="https://twitter.com/YellzHeard">yeli</a></p>
  </footer>
</template>

<script>
/* eslint-disable */
import { names } from './data/names.js';
import lyrics from './data/lyrics.json';
import NameDetails from './components/NameDetails.vue';

const nameAlternates = {
  "ifunanya": ['ifunanyam'],
  "sade": ['folashade', 'folasade'],
  "funmi": ['olufunmi'],
  "kemi": ['oluwakemi'],
  "caro": ["caroline"]
}
export default {
  name: 'App',
  data() {
    return {
      names: {},
      hideDetails: true,
      indexOfVisibleDetail: null,
      isAboutVisible: false
    }
  },
  components: {
    NameDetails
  },
  computed: {
    orderedNames() {
      return this.names.sort((a, b) => { return b.count - a.count; });
    }
  },
  methods: {
    toggleDetails(index) {
      if (index === this.indexOfVisibleDetail) {
        this.hideDetails = !this.hideDetails;
      }
      this.indexOfVisibleDetail = index;
    },
    toggleAbout() {
      this.isAboutVisible = !this.isAboutVisible;
    }
  },
  created() {
    const namesAndCount = {};

    names.forEach(name => {
      for (const song of lyrics) {
        const nameRegex = new RegExp(`\\b${name}\\b`, 'i');
        let nameAlternatesRegex = undefined;
        if (nameAlternates[name.toLowerCase()]) {
          nameAlternatesRegex = new RegExp(`\\b${nameAlternates[name.toLowerCase()].join('|')}\\b`, 'i');
        }
        if (song.lyrics.match(nameRegex) || (nameAlternatesRegex && song.lyrics.match(nameAlternatesRegex))) {
          if (!namesAndCount[name]) {
              namesAndCount[name] = {
                count: 1,
                songs: [song.title]
              };
          }
          else {
            namesAndCount[name].count += 1;
            namesAndCount[name].songs.push(song.title.replace('-', ' '));
          }
        }
      }
    });

    this.names = Object.keys(namesAndCount).map(entry => {
      const entryDetails = namesAndCount[entry];
      entryDetails['name'] = entry;
      return entryDetails;
    });
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

.arrow, .arrow.shown {
  transition: all 1s ease-in-out;
}

.arrow.shown {
  transform: rotate(180deg);
}

.name-info, .toggle {
  display: inline-flex;
  align-items: center;
}

.toggle:hover .arrow {
  transform: translateY(0.2em);
}

.index {
  align-self: baseline;
  font-size: 0.5em;
}

.name {
  padding-left: 0.25em;
}

.count {
  border: 1px solid black;
  padding: 0.25em;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity .5s ease-in-out;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
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
</style>
