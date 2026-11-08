import { useMemo } from 'react';
import { formatNumber } from '../data/format';
import { useChartTheme } from '../charts/chartTheme';
import { PART_TO_WHOLE } from './vizRules';
import { useLabels } from './useLabels';
import { useSlots } from './useWidgetModel';

// Model (raw values) → view (display numbers, labels, colors, formatted text) that the
// chart components draw. Colors follow the entity: status values wear their status
// tone, parts of a whole get sticky categorical slots, single-series bars one hue.
export const useView = (data, viz, dimensionKey, breakdownKey) => {
  const { label, format, language } = useLabels();
  const chart = useChartTheme();
  const model = data.model;
  const keys = useMemo(() => {
    if (model?.kind === 'categorical') {
      return model.series ?? model.items.map((item) => item.key);
    }
    return model?.series ?? [];
  }, [model]);
  const slots = useSlots(keys);

  return useMemo(() => {
    if (!model || !data.measure) {
      return null;
    }
    const unit = data.measure.unit;
    const display = (raw) => {
      const formatted = format(raw, unit);
      return { value: formatted.number, text: formatted.text, full: formatted.full };
    };
    const formatDisplay = (value) => (value == null ? '—' : formatNumber(value, unit, language));
    const tones = data.dimension?.tones;
    const colorOf = (item) => {
      if (item.other) {
        return chart.other;
      }
      if (tones?.[item.key]) {
        return chart.tone(tones[item.key]);
      }
      if (PART_TO_WHOLE.includes(viz)) {
        return chart.slotColor(slots[item.key]);
      }
      return chart.single;
    };
    const series = model.series?.map((key) => ({
      key,
      label: label(breakdownKey, key),
      color: data.breakdown?.tones?.[key]
        ? chart.tone(data.breakdown.tones[key])
        : chart.slotColor(slots[key]),
    }));
    const valuesOf = (values) =>
      values
        ? Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, display(value).value]),
          )
        : null;

    if (model.kind === 'scalar') {
      const shown = display(model.value);
      return { kind: 'scalar', ...shown, raw: model.value, format: formatDisplay, unit };
    }
    if (model.kind === 'timeseries') {
      const points = model.points.map((point) => {
        const shown = display(point.value);
        return {
          key: point.key,
          label: label(dimensionKey, point.key, model.bucket),
          value: point.future ? null : shown.value,
          text: shown.text,
          full: shown.full,
          partial: point.partial,
          future: point.future,
          values: valuesOf(point.values),
        };
      });
      const total = model.points.reduce((sum, point) => sum + (point.value ?? 0), 0);
      return {
        kind: 'timeseries',
        points,
        series,
        totalText: display(total).text,
        format: formatDisplay,
        unit,
        summary: points
          .filter((point) => point.value != null)
          .map((point) => `${point.label}: ${point.full}`)
          .join(', '),
      };
    }
    const total = model.total;
    const items = model.items.map((item) => {
      const shown = display(item.value);
      const share = total ? (item.value ?? 0) / total : 0;
      return {
        key: item.key,
        other: item.other,
        keys: item.keys,
        label: label(dimensionKey, item.key),
        value: shown.value,
        text: shown.text,
        full: shown.full,
        share,
        shareText: `${Math.round(share * 100)}%`,
        color: colorOf(item),
        values: valuesOf(item.values),
      };
    });
    const totalShown = display(total);
    return {
      kind: 'categorical',
      ordinal: data.dimension?.type === 'ordinal',
      items,
      series,
      total: totalShown.value,
      totalText: totalShown.text,
      totalFull: totalShown.full,
      format: formatDisplay,
      unit,
      summary: items.map((item) => `${item.label}: ${item.full}`).join(', '),
    };
  }, [
    model,
    data.measure,
    data.dimension,
    data.breakdown,
    viz,
    slots,
    chart,
    format,
    label,
    language,
    dimensionKey,
    breakdownKey,
  ]);
};
