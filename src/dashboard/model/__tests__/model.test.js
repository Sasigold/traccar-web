import { describe, expect, it } from 'vitest';
import en from '../../../resources/l10n/en.json';
import he from '../../../resources/l10n/he.json';
import { checkRows } from '../../layout/normalize';
import { PRESETS, presetAvailable, widgetInfo } from '../../widgets/catalog';
import { allowedViz } from '../../widgets/vizRules';
import { DATASETS, DIMENSIONS, labelKeyOf } from '../../data/datasets';
import { MAX_REMOTE_CHARS, decode, encode, fitsRemote } from '../codec';
import { minOfFor, normalizeDoc } from '../schema';
import { TEMPLATE_KEYS, instantiateTemplate, templateCoverage } from '../templates';

const doc = () => ({
  v: 1,
  activeId: TEMPLATE_KEYS[0],
  updatedAt: 1762600000000,
  dashboards: TEMPLATE_KEYS.map((key) => ({ ...instantiateTemplate(key), id: key })),
});

describe('templates', () => {
  it.each(TEMPLATE_KEYS)('%s is gapless', (key) => {
    const dashboard = instantiateTemplate(key);
    expect(dashboard.rows.length).toBeGreaterThan(0);
    expect(checkRows(dashboard.rows, minOfFor(dashboard.widgets))).toBe(true);
  });

  it('closes the layout around widgets that are not available', () => {
    const available = (preset) => preset.category !== 'fleet' && preset.id !== 'liveMap';
    const dashboard = instantiateTemplate('operations', available);
    const presets = Object.values(dashboard.widgets).map((widget) => widget.preset);
    expect(presets).not.toContain('liveMap');
    expect(presets).not.toContain('expiries');
    expect(checkRows(dashboard.rows, minOfFor(dashboard.widgets))).toBe(true);
    expect(templateCoverage('maintenance', available)).toBe(0);
  });
});

describe('codec', () => {
  it('round-trips a document', () => {
    const original = normalizeDoc(doc());
    const decoded = decode(encode(original));
    expect(decoded.activeId).toBe(original.activeId);
    expect(decoded.dashboards.map((d) => d.widgets)).toEqual(
      original.dashboards.map((d) => d.widgets),
    );
    expect(
      decoded.dashboards.map((d) =>
        d.rows.map((row) => [row.h, row.cells.map((cell) => [cell.w, cell.items])]),
      ),
    ).toEqual(
      original.dashboards.map((d) =>
        d.rows.map((row) => [row.h, row.cells.map((cell) => [cell.w, cell.items])]),
      ),
    );
  });

  it('stays small enough for the user attributes', () => {
    const encoded = encode(normalizeDoc(doc()));
    expect(encoded.length).toBeLessThan(MAX_REMOTE_CHARS);
    expect(fitsRemote(encoded, { darkMode: true })).toBe(true);
    expect(fitsRemote(encoded, { notes: 'x'.repeat(3000) })).toBe(false);
  });

  it('turns garbage into null instead of throwing', () => {
    expect(decode('{not json')).toBeNull();
    expect(decode('{"d":[]}')).toBeNull();
    expect(decode('{"d":[{"L":"x","W":5}]}').dashboards[0].rows).toEqual([]);
    expect(decode(null)).toBeNull();
  });

  it('repairs a hand-edited document', () => {
    const value = JSON.parse(encode(normalizeDoc(doc())));
    value.d[0].L[0][1][0] = 7; // a row that no longer adds up to 12
    value.d[0].W.zz = 'noSuchPreset';
    value.d[0].f = ['custom', 'bad', 'dates'];
    const repaired = decode(JSON.stringify(value));
    const dashboard = repaired.dashboards[0];
    expect(checkRows(dashboard.rows, minOfFor(dashboard.widgets))).toBe(true);
    expect(dashboard.filters.period).toBe('today');
  });

  it('keeps only one of each singleton widget', () => {
    const dashboard = {
      id: 'x',
      rows: [
        {
          h: 9,
          cells: [
            { w: 6, items: [{ id: 'a', h: 9 }] },
            { w: 6, items: [{ id: 'b', h: 9 }] },
          ],
        },
      ],
      widgets: { a: { preset: 'liveMap' }, b: { preset: 'liveMap' } },
    };
    const result = normalizeDoc({ dashboards: [dashboard] });
    expect(Object.keys(result.dashboards[0].widgets)).toEqual(['a']);
    expect(result.dashboards[0].rows[0].cells).toHaveLength(1);
  });
});

describe('catalog', () => {
  const keys = new Set(Object.keys(en));

  it.each(PRESETS.map((preset) => [preset.id, preset]))('%s is consistent', (_, preset) => {
    expect(keys.has(preset.titleKey), preset.titleKey).toBe(true);
    expect(he[preset.titleKey], preset.titleKey).toBeTruthy();
    expect(keys.has(`${preset.titleKey}Desc`), `${preset.titleKey}Desc`).toBe(true);
    const info = widgetInfo({ preset: preset.id });
    expect(info.size.w).toBeGreaterThanOrEqual(info.min.w);
    expect(info.size.h).toBeGreaterThanOrEqual(info.min.h);
    if (preset.kind === 'chart') {
      const dataset = DATASETS[preset.query.ds];
      expect(dataset.measures[preset.query.m]).toBeTruthy();
      expect(dataset.dimensions).toContain(preset.query.d);
      expect(allowedViz(preset.query, dataset.measures[preset.query.m])).toContain(preset.viz);
    }
    (preset.metrics ?? []).forEach((metric) => {
      const [ds, m] = metric.split('.');
      expect(DATASETS[ds].measures[m], metric).toBeTruthy();
    });
  });

  it('has a label for every dataset, dimension and measure', () => {
    Object.values(DATASETS).forEach((dataset) => {
      expect(keys.has(dataset.labelKey), dataset.labelKey).toBe(true);
      Object.values(dataset.measures).forEach((measure) => {
        expect(keys.has(measure.labelKey), measure.labelKey).toBe(true);
      });
    });
    Object.keys(DIMENSIONS).forEach((key) => {
      const labelKey = `dashboardD${key[0].toUpperCase()}${key.slice(1)}`;
      expect(keys.has(labelKey), labelKey).toBe(true);
      (DIMENSIONS[key].labelPrefix && DIMENSIONS[key].order ? DIMENSIONS[key].order : []).forEach(
        (value) => {
          const valueKey = labelKeyOf(DIMENSIONS[key].labelPrefix, value);
          expect(keys.has(valueKey), valueKey).toBe(true);
        },
      );
    });
  });

  it('applies gates', () => {
    const gates = { reports: false, fleet: () => false, features: { disableMaintenance: true } };
    const available = PRESETS.filter((preset) => presetAvailable(preset, gates)).map(
      (preset) => preset.id,
    );
    expect(available).toContain('fleetStatus');
    expect(available).not.toContain('distanceTrend');
    expect(available).not.toContain('costsByCategory');
    expect(available).not.toContain('maintenanceDue');
  });
});
