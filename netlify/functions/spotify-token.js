// Returns a Spotify access token using the Client Credentials flow.
// Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars in Netlify.
let cached = null;

exports.handler = async () => {
  if (cached && cached.expires_at > Date.now() + 60 * 1000) {
    return respond(200, {
      access_token: cached.access_token,
      expires_in: Math.floor((cached.expires_at - Date.now()) / 1000)
    });
  }

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return respond(500, { error: 'Missing Spotify credentials' });
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    return respond(502, { error: 'Spotify token request failed' });
  }

  const { access_token, expires_in } = await response.json();
  cached = { access_token, expires_at: Date.now() + expires_in * 1000 };
  return respond(200, { access_token, expires_in });
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});
