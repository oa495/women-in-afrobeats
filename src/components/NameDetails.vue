<template>
  <TransitionGroup name="list" tag="ul">
     <li class="song list-none text-center inline-block capitalize text-base" v-for="(entry, index) in songsForName" :key="entry.name">
        <a class="underline pr-1" :href="entry.url">
          <span class="name">{{entry.name}},</span>
        </a>
        <span>{{entry.artists}}</span>
        <span v-if="index < songsForName.length-1"> //</span>
      </li>
 </TransitionGroup>
</template>

<script>
/* eslint-disable */
import axios from 'axios';

export default {
  name: 'NameDetails',
  props: ['count', 'songs'],
  data() {
    return {
      songsForName: []
    }
  },
  mounted() {
    this.songs.forEach(song => {
       axios({
         method: 'GET',
         url: `https://api.spotify.com/v1/search?query=${song.replaceAll('-', ' ')}&type=track&locale=en&offset=0&limit=1`,
         headers: {
           'Accept': 'application/json',
            'Content-Type': 'application/json',
           'Authorization': 'Bearer BQD-OFqmmUeRm9_ZNVeUAXho86svwbx4j6vKrg5YSKVur-N8VPhpy7PWHFQ1eyldLICf09eUtfqKInC6EUPCMZfzhCPPDqoJP24tt868AG0yL6uLrS7GAYilcF3HsQ4THMX0jL6PzIT4aBo'
         }
       }
      ).then((data) => {
        let songsDetails = {};
        if (data) {
          const tracks = data?.data?.tracks?.items;
          if (tracks.length > 0) {
            const song = tracks[0];
            songsDetails.name = song.name;
            songsDetails.url = song.external_urls.spotify;
            const artists = song.artists.map(artist => {
              return artist.name;
            });
            songsDetails.artists = artists.join(', ');
          }
        }
        if (Object.keys(songsDetails).length > 0) this.songsForName.push(songsDetails);
      }).catch(() => {
        this.songsForName.push({ name:
        song.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') });
      })
    });
  }
}
</script>
<style scoped>
ul {
  line-height: 0.5em;
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
