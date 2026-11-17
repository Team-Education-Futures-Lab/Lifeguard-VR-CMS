// Tijdelijk script: toont per sabotagetest waar hij faalt. Verwijder na gebruik samen met sab.json.
// Gebruik (cmd):  npx playwright test tests/zz-sabotage-003 --reporter=json > sab.json
//                 node zz-sab-report.mjs sab.json
import fs from 'node:fs';

const strip = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');
const raw = fs.readFileSync(process.argv[2] ?? 'sab.json', 'utf8').replace(/^﻿/, '');
const report = JSON.parse(raw.slice(raw.indexOf('{')));
const lines = new Map();
const sourceLine = (file, line) => {
  if (!lines.has(file)) lines.set(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : []);
  return (lines.get(file)[line - 1] ?? '').trim();
};

function walk(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const result = test.results?.[0];
      const error = result?.error ?? result?.errors?.[0];
      if (result?.status === 'passed') {
        console.log(`\n!! SLAAGT (hoort te falen): ${spec.title}`);
        continue;
      }
      const first = strip(error?.message).split('\n')[0];
      const loc = error?.location;
      console.log(`\n${spec.title}`);
      console.log(`  ${first.slice(0, 140)}`);
      if (loc) console.log(`  regel ${loc.line}: ${sourceLine(loc.file, loc.line).slice(0, 150)}`);
    }
  }
  for (const child of suite.suites ?? []) walk(child);
}
for (const suite of report.suites ?? []) walk(suite);
