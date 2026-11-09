// Brand guard for stylesheets (BRAND.md, section 9), run by `npm run lint`.
// ESLint covers colors in JavaScript; this covers .css files: no raw colors outside the files
// that define the brand colors, and no gradients or glows anywhere.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

// Files allowed to hold raw brand colors: the token sheet and the loader that paints before the
// app (and its theme) has loaded.
const COLOR_ALLOWED = new Set(['brand/brand-tokens.css', 'public/styles.css']);

const checks = [
  {
    pattern: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/,
    message: 'raw color: use the CSS variables set from the theme',
    applies: (file) => !COLOR_ALLOWED.has(file),
  },
  {
    pattern: /(?:linear|radial|conic)-gradient\(/,
    message: 'gradient: the brand is flat',
    applies: () => true,
  },
  {
    // A shadow with no offset and a blur is a glow: "0 0 8px".
    pattern: /box-shadow:\s*0 0 [1-9]\d*px/,
    message: 'glow: shadows lift floating UI only, with an offset',
    applies: () => true,
  },
];

const files = execFileSync('git', ['ls-files', '*.css'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const problems = [];
files.forEach((file) => {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      checks.forEach(({ pattern, message, applies }) => {
        if (applies(file) && pattern.test(line)) {
          problems.push(`${file}:${index + 1}  ${message}\n    ${line.trim()}`);
        }
      });
    });
});

if (problems.length) {
  console.error(`Brand CSS guard: ${problems.length} problem(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`Brand CSS guard: ${files.length} stylesheets OK`);
