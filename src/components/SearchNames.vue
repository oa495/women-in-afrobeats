<template>
  <form class="search text-center" v-on:submit.prevent="emitSearch" role="search">
    <input class="search-input text-center" :value="modelValue" v-on:input="onInput"
      placeholder="Search a name" aria-label="Search a name" maxlength="30" autocomplete="off">
    <span class="search-message block" v-if="message"><i>{{message}}</i></span>
  </form>
</template>

<script>
/* eslint-disable */
// Typing updates the model (the name list filters on it); Enter emits `search` with the typed name
export default {
  name: 'SearchNames',
  props: ['modelValue'],
  emits: ['update:modelValue', 'search'],
  data() {
    return {
      message: ''
    }
  },
  methods: {
    onInput(event) {
      this.message = '';
      this.$emit('update:modelValue', event.target.value);
    },
    emitSearch() {
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
