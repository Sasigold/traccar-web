import { describe, expect, it } from 'vitest';
import { typographyFor } from '..';

// A11-11 (BRAND §5): capitals and letter spacing are for Latin labels only.
describe('section labels', () => {
  it('keep the overline style for Latin', () => {
    expect(typographyFor('ltr').overline).toMatchObject({
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    });
  });

  it('read plain in Hebrew', () => {
    expect(typographyFor('rtl').overline).toMatchObject({
      letterSpacing: 0,
      textTransform: 'none',
    });
  });

  it('offer sectionLabel, plain in both directions', () => {
    ['ltr', 'rtl'].forEach((direction) =>
      expect(typographyFor(direction).sectionLabel).toMatchObject({
        letterSpacing: 0,
        textTransform: 'none',
        fontWeight: 600,
      }),
    );
  });
});
