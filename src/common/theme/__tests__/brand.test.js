import { describe, expect, it } from 'vitest';
import { brandColors } from '../tokens';

// Contrast ratio per WCAG 2.1.
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('brand palette', () => {
  it('matches the brand book exactly', () => {
    expect(brandColors).toEqual({
      navy: '#102C54',
      aqua: '#35D7D6',
      ice: '#E1F5F7',
      paper: '#F8FCFD',
      ink: '#0A1C30',
      slate: '#567286',
      white: '#FFFFFF',
    });
  });

  it('main action (ink on aqua) passes AA', () => {
    expect(contrast(brandColors.ink, brandColors.aqua)).toBeGreaterThanOrEqual(4.5);
  });

  it('body text pairs pass AA', () => {
    expect(contrast(brandColors.ink, brandColors.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandColors.navy, brandColors.white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandColors.slate, brandColors.white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandColors.paper, brandColors.navy)).toBeGreaterThanOrEqual(4.5);
  });

  it('aqua text on light backgrounds fails, which is why BRAND.md forbids it', () => {
    expect(contrast(brandColors.aqua, brandColors.white)).toBeLessThan(4.5);
  });
});
