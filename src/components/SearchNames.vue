<template>
  <form class="search text-center" v-on:submit.prevent="emitSearch" role="search">
    <input class="search-input text-center" :value="modelValue" v-on:input="onInput" list="name-options"
      placeholder="Search a name" aria-label="Search a name" maxlength="30" autocomplete="off">
    <datalist id="name-options">
      <option v-for="option in nameOptions" :key="option" :value="option"/>
    </datalist>
    <span class="search-message block" v-if="message"><i>{{message}}</i></span>
  </form>
</template>

<script>
/* eslint-disable */
import { names, nameAlternates } from '../data/names.js';

const DEBOUNCE_MS = 200;

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Emits `search` with the typed name (debounced), or '' when the box is cleared
export default {
  name: 'SearchNames',
  props: ['modelValue'],
  emits: ['update:modelValue', 'search'],
  data() {
    return {
      message: '',
      nameOptions: [...new Set([
        ...names,
        ...Object.entries(nameAlternates).flatMap(([key, alternates]) => [key, ...alternates]).map(capitalize)
      ])].sort()
    }
  },
  methods: {
    onInput(event) {
      this.$emit('update:modelValue', event.target.value);
      clearTimeout(this.timer);
      this.timer = setTimeout(this.emitSearch, DEBOUNCE_MS);
    },
    emitSearch() {
      clearTimeout(this.timer);
      const input = (this.modelValue || '').trim();
      if (input && !/^[\p{L}' -]+$/u.test(input)) {
        this.message = 'Letters only, please.';
        return;
      }
      this.message = '';
      this.$emit('search', input.length >= 2 ? input : '');
    }
  }
}
</script>

<style>
.search {
  font-family: 'EB Garamond', serif;
  font-size: 2em;
}

.search-input {
  background: transparent;
  border-bottom: 1px solid black;
  text-transform: uppercase;
  width: 9em;
  outline: none;
}

.search-input::placeholder {
  color: black;
  opacity: 0.4;
}

.search-message {
  font-size: 0.5em;
  padding-top: 0.5em;
}
</style>
