import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/sora';
import assistantHebrew from '@fontsource-variable/assistant/files/assistant-hebrew-wght-normal.woff2';
import './site.css';
import App from './App';

// Assistant for Hebrew, registered with the same size adjustment as the app
// (src/common/theme/fonts.js) so Hebrew and Sora sit at one optical size.
const face = new FontFace('Assistant Brand', `url(${assistantHebrew}) format('woff2-variations')`, {
  weight: '200 800',
  display: 'swap',
  unicodeRange: 'U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F',
  sizeAdjust: '108%',
});
document.fonts.add(face);
face.load().catch(() => {});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
