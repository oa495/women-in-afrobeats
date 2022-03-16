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
     <li class="song list-none text-center inline-block capitalize text-base" v-for="entry in songs" :key="entry">
        <a class="underline pr-1" :href="entry.url || backupUrl + entry">
          <span class="name">{{entry}}</span>
        </a>
      </li>
 </TransitionGroup>
</template>

<script>
/* eslint-disable */
import axios from 'axios';

const getAccessToken = async () => {
  const response = await axios({
    method: 'GET',
    url: 'https://jumbled-jolly-kumquat.glitch.me/refresh',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
    },
  });

  return response.data;
}

export default {
  name: 'NameDetails',
  props: ['count', 'songs'],
  data() {
    return {
      songsForName: [],
      backupUrl: `https://open.spotify.com/search/`
    }
  },
  async created() {
    console.log(this.songs);
    const { access_token } = await getAccessToken();
    this.songs.forEach(song => {
       axios({
         method: 'GET',
         url: `https://api.spotify.com/v1/search?query=${song.replaceAll('-', ' ')}&type=track&locale=en&offset=0&limit=1`,
         headers: {
           'Accept': 'application/json',
            'Content-Type': 'application/json',
           'Authorization': `Bearer ${access_token}`
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
