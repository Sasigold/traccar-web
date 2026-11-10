// A plain document in its own window, ready to print or save as PDF: a header line, a title and
// sections of paragraphs, lists and tables. Built with DOM nodes, so text from the database stays
// text. Used by the processing register (SEC-12); the older letters keep their own layouts.
const printDocument = (win, document, { title, direction, fontFamily }) => {
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
    h2 { font-size: 12pt; font-weight: 700; margin: 16pt 0 4pt; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid; padding: 3pt 6pt; text-align: start; vertical-align: top; }
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

  const meta = add(doc.body, 'div', null, 'meta');
  add(meta, 'div', document.organization);
  add(meta, 'div', document.date);
  add(doc.body, 'h1', document.title);
  if (document.intro) add(doc.body, 'p', document.intro);

  document.sections.forEach((section) => {
    add(doc.body, 'h2', section.title);
    (section.paragraphs || []).forEach((text) => add(doc.body, 'p', text));
    if (section.items) {
      const list = add(doc.body, 'ul');
      section.items.forEach((text) => add(list, 'li', text));
    }
    if (section.table) {
      const node = add(doc.body, 'table');
      const head = add(add(node, 'thead'), 'tr');
      section.table.headers.forEach((header) => add(head, 'th', header));
      const body = add(node, 'tbody');
      section.table.rows.forEach((row) => {
        const line = add(body, 'tr');
        row.forEach((cell) => add(line, 'td', cell));
      });
    }
  });

  if (document.signatures) {
    const signatures = add(doc.body, 'div', null, 'signatures');
    document.signatures.forEach((label) => add(signatures, 'div', label));
  }

  win.focus();
  win.print();
};

export default printDocument;
