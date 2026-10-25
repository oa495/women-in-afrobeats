module.exports = {
  devServer: {
    // Netlify functions (the Spotify token) only run under `netlify dev` on port 8888,
    // so the Vue dev server on 8080 forwards them there
    proxy: {
      '/.netlify': { target: 'http://localhost:8888' }
    }
  }
};
