// PRF-06: the first load's size budget. Reads build/index.html, adds up (gzip) the entry
// script, the scripts it preloads and the stylesheets, and fails when the total is over the
// budget. Run after `npm run build`: `node tools/size-budget.mjs [build]`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

export const BUDGET_KB = 500;

const dir = process.argv[2] || 'build';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const files = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g),
].map((match) => match[1].replace(/^\.?\//, ''));

const sizes = [...new Set(files)]
  .map((file) => ({ file, kb: gzipSync(readFileSync(join(dir, file))).length / 1024 }))
  .sort((a, b) => b.kb - a.kb);
const total = sizes.reduce((sum, item) => sum + item.kb, 0);

sizes.forEach(({ file, kb }) => console.log(`${kb.toFixed(1).padStart(8)} KB  ${file}`));
console.log(`${total.toFixed(1).padStart(8)} KB  first load (gzip), budget ${BUDGET_KB} KB`);
if (total > BUDGET_KB) {
  console.error(`The first load is ${(total - BUDGET_KB).toFixed(1)} KB over the budget.`);
  process.exit(1);
}
