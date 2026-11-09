// The driver-transfer notice in its own window, ready to print, sign and send. The window is
// opened by the click itself (before any request), so pop-up blockers let it through; the
// letter is built with DOM nodes, not HTML strings, so names and numbers stay text.
export const openLetterWindow = () => window.open('', '_blank');

const printTransferLetter = (win, letter, { title, direction, fontFamily }) => {
  const doc = win.document;
  doc.title = title;
  doc.documentElement.lang = direction === 'rtl' ? 'he' : 'en';
  doc.documentElement.dir = direction;

  const style = doc.createElement('style');
  style.textContent = `
    @page { margin: 25mm 20mm; }
    body { font-family: ${fontFamily}; font-size: 12pt; line-height: 1.7; max-width: 170mm; margin: 0 auto; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 24pt; }
    h1 { font-size: 13pt; font-weight: 700; text-decoration: underline; margin: 18pt 0; }
    .declaration { margin-top: 24pt; padding-top: 12pt; border-top: 1px solid; }
    .signatures { display: flex; gap: 24mm; margin-top: 36pt; }
    .signatures div { flex: 1; border-top: 1px solid; padding-top: 4pt; }
    @media screen { body { padding: 24px; } }
  `;
  doc.head.appendChild(style);

  const add = (parent, tag, text, className) => {
    const node = doc.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    parent.appendChild(node);
    return node;
  };

  const meta = add(doc.body, 'div', null, 'meta');
  add(meta, 'div', letter.sender);
  add(meta, 'div', letter.date);
  add(doc.body, 'p', letter.to);
  add(doc.body, 'h1', letter.subject);
  letter.body.forEach((paragraph) => add(doc.body, 'p', paragraph));
  add(doc.body, 'p', letter.declaration, 'declaration');
  const signatures = add(doc.body, 'div', null, 'signatures');
  letter.signatures.forEach((label) => add(signatures, 'div', label));

  win.focus();
  win.print();
};

export default printTransferLetter;
