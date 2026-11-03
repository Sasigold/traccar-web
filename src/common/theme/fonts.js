import '@fontsource-variable/sora';
import assistantHebrew from '@fontsource-variable/assistant/files/assistant-hebrew-wght-normal.woff2';

// Brand typefaces (brand book page 07): Sora for Latin text and numbers,
// Assistant for Hebrew. Sora is loaded from @fontsource; the Hebrew subset of
// Assistant is registered here with a size adjustment so Hebrew sits at the
// same optical size as Sora when the two mix on one line.
export const assistantFace = {
  fontFamily: 'Assistant Brand',
  fontStyle: 'normal',
  fontDisplay: 'swap',
  fontWeight: '200 800',
  src: `url(${assistantHebrew}) format('woff2-variations')`,
  unicodeRange: 'U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F',
  sizeAdjust: '108%',
};
