// The safety officer's quarterly report to the owner (ISR-04), in its own window ready to print
// or save as PDF. Built with DOM nodes, so names from the database stay text.
const printQuarterReport = (win, report, { title, direction, fontFamily }) => {
  const doc = win.document;
  doc.title = title;
  doc.documentElement.lang = direction === 'rtl' ? 'he' : 'en';
  doc.documentElement.dir = direction;

  const style = doc.createElement('style');
  style.textContent = `
    @page { margin: 20mm 18mm; }
    body { font-family: ${fontFamily}; font-size: 11pt; line-height: 1.6; max-width: 175mm; margin: 0 auto; }
    @media screen { body { padding: 24px; } }
    .meta { display: flex; justify-content: space-between; gap: 12pt; }
    h1 { font-size: 15pt; font-weight: 700; margin: 12pt 0 4pt; }
    h2 { font-size: 12pt; font-weight: 700; margin: 18pt 0 6pt; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid; padding: 3pt 6pt; text-align: start; vertical-align: top; }
    td.number { text-align: end; font-variant-numeric: tabular-nums; width: 25%; }
    .signatures { display: flex; gap: 24mm; margin-top: 36pt; }
    .signatures div { flex: 1; border-top: 1px solid; padding-top: 4pt; }
  `;
  doc.head.appendChild(style);

  const add = (parent, tag, text, className) => {
    const node = doc.createElement(tag);
    if (text != null) node.textContent = String(text);
    if (className) node.className = className;
    parent.appendChild(node);
    return node;
  };
  const table = (headers, rows, numberColumns = []) => {
    const node = add(doc.body, 'table');
    const head = add(add(node, 'thead'), 'tr');
    headers.forEach((header) => add(head, 'th', header));
    const body = add(node, 'tbody');
    rows.forEach((row) => {
      const line = add(body, 'tr');
      row.forEach((cell, index) =>
        add(line, 'td', cell, numberColumns.includes(index) ? 'number' : null),
      );
    });
  };

  const meta = add(doc.body, 'div', null, 'meta');
  add(meta, 'div', report.organization);
  add(meta, 'div', report.date);
  add(doc.body, 'h1', report.title);
  add(doc.body, 'p', report.period);

  add(doc.body, 'h2', report.summaryTitle);
  table(report.summaryHeaders, report.summary, [1]);

  add(doc.body, 'h2', report.tasksTitle);
  if (report.tasks.length) {
    table(report.tasksHeaders, report.tasks);
  } else {
    add(doc.body, 'p', report.noTasks);
  }

  add(doc.body, 'h2', report.notesTitle);
  add(doc.body, 'p', '_'.repeat(80));
  add(doc.body, 'p', '_'.repeat(80));

  const signatures = add(doc.body, 'div', null, 'signatures');
  report.signatures.forEach((label) => add(signatures, 'div', label));

  win.focus();
  win.print();
};

export default printQuarterReport;
