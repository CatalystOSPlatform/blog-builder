// Renders the Blog Builder with no network: sign-in and Firestore stubbed (the local preview client, saved in this
// browser), the AI stubbed (tests/stub-ai.mjs), the dashboard's shared files served from a pilot-dash checkout.
// Walks every screen, checks the flow and saves screenshots at 1440 and 400 px wide.
//   node tests/render.mjs [outDir]
// Env: COS_PILOT (pilot-dash checkout, default /home/claude/pilot-dash), COS_VENDOR (folder with react@18.3.1/umd,
// react-dom@18.3.1/umd, @babel/standalone@7.29.0, the files support.js loads from unpkg), COS_CHROMIUM (browser binary).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { stubAnswer } from './stub-ai.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PILOT = process.env.COS_PILOT || '/home/claude/pilot-dash';
const VENDOR = process.env.COS_VENDOR || '/tmp/claude-0/-home-claude/00c71b85-ed51-564d-abd4-757cba18081c/scratchpad/lg/cdn';
const OUT = process.argv[2] || '/tmp/claude-0/-home-claude/00c71b85-ed51-564d-abd4-757cba18081c/scratchpad/blog';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { try { pw = require('/opt/npm-tools/node_modules/playwright'); } catch (e2) { pw = require('/tmp/claude-0/-home-claude/00c71b85-ed51-564d-abd4-757cba18081c/scratchpad/node_modules/playwright'); } }
const AXE = process.env.COS_AXE || '/tmp/claude-0/-home-claude/00c71b85-ed51-564d-abd4-757cba18081c/scratchpad/npmv/node_modules/axe-core/axe.min.js';
const exe = process.env.COS_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (u.pathname === '/') f = path.join(ROOT, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const fail = []; let aiCalls = 0; let STORE = null;
const AI_MS = Number(process.env.AI_MS || 1500); // long enough that the CatalystOS status popup shows (it waits half a second)

async function page(width, store) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  if (store) await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('__seeded')) { Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); sessionStorage.setItem('__seeded', '1'); } } catch (e) {} }, store);
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.origin === new URL(base).origin) return route.continue();
    if (u.host === 'unpkg.com') { const f = path.join(VENDOR, u.pathname.slice(1)); return fs.existsSync(f) ? route.fulfill({ path: f, contentType: 'text/javascript' }) : route.abort(); }
    if (u.host === 'pilot-dash-ten.vercel.app') {
      if (u.pathname === '/api/claude') { aiCalls++; let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {} await new Promise((r) => setTimeout(r, AI_MS)); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: stubAnswer(body), usage: null }) }); }
      if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      const f = path.join(PILOT, decodeURIComponent(u.pathname));
      if (f.startsWith(PILOT) && fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'text/plain', headers: { 'access-control-allow-origin': '*' } });
      return route.fulfill({ status: 404, body: '' });
    }
    if (/fonts\.googleapis\.com/.test(u.host)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail.push(width + ' pageerror: ' + e.message));
  p.on('dialog', (d) => { fail.push('browser dialog: ' + d.message()); d.dismiss().catch(() => {}); });
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(p, name, width) {
  await wait(500);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (width <= 400 && sw > 0) fail.push(name + ' @' + width + ': sideways scroll of ' + sw + 'px');
  if (fs.existsSync(AXE)) { // WCAG 2.2 AA on what is showing (axe-core, when available)
    await p.addScriptTag({ path: AXE }); const v = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] } })).violations.map((x) => x.id + ' (' + x.nodes.length + '): ' + x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')));
    v.forEach((x) => fail.push(name + ' @' + width + ' axe: ' + x)); }
  const file = path.join(OUT, 'shot-' + name + '-' + width + '.png'); await p.screenshot({ path: file, fullPage: true }); console.log('saved', file);
}
const saved = (p) => p.evaluate(() => { try { return Object.values(JSON.parse(localStorage.getItem('cos-blog-builder:demo') || '{}')); } catch (e) { return []; } });

// 1. Let CatalystOS Create This: home → start (topic) → brief → write → editor → save → Download chooser.
for (const width of [1440, 400]) {
  const p = await page(width);
  await p.goto(base + '?client=demo', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('text=What Article Are You Writing?', { timeout: 60000 });
  await p.waitForSelector('text=Recommended for', { timeout: 15000 }).catch(() => fail.push('no industry line'));
  const cards = await p.$$eval('[data-ctw-card]', (a) => a.map((x) => x.getAttribute('data-ctw-card')));
  if (cards[0] !== 'blank') fail.push('Blank Article is not first: ' + cards.slice(0, 3));
  await shot(p, '1-home', width);
  await p.click('[data-ctw-card="educational"]');
  await p.waitForSelector('#bb-start-h');
  await p.fill('[data-bb-topic]', 'Why retirees need a written income plan');
  await shot(p, '2-start', width);
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); // Erika, Oct 28: scrolled down to the button
  await p.click('[data-bb-create]');
  // The one status popup (cos-working.js): "Drafting your brief" shows at the bottom right wherever the page is scrolled,
  // and no progress line is drawn at the top of the page.
  await p.waitForSelector('[data-cos-working] >> text=Drafting your brief', { timeout: 15000 }).catch(() => fail.push(width + ': the status popup did not show while the brief was drafted'));
  { const r = await p.evaluate(() => { const h = document.querySelector('[data-cos-working]'); const el = h && h.shadowRoot && h.shadowRoot.querySelector('.panel,.pill'); if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, vh: innerHeight, vw: innerWidth, line: !!document.querySelector('[data-bb-busy]'), status: !!h.shadowRoot.querySelector('[role=status]'), region: (h.shadowRoot.querySelector('[role=region]') || {}).getAttribute && h.shadowRoot.querySelector('[role=region]').getAttribute('aria-label') }; });
    if (!r) fail.push(width + ': no status popup');
    else { if (r.top < 0 || r.bottom > r.vh || r.left < 0 || r.right > r.vw) fail.push(width + ': the status popup is not fully in view ' + JSON.stringify(r)); if (r.line) fail.push(width + ': the old progress line is still on the page'); if (!r.status || !r.region) fail.push(width + ': the status popup has no live status or region label'); }
    const back = await p.evaluate(() => { const a = document.querySelector('a[data-catalyst-back]'); const h = document.querySelector('[data-cos-working]'); const el = h && h.shadowRoot && h.shadowRoot.querySelector('.panel,.pill'); if (!a || !el) return null; const x = a.getBoundingClientRect(), y = el.getBoundingClientRect(); return !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top); });
    if (back) fail.push(width + ': the status popup covers Back to Main Dashboard'); }
  await wait(350); await p.screenshot({ path: path.join(OUT, 'shot-2b-brief-drafting-' + width + '.png') }); console.log('saved', path.join(OUT, 'shot-2b-brief-drafting-' + width + '.png'));
  await p.waitForSelector('#bb-brief-h', { timeout: 30000 });
  await shot(p, '3-brief', width);
  if (!(await p.$('[data-bb-write]:disabled'))) fail.push('Write is enabled before the brief is approved');
  await p.click('[data-bb-brief-approve]');
  await p.click('[data-bb-write]');
  await p.waitForSelector('[data-bb-article]', { timeout: 60000 });
  await p.waitForSelector('text=Production check', { timeout: 10000 });
  await wait(800);
  const ed = await p.evaluate(() => ({ title: document.querySelector('[data-bw="title"]').value, secs: document.querySelectorAll('[data-bb-sec]').length, flags: document.querySelectorAll('[data-bb-review] .bb-flag').length, sources: document.querySelectorAll('[data-bb-source]').length, tb: [...document.querySelectorAll('[data-cos-taskbar] > *')].map((x) => (x.textContent || '').trim()).filter(Boolean) }));
  console.log('editor', JSON.stringify(ed));
  if (!ed.title || ed.secs < 5) fail.push('editor did not get the written article');
  if (!ed.flags) fail.push('the [Source needed] claim was not flagged');
  if (ed.sources !== 1) fail.push('expected the one verified source');
  if (!/^Save$/.test(ed.tb[ed.tb.length - 1])) fail.push('Save is not last in the task bar: ' + ed.tb.join(' | '));
  await shot(p, '4-editor', width);
  await p.click('[data-cos-save]');
  await p.waitForFunction(() => { try { return Object.keys(JSON.parse(localStorage.getItem('cos-blog-builder:demo') || '{}')).length > 0; } catch (e) { return false; } }, null, { timeout: 15000 }).catch(() => fail.push('Save did not save'));
  const m = (await saved(p))[0] || {};
  const v = await p.evaluate((x) => window.CosArticleModel.validate(x, { purpose: 'draft' }), m);
  console.log('saved model', m.articleId, m.templateId, (m.blocks || []).length, 'blocks; validate', v.ok, v.errors.map((e) => e.message));
  if (!v.ok || m.templateId !== 'educational' || !m.brief || !m.seo.slug) fail.push('saved article model is not valid or incomplete');
  if (width === 1440) {
    await p.click('[data-cos-download]'); await p.waitForSelector('#bb-dl-menu'); await shot(p, '5-download', width);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#bb-dl-menu button:has-text("Markdown")')]);
    const md = fs.readFileSync(await dl.path(), 'utf8'); if (!/^# Why a Written Income Plan/.test(md) || !/## Sources/.test(md)) fail.push('Markdown download wrong'); console.log('download', dl.suggestedFilename());
    await p.click('[data-bb-approve-all]'); await wait(300);
    const pill = await p.textContent('[data-bb-pill]'); if (!/Approved/.test(pill)) fail.push('Approve All did not approve: ' + pill);
    // Article Types window from the editor
    await p.click('button.bb-twb'); await p.waitForSelector('[role="dialog"] >> text=What Article Are You Writing?', { timeout: 10000 }).catch(() => fail.push('Article Types window did not open'));
    await shot(p, '6-types-window', width); await p.keyboard.press('Escape');
  }
  if (width === 1440) STORE = await p.evaluate(() => ({ 'cos-blog-builder:demo': localStorage.getItem('cos-blog-builder:demo') || '{}' }));
  await p.close();
}
// 2. Save / open round trip: ?article= (the Saved Files link) opens the editor and skips the home.
{ const store = STORE || { 'cos-blog-builder:demo': '{}' };
  const p = await page(1440, store); const before = aiCalls;
  const id = Object.keys(JSON.parse(store['cos-blog-builder:demo']))[0];
  await p.goto(base + '?client=demo&article=' + encodeURIComponent(id), { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-bb-article]', { timeout: 60000 }).catch(() => fail.push('?article= did not open the editor'));
  if (await p.$('text=What Article Are You Writing?')) fail.push('?article= showed the home');
  const t = await p.$eval('[data-bw="title"]', (x) => x.value); if (!/Written Income Plan/.test(t)) fail.push('reopened article lost its title');
  if (aiCalls !== before) fail.push('opening a saved article used AI');
  await shot(p, '7-reopened', 1440); await p.close(); }
// 3. I'll Make This Myself: the type's outline, no AI. Then from the current campaign (Mode E).
{ const p = await page(1440); const before = aiCalls;
  await p.goto(base + '?client=demo&type=how-to', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#bb-start-h', { timeout: 60000 }); // ?type= skips the home
  if (await p.$('text=What Article Are You Writing?')) fail.push('?type= showed the home'); await p.click('button:has-text("I’ll Make This Myself")');
  await p.waitForSelector('[data-bb-article]'); const heads = await p.$$eval('[data-bb-sec] textarea[aria-label^="Heading"]', (a) => a.map((x) => x.value));
  console.log('manual outline', heads); if (heads[0] !== 'What You Will Do' || aiCalls !== before) fail.push('manual outline wrong or used AI');
  await shot(p, '8-manual', 1440);
  await p.click('button:has-text("New Article")'); await p.waitForSelector('[role="alertdialog"]', { timeout: 5000 }).then(() => p.click('[role="alertdialog"] button:has-text("Leave Without Saving")')).catch(() => {});
  await p.waitForSelector('text=What Article Are You Writing?', { timeout: 10000 });
  await p.click('[data-ctw-card="thought-leadership"]'); await p.waitForSelector('#bb-start-h');
  await p.click('button[role="radio"]:has-text("From the Current Campaign")'); await p.waitForSelector('text=Campaign Strategy v2', { timeout: 15000 }).catch(() => fail.push('campaign strategy line missing'));
  await shot(p, '9-start-campaign', 1440);
  await p.click('[data-bb-create]'); await p.waitForSelector('#bb-brief-h', { timeout: 30000 });
  const res = await p.$$eval('#bb-main li', (a) => a.map((x) => x.textContent)); if (!res.some((x) => /Sample fact/.test(x))) fail.push('verified research not in the brief');
  await shot(p, '10-brief-campaign', 1440); await p.close(); }
// 4. Hands-off run (Run Campaign, kind blog-article): brief → write → save, no person.
{ const p = await page(1440);
  await p.goto(base + '?client=demo&cos_auto=1&kind=blog-article&campaign=c1&title=How%20to%20plan%20retirement%20income&mode=both&job=t1', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { try { return Object.values(JSON.parse(localStorage.getItem('cos-blog-builder:demo') || '{}')).some((m) => m.campaignId === 'c1' && m.blocks.length > 4); } catch (e) { return false; } }, null, { timeout: 90000 }).catch(() => fail.push('cos_auto run did not save an article'));
  const m = (await saved(p)).find((x) => x.campaignId === 'c1') || {}; console.log('cos_auto article', m.templateId, m.title, (m.brief || {}).approved);
  if (m.templateId !== 'how-to' || !(m.brief || {}).approved) fail.push('cos_auto made the wrong article'); await p.close(); }
await browser.close(); server.close();
console.log('AI calls:', aiCalls);
if (fail.length) { console.error('FAILED:\n' + fail.join('\n')); process.exit(1); }
console.log('render ok');
