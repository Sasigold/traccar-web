import { parseCsv } from '../fleet/fuelImport';

// The first worksheet of an .xlsx file, or a CSV file, as rows of cell values.
const readSheet = async (file) => {
  if (!/\.xlsx$/i.test(file.name)) {
    return parseCsv(await file.text());
  }
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  const rows = [];
  sheet.eachRow((row) => {
    rows.push(
      row.values
        .slice(1)
        .map((value) =>
          value && typeof value === 'object' && 'result' in value ? value.result : value,
        ),
    );
  });
  return rows;
};

export default readSheet;
