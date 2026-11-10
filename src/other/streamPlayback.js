// LIV-17: how a live camera stream is played on this browser.
// hls.js where Media Source Extensions exist; Safari on iPhone has none, but plays HLS natively.
export const STREAM_TIMEOUT = 20000;
export const STREAM_CHANNELS = [1, 2, 3, 4];

export const playbackMode = (HlsClass, video) => {
  if (HlsClass?.isSupported?.()) return 'hls';
  if (video?.canPlayType?.('application/vnd.apple.mpegurl')) return 'native';
  return 'unsupported';
};

export const streamUrl = (deviceId, channel, base = document.baseURI) =>
  new URL(`api/stream/${deviceId}/${channel}/live.m3u8`, base).href;
