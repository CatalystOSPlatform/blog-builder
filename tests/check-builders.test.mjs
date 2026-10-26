// The builder header contract (pilot-dash staging/check-builders.mjs): the shared four-bar header with the Campaign picker.
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const PILOT = process.env.COS_PILOT || '/home/claude/pilot-dash';
const { checkRepo } = await import(PILOT + '/staging/check-builders.mjs');
test('check-builders passes: index.html loads catalyst-shell.js and the Campaign picker is on', () => {
  const r = checkRepo(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'blog-builder');
  assert.ok(r.ok, r.problems.join('\n')); assert.match(r.pages[0].how, /shared shell/);
});
