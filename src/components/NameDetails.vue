<template>
  <TransitionGroup class="mt-4" name="list" tag="ul" v-if="songsForName.length > 0">
     <li class="song list-none text-center inline-block capitalize text-base" v-for="(entry, index) in songsForName" :key="entry.name">
        <a class="underline pr-1" :href="entry.url || backupUrl + entry.name">
          <span class="name">{{entry.name}}</span>
        </a>
        <span>{{entry.artists}}</span>
        <span v-if="index < songsForName.length-1"> //</span>
      </li>
 </TransitionGroup>
 <TransitionGroup name="list" tag="ul" v-if="songsForName.length === 0">
     <li class="song list-none text-center inline-block capitalize text-base" v-for="entry in songs" :key="entry.id">
        <a class="underline pr-1" :href="entry.url || backupUrl + trackQuery(entry)">
          <span class="name">{{trackQuery(entry)}}</span>
        </a>
      </li>
 </TransitionGroup>
</template>

<script>
/* eslint-disable */
import { getTrack, trackQuery } from '../spotify.js';

export default {
  name: 'NameDetails',
  props: ['count', 'songs'],
  data() {
    return {
      songsForName: [],
      backupUrl: `https://open.spotify.com/search/`
    }
  },
  methods: {
    trackQuery
  },
  created() {
    this.songs.forEach(song => {
      getTrack(trackQuery(song)).then(track => {
        if (track) this.songsForName.push(track);
      }).catch(() => {
        this.songsForName.push({ name: song.title, artists: song.artist, url: song.url });
      });
    });
  }
}
</script>
<style>

button {
  cursor: pointer;
}

ul {
  line-height: 0.5em;
}

a {
  transition: opacity 0.5s cubic-bezier(0.075, 0.82, 0.165, 1);
}

a:hover {
  opacity: 0.5;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
