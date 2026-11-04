// Google Map Tiles API protocol for MapLibre (`google://<mapType>/{z}/{x}/{y}?key=...`).
// Based on maplibre-google-maps, which hard-codes the session to en-US. Here the tile
// language and region come from the URL (`language`, `region`), so labels follow the UI language.
const sessions = {};

const createSession = async (url) => {
  const key = url.searchParams.get('key');
  const layerType = url.searchParams.get('layerType');
  const overlay = url.searchParams.get('overlay');
  const request = {
    mapType: url.hostname,
    language: url.searchParams.get('language') || 'en-US',
    region: url.searchParams.get('region') || 'IL',
    scale: 'scaleFactor2x',
    highDpi: true,
  };
  if (layerType) {
    request.layerTypes = [layerType];
  }
  if (overlay) {
    request.overlay = overlay === 'true';
  }
  const response = await fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const result = await response.json();
  return result.session;
};

export const googleProtocol = async (params) => {
  const url = new URL(params.url.replace('google://', 'https://'));
  const sessionKey = `${url.hostname}?${url.searchParams}`;
  if (!sessions[sessionKey]) {
    sessions[sessionKey] = createSession(url).catch((error) => {
      delete sessions[sessionKey];
      throw error;
    });
  }
  const session = await sessions[sessionKey];
  const key = url.searchParams.get('key');
  const tile = await fetch(
    `https://tile.googleapis.com/v1/2dtiles${url.pathname}?session=${session}&key=${key}`,
  );
  return { data: await tile.arrayBuffer() };
};

// Google expects the legacy `iw` code for Hebrew in the classic tile endpoint.
export const googleLanguage = (language) => (language === 'he' ? 'iw' : language || 'en');

// Query string for a Map Tiles API session: BCP-47 language, Israeli region (borders and names).
export const googleSessionQuery = (language) =>
  `language=${language === 'he' ? 'he-IL' : language || 'en-US'}&region=IL`;
