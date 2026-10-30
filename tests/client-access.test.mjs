// Clients never mix (Erika, Oct 30: "Bill is signed in but all he can see in Blog Builder is Culture Foundry"). The Blog
// Builder opens a client only after the shared check (pilot-dash client-access.js, through Brand.connect) and checks it again
// before it reads anything of it; nothing comes from the ?brand= summary, and no access is switched on before the check.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../lib/data.js', import.meta.url), 'utf8');
const init = src.slice(src.indexOf('export async function init()'), src.indexOf('export function dashboardUrl()'));
test('start-up: no Brand Command access is switched on for the address client before the check', () => {
  assert.doesNotMatch(init, /if \(lp\.clientId\) \{ try \{ if \(!\(await Brand\.hasAccess\(lp\.clientId/);
  assert.match(init, /Access = await import\(PILOT \+ 'client-access\.js'\);/);
  assert.match(init, /S\.orgId = \(await Access\.orgFor\(lp\.orgId \|\| ''\)/, 'the agency is the person\'s own');
  assert.doesNotMatch(init, /get\('brand'\)/);
});
test('every client is checked before anything of it is read, on load and on every switch', () => {
  assert.match(init, /async function useClient\(clientId, brand\) \{\n  \/\/ [^\n]*\n  const ok = await Access\.canOpenClient\(clientId\)/);
  assert.match(init, /if \(!ok\.ok\) \{ Access\.refuse\(clientId\); S\.clientId = null; S\.brand = null; S\.raw = null; return null; \}/);
  assert.match(init, /export async function switchClient\(clientId\) \{\n  if \(PREVIEW\) return null;\n  if \(!\(await Access\.canOpenClient\(clientId\)\)\.ok\) \{ Access\.refuse\(clientId\); return null; \}/);
  assert.match(init, /return out \? \{ \.\.\.out, user \} : \{ mode: 'no-client', user \};/);
});
