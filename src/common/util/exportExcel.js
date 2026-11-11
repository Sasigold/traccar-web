// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { saveAs } from 'file-saver';
import logoUrl from '../../../brand/logos/sync-point-midnight-aqua-primary.png';
import store from '../../store';
import { translate } from './translator';
import { formatTime } from './formatter';
import { slate } from '../theme/tokens';

// Excel export shared by every report and list.
//
// - One fixed look from the tokens (not the screen's mode): ice header row with bold ink type,
//   a frozen header with filters, right to left for Hebrew.
// - A brand header: logo, report name, period, vehicles, and who produced it when.
// - Values shown as "12.3 ק״מ" become numbers (the unit moves to the column title), so they can
//   be summed and sorted. Identifiers and phone numbers stay text.
// - Sheet names are cleaned of characters Excel refuses ("/", ":"…) and never collide: two
//   vehicles with the same name get two sheets.
// - File name with the report and the period: viper-fleet_trips_2026-11-01_2026-11-07.xlsx.
//
// `sheets` maps a key to rows (objects of column title → value), or to { title, rows }.
// options: { period: { from, to }, scope, totals: [column titles to sum] }. Without a period,
// the from/to of the page address are used.

const argb = (hex) => `FF${hex.replace('#', '').toUpperCase()}`;

const border = { style: 'thin', color: { argb: argb(slate[200]) } };
const borderDefinition = { top: border, left: border, bottom: border, right: border };

// A plain number with an optional unit after it ("12.3 ק״מ", "1,250", "45%"). Leading zeros and
// long digit runs are identifiers or phone numbers, not quantities.
const NUMBER = /^-?(?:\d{1,3}(?:,\d{3})+|\d{1,9})(?:\.\d+)?$/;
export const splitNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { number: value, unit: '' };
  }
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(-?[\d,]+(?:\.\d+)?)(?:\s*([^\d]+))?$/.exec(value.trim());
  if (!match || !NUMBER.test(match[1]) || /^-?0\d/.test(match[1])) {
    return null;
  }
  return { number: Number(match[1].replace(/,/g, '')), unit: (match[2] || '').trim() };
};

// A column is numeric when every filled cell is a number with the same unit.
export const numericColumn = (values) => {
  const filled = values.filter((value) => value !== null && value !== undefined && value !== '');
  if (!filled.length) {
    return null;
  }
  const parsed = filled.map(splitNumber);
  if (parsed.some((item) => !item) || new Set(parsed.map((item) => item.unit)).size > 1) {
    return null;
  }
  return {
    unit: parsed[0].unit,
    integer: parsed.every((item) => Number.isInteger(item.number)),
  };
};

export const sheetName = (name, used) => {
  const base = (
    String(name ?? '')
      .replace(/[\\/*?:[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Sheet'
  ).slice(0, 31);
  let candidate = base;
  for (let index = 2; used.has(candidate.toLowerCase()); index += 1) {
    const suffix = ` (${index})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

const isoDay = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
};

export const exportFileName = (fileName, period) => {
  const base = fileName.replace(/\.xlsx$/i, '');
  const from = isoDay(period?.from);
  const to = isoDay(period?.to);
  const span = from && to ? `${from}_${to}` : isoDay(new Date());
  return `viper-fleet_${base}_${span}.xlsx`;
};

const loadLogo = async () => {
  try {
    const response = await fetch(logoUrl);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
};

const exportExcel = async (title, fileName, sheets, theme, options = {}) => {
  if (sheets.size === 0) {
    return;
  }

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const { brand } = theme.palette;
  const rtl = theme.direction === 'rtl';
  const user = store.getState().session.user;
  const search = new URLSearchParams(window.location.search);
  const period = options.period || { from: search.get('from'), to: search.get('to') };

  const entries = [...sheets.entries()].map(([key, value]) =>
    Array.isArray(value) ? { title: key, rows: value } : value,
  );
  const scope =
    options.scope ||
    (entries.length > 1
      ? entries.length <= 3
        ? entries.map((entry) => entry.title).join(', ')
        : translate('exportVehiclesCount').replace('{0}', entries.length)
      : null);

  const logo = await loadLogo();
  const logoId = logo ? workbook.addImage({ buffer: logo, extension: 'png' }) : null;

  const used = new Set();
  entries.forEach(({ title: entryTitle, rows }) => {
    if (!rows.length) {
      return;
    }
    const worksheet = workbook.addWorksheet(sheetName(entryTitle, used));
    const keys = Object.keys(rows[0]);
    const numeric = keys.map((key) => numericColumn(rows.map((row) => row[key])));
    const headers = keys.map((key, index) =>
      numeric[index]?.unit ? `${key} (${numeric[index].unit})` : key,
    );

    // Brand header: logo (kept at its 2400×460 proportions), name, period, scope, author.
    if (logoId != null) {
      worksheet.addRow([]);
      worksheet.getRow(1).height = 34;
      worksheet.addImage(logoId, { tl: { col: 0, row: 0.15 }, ext: { width: 156, height: 30 } });
    }
    const titleRow = worksheet.addRow([title]);
    titleRow.font = { bold: true, size: 14, color: { argb: argb(brand.ink) } };
    const meta = [];
    if (period.from && period.to) {
      meta.push(
        translate('exportPeriod').replace(
          '{0}',
          `${formatTime(period.from, 'date')} – ${formatTime(period.to, 'date')}`,
        ),
      );
    }
    if (scope) {
      meta.push(translate('exportScope').replace('{0}', scope));
    }
    meta.push(
      translate('exportGenerated')
        .replace('{0}', user?.name || '')
        .replace('{1}', formatTime(new Date(), 'minutes')),
    );
    meta.forEach((line) => {
      worksheet.addRow([line]).font = { color: { argb: argb(brand.slate) } };
    });
    worksheet.addRow([]);

    const headerRow = worksheet.addRow(headers);
    const headerNumber = headerRow.number;
    headerRow.eachCell((cell) => {
      cell.border = borderDefinition;
      cell.font = { bold: true, color: { argb: argb(brand.ink) } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(brand.ice) } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    rows.forEach((item) => {
      const values = keys.map((key, index) =>
        numeric[index] ? (splitNumber(item[key])?.number ?? null) : item[key],
      );
      const row = worksheet.addRow(values);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = borderDefinition;
      });
    });
    const lastData = headerNumber + rows.length;

    keys.forEach((key, index) => {
      if (numeric[index]) {
        worksheet.getColumn(index + 1).numFmt = numeric[index].integer ? '#,##0' : '#,##0.0#';
      }
    });

    // Totals row for the columns the report asks to sum.
    const totals = (options.totals || [])
      .map((key) => keys.indexOf(key))
      .filter((index) => index >= 0 && numeric[index]);
    if (totals.length) {
      const totalRow = worksheet.addRow([]);
      totalRow.getCell(1).value = translate('exportTotal');
      totals.forEach((index) => {
        const letter = worksheet.getColumn(index + 1).letter;
        totalRow.getCell(index + 1).value = {
          formula: `SUM(${letter}${headerNumber + 1}:${letter}${lastData})`,
        };
      });
      totalRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = borderDefinition;
        cell.font = { bold: true, color: { argb: argb(brand.ink) } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(brand.ice) } };
      });
    }

    worksheet.views = [{ state: 'frozen', ySplit: headerNumber, rightToLeft: rtl }];
    worksheet.autoFilter = {
      from: { row: headerNumber, column: 1 },
      to: { row: lastData, column: headers.length },
    };

    headers.forEach((header, index) => {
      let maxLength = String(header).length;
      rows.forEach((item) => {
        const value = item[keys[index]];
        if (value !== null && value !== undefined) {
          maxLength = Math.max(maxLength, String(value).length);
        }
      });
      worksheet.getColumn(index + 1).width = Math.min(Math.max(maxLength + 2, 10), 60);
    });
  });

  const blob = new Blob([await workbook.xlsx.writeBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, exportFileName(fileName, period));
};

export default exportExcel;
