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
const fail = []; let aiCalls = 0; let STORE = null; const aiAsked = []; // every AI request's text, to check who it was written as
const AI_MS = Number(process.env.AI_MS || 1500); // long enough that the CatalystOS status popup shows (it waits half a second)

async function page(width, store) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  if (store) await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('__seeded')) { Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); sessionStorage.setItem('__seeded', '1'); } } catch (e) {} }, store);
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.origin === new URL(base).origin) return route.continue();
    if (u.host === 'unpkg.com') { const f = path.join(VENDOR, u.pathname.slice(1)); return fs.existsSync(f) ? route.fulfill({ path: f, contentType: 'text/javascript' }) : route.abort(); }
    if (u.host === 'pilot-dash-ten.vercel.app') {
      if (u.pathname === '/api/claude') { aiCalls++; let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {} aiAsked.push((body.messages || []).map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n')); await new Promise((r) => setTimeout(r, AI_MS)); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: stubAnswer(body), usage: null }) }); }
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
  // the shared status popup has finished (it is checked on its own above), so axe checks this screen, not the popup over it
  await p.waitForFunction(() => { const h = document.querySelector('[data-cos-working]'); return !h || !h.shadowRoot || !h.shadowRoot.querySelector('.panel,.pill'); }, null, { timeout: 12000 }).catch(() => {});
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
  const ideasBefore = aiCalls;
  await p.click('[data-ctw-card="educational"]');
  await p.waitForSelector('#bb-start-h');
  // Topic ideas for the current campaign (lib/topics.js): progress only in the shared popup, a quiet placeholder in the list.
  { const before = ideasBefore;
    await p.waitForSelector('[data-cos-working] >> text=Finding topic ideas', { timeout: 15000 }).catch(() => fail.push(width + ': the status popup did not show while topic ideas were found'));
    if (!(await p.$('.bb-ideas-wait'))) fail.push(width + ': no quiet placeholder while topic ideas load');
    await p.waitForSelector('[data-bb-idea]', { timeout: 20000 }).catch(() => fail.push(width + ': no topic ideas'));
    const I = await p.evaluate(() => ({ h: (document.querySelector('#bb-ideas-h') || {}).textContent || '', n: document.querySelectorAll('[data-bb-idea]').length, text: [...document.querySelectorAll('[data-bb-idea]')].map((b) => b.textContent).join(' | '), status: (document.querySelector('[data-bb-ideas-status]') || {}).textContent || '', tag: (document.querySelector('[data-bb-idea]') || {}).tagName }));
    console.log('topic ideas', width, I.n, I.h, '·', I.status);
    if (!/^Topic ideas for Retirement Income Season$/.test(I.h.trim())) fail.push('ideas heading wrong: ' + I.h);
    if (I.n < 4 || I.n > 6) fail.push('expected 4 to 6 topic ideas, got ' + I.n);
    if (/80%/.test(I.text)) fail.push('an idea with a made-up figure reached the screen');
    if (/Strategist|Senior Writer|scraped/i.test(I.text)) fail.push('agent names or "scraped" on screen');
    if (!/Source: Demo Research Institute/.test(I.text)) fail.push('the fact idea does not show its verified source');
    if (!/topic ideas for Retirement Income Season are ready/.test(I.status)) fail.push('no status message announced the ideas: ' + I.status);
    if (I.tag !== 'BUTTON') fail.push('ideas are not buttons');
    if (aiCalls - before !== 1) fail.push('topic ideas should take one request, took ' + (aiCalls - before));
    await p.focus('[data-bb-ideas-refresh]'); await p.keyboard.press('Tab');
    const ring = await p.evaluate(() => { const el = document.activeElement; return el && el.hasAttribute('data-bb-idea') ? getComputedStyle(el).outlineStyle : 'not on an idea'; });
    if (ring !== 'solid') fail.push(width + ': no visible focus on a topic idea (' + ring + ')');
    await p.keyboard.press('Enter');
    const f = await p.evaluate(() => ({ topic: document.querySelector('[data-bb-topic]').value, aud: document.querySelector('input[placeholder="Write who it is for"]').value, pressed: document.querySelector('[data-bb-idea][aria-pressed="true"] .bb-idea-h') && document.querySelector('[data-bb-idea][aria-pressed="true"] .bb-idea-h').textContent }));
    if (!/^Why a Written Income Plan Calms Retirement Decisions\. From saving to spending/.test(f.topic)) fail.push('clicking an idea did not fill the Topic box: ' + f.topic);
    if (f.aud !== 'Pre-retirees') fail.push('clicking an idea with a persona did not fill the empty Audience: ' + f.aud);
    if (!f.pressed) fail.push('the chosen idea is not marked');
    await shot(p, '2a-topic-ideas', width); }
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
{ const p = await page(1440);
  await p.goto(base + '?client=demo&type=how-to', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#bb-start-h', { timeout: 60000 }); // ?type= skips the home
  await p.waitForSelector('[data-bb-idea]', { timeout: 20000 }).catch(() => fail.push('how-to: no topic ideas'));
  // Cached per client + campaign + type: coming back to the same start page asks nothing.
  { const b0 = aiCalls; await p.goto(base + '?client=demo&type=how-to', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-bb-idea]', { timeout: 60000 }); await wait(400);
    if (aiCalls !== b0) fail.push('returning to the start page asked for topic ideas again');
    await p.click('[data-bb-ideas-more]'); await p.waitForFunction(() => document.querySelectorAll('[data-bb-idea]').length > 6, null, { timeout: 15000 }).catch(() => fail.push('More Ideas added nothing'));
    if (aiCalls !== b0 + 1) fail.push('More Ideas should take one request'); }
  const before = aiCalls;
  if (await p.$('text=What Article Are You Writing?')) fail.push('?type= showed the home'); await p.click('button:has-text("I’ll Make This Myself")');
  await p.waitForSelector('[data-bb-article]'); const heads = await p.$$eval('[data-bb-sec] textarea[aria-label^="Heading"]', (a) => a.map((x) => x.value));
  console.log('manual outline', heads); if (heads[0] !== 'What You Will Do' || aiCalls !== before) fail.push('manual outline wrong or used AI');
  await shot(p, '8-manual', 1440);
  await p.click('button:has-text("New Article")'); await p.waitForSelector('[role="alertdialog"]', { timeout: 5000 }).then(() => p.click('[role="alertdialog"] button:has-text("Leave Without Saving")')).catch(() => {});
  await p.waitForSelector('text=What Article Are You Writing?', { timeout: 10000 });
  await p.click('[data-ctw-card="thought-leadership"]'); await p.waitForSelector('#bb-start-h');
  await p.click('button[role="radio"]:has-text("From the Current Campaign")'); await p.waitForSelector('text=Campaign Strategy v2', { timeout: 15000 }).catch(() => fail.push('campaign strategy line missing'));
  // From the Current Campaign uses the same ideas list, and the picked idea steers the brief.
  await p.waitForSelector('[data-bb-idea]', { timeout: 20000 }).catch(() => fail.push('From the Current Campaign: no topic ideas'));
  await p.click('[data-bb-idea] >> nth=3'); const ct = await p.$eval('[data-bb-topic]', (x) => x.value); if (!ct) fail.push('From the Current Campaign: clicking an idea did not fill the topic');
  await shot(p, '9-start-campaign', 1440);
  await p.click('[data-bb-create]'); await p.waitForSelector('#bb-brief-h', { timeout: 30000 });
  const res = await p.$$eval('#bb-main li', (a) => a.map((x) => x.textContent)); if (!res.some((x) => /Sample fact/.test(x))) fail.push('verified research not in the brief');
  await shot(p, '10-brief-campaign', 1440);
  // Company News: no real news in the campaign, so a plain note and no ideas (nothing invented).
  await p.goto(base + '?client=demo&type=company-news', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#bb-start-h', { timeout: 60000 });
  await p.waitForSelector('[data-bb-ideas-note]', { timeout: 20000 }).catch(() => fail.push('Company News: no note'));
  { const t = await p.$eval('[data-bb-ideas-note]', (x) => x.textContent).catch(() => ''); if (!/nothing real to announce/.test(t) || (await p.$('[data-bb-idea]'))) fail.push('Company News invented news: ' + t); }
  await shot(p, '11-company-news-ideas', 1440);
  // No campaign picked: no request, and the list says to pick one.
  { const b0 = aiCalls; await p.evaluate(() => window.dispatchEvent(new CustomEvent('cos-campaign-picked', { detail: { clientId: 'demo', campaignId: 'none' } })));
    await p.waitForSelector('[data-bb-ideas-nocamp]', { timeout: 10000 }).catch(() => fail.push('no campaign: no message'));
    const t = await p.$eval('[data-bb-ideas-nocamp]', (x) => x.textContent).catch(() => ''); if (t.trim() !== 'Pick a campaign at the top to see topic ideas') fail.push('no campaign message wrong: ' + t);
    if (aiCalls !== b0) fail.push('no campaign still asked for ideas'); await shot(p, '12-no-campaign-ideas', 1440); }
  await p.close(); }
// 3b. 400 px: ideas from the current campaign and with no campaign.
{ const p = await page(400);
  await p.goto(base + '?client=demo&type=thought-leadership', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-bb-idea]', { timeout: 60000 });
  await p.click('button[role="radio"]:has-text("From the Current Campaign")'); await p.waitForSelector('[data-bb-idea]');
  await shot(p, '9-start-campaign', 400);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('cos-campaign-picked', { detail: { clientId: 'demo', campaignId: 'none' } }))); await p.waitForSelector('[data-bb-ideas-nocamp]', { timeout: 10000 }).catch(() => fail.push('400: no campaign message'));
  await shot(p, '12-no-campaign-ideas', 400); await p.close(); }
// 4. Hands-off run (Run Campaign, kind blog-article): brief → write → save, no person.
{ const p = await page(1440);
  await p.goto(base + '?client=demo&cos_auto=1&kind=blog-article&campaign=c1&title=How%20to%20plan%20retirement%20income&mode=both&job=t1', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { try { return Object.values(JSON.parse(localStorage.getItem('cos-blog-builder:demo') || '{}')).some((m) => m.campaignId === 'c1' && m.blocks.length > 4); } catch (e) { return false; } }, null, { timeout: 90000 }).catch(() => fail.push('cos_auto run did not save an article'));
  const m = (await saved(p)).find((x) => x.campaignId === 'c1') || {}; console.log('cos_auto article', m.templateId, m.title, (m.brief || {}).approved);
  if (m.templateId !== 'how-to' || !(m.brief || {}).approved) fail.push('cos_auto made the wrong article'); await p.close(); }
// 5. Who is this from? (lib/author.js; Erika, Oct 29): the company voice or a founder or leader. Preview people (fictional):
// Claire Holloway, approved for writing; Theo Marsh, not approved yet.
const lastAsk = (re) => [...aiAsked].reverse().find((t) => re.test(t)) || '';
const who = (p) => p.evaluate(() => ({ legend: (document.querySelector('[data-bb-from] legend') || {}).textContent || '', opts: [...document.querySelectorAll('[data-bb-from] [data-bb-who]')].map((l) => ({ id: l.getAttribute('data-bb-who'), text: l.textContent.replace(/\s+/g, ' ').trim(), checked: l.querySelector('input').checked, radio: l.querySelector('input').type })),
  create: !!(document.querySelector('[data-bb-create]') || {}).disabled, why: (document.querySelector('[data-bb-create-why]') || {}).textContent || '', note: (document.querySelector('[data-bb-from-note]') || {}).textContent || '', link: (document.querySelector('[data-bb-from-note] a') || {}).href || '', target: (document.querySelector('[data-bb-from-note] a') || {}).target || '' }));
const textOf = (p) => p.evaluate(() => [...document.querySelectorAll('[data-bb-article] textarea')].map((t) => t.value).join('\n'));
for (const width of [1440, 400]) {
  const p = await page(width);
  await p.goto(base + '?client=demo&type=thought-leadership', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-bb-who="p-claire"]', { timeout: 60000 });
  // the topic ideas' popup has come and gone (the shared popup is checked in 1.), so the shots show this screen
  await p.waitForSelector('[data-bb-idea]', { timeout: 20000 }).catch(() => {}); await p.waitForFunction(() => { const h = document.querySelector('[data-cos-working]'); return !h || !h.shadowRoot || !h.shadowRoot.querySelector('.panel,.pill'); }, null, { timeout: 15000 }).catch(() => {});
  const order = await p.evaluate(() => { const h = [...document.querySelectorAll('#bb-main *')]; const a = h.find((x) => x.id === 'bb-way-lbl'), b = document.querySelector('[data-bb-from]'), c = document.querySelector('[data-bb-topic]'); return !!(a.compareDocumentPosition(b) & 4) && !!(b.compareDocumentPosition(c) & 4); });
  if (!order) fail.push(width + ': Who is this from? is not right under How do you want to start?');
  let W = await who(p); console.log('who', width, JSON.stringify(W.opts.map((o) => [o.id, o.checked, o.text])));
  if (W.legend !== 'Who is this from?' || W.opts.length !== 3 || W.opts.some((o) => o.radio !== 'radio')) fail.push(width + ': the Who is this from? radio group is wrong');
  if (!W.opts[0] || W.opts[0].id !== 'company' || !W.opts[0].checked) fail.push(width + ': the company voice is not the default');
  if (!/Claire Holloway\s*Founder and Managing Partner\s*Ready$/.test((W.opts[1] || {}).text || '')) fail.push(width + ': Claire is not listed as Ready: ' + (W.opts[1] || {}).text);
  if (!/Theo Marsh.*Voice not ready yet: Not approved for writing yet$/.test((W.opts[2] || {}).text || '')) fail.push(width + ': Theo is not listed with the reason: ' + (W.opts[2] || {}).text);
  if (W.create) fail.push(width + ': Create is off for the company voice');
  // keyboard: a native radio group (arrow keys move the choice) with a visible focus ring
  await p.focus('[data-bb-who="company"] input'); await p.keyboard.press('ArrowDown');
  const k = await p.evaluate(() => { const el = document.activeElement; const lab = el && el.closest('[data-bb-who]'); return { id: lab && lab.getAttribute('data-bb-who'), ring: lab ? getComputedStyle(lab).outlineStyle : '' }; });
  if (k.id !== 'p-claire' || k.ring !== 'solid') fail.push(width + ': arrow keys or the focus ring do not work in Who is this from? ' + JSON.stringify(k));
  // a person who is not ready: can be picked; Create is off with the reason; the note links to their profile in Brand Command
  await p.click('[data-bb-who="p-theo"]'); W = await who(p);
  if (!(W.opts[2] || {}).checked) fail.push(width + ': Theo could not be picked');
  if (!W.create || !/Let CatalystOS Create This is off: Theo Marsh’s voice isn’t ready yet \(not approved for writing yet\)/.test(W.why)) fail.push(width + ': Create is not blocked with the reason: ' + W.why);
  if (!/You can still make this yourself with Theo’s byline/.test(W.note) || !/Open Theo Marsh’s profile in Brand Command/.test(W.note) || !/Brand%20Command%20Center\.dc\.html\?client=demo#founders=p-theo$/.test(W.link) || W.target !== '_blank') fail.push(width + ': the not-ready note or Brand Command link is wrong: ' + W.note + ' ' + W.link);
  await p.$eval('[data-bb-from]', (el) => el.scrollIntoView({ block: 'start' }));
  await shot(p, '13-who-not-ready', width);
  { const b0 = aiCalls; await p.click('[data-bb-create]', { force: true, timeout: 2000 }).catch(() => {}); await wait(300); if (aiCalls !== b0 || (await p.$('#bb-brief-h'))) fail.push(width + ': Create ran for a person who is not approved'); }
  // I'll Make This Myself still works and sets the byline (no AI)
  { const b0 = aiCalls; await p.click('button:has-text("I’ll Make This Myself")'); await p.waitForSelector('[data-bb-write-as]');
    const n = await p.textContent('[data-bb-wa-name]'); const st = await p.textContent('[data-bb-wa-status]').catch(() => '');
    if (n.trim() !== 'Theo Marsh' || !/Voice not ready yet: Not approved for writing yet/.test(st) || aiCalls !== b0) fail.push(width + ': I’ll Make This Myself did not keep Theo’s byline: ' + n + ' / ' + st);
    await p.click('[data-bb-wa-toggle]'); await p.waitForSelector('#bb-wa-panel [data-bb-who="p-claire"]');
    const nOpts = await p.$$eval('#bb-wa-panel [data-bb-who]', (a) => a.length); if (nOpts !== 3) fail.push(width + ': the editor’s Write as does not show the full list');
    await p.$eval('[data-bb-write-as]', (el) => el.scrollIntoView({ block: 'start' })); await shot(p, '14-write-as-open', width);
    await p.click('#bb-wa-panel [data-bb-who="company"]'); await p.click('[data-bb-wa-apply]'); await wait(200);
    if ((await p.$('[data-bb-ask]')) || (await p.textContent('[data-bb-wa-name]')).trim() !== 'Company voice') fail.push(width + ': an empty article did not just change to the company voice'); }
  // From Claire (approved): the brief records her and uses her approved perspectives, facts and topics; written as her
  await p.click('button:has-text("New Article")'); await p.waitForSelector('[role="alertdialog"]', { timeout: 3000 }).then(() => p.click('[role="alertdialog"] button:has-text("Leave Without Saving")')).catch(() => {});
  await p.waitForSelector('text=What Article Are You Writing?', { timeout: 10000 }); await p.click('[data-ctw-card="thought-leadership"]'); await p.waitForSelector('[data-bb-who="p-claire"]');
  if (!(await p.$eval('[data-bb-who="p-theo"] input', (x) => x.checked))) fail.push(width + ': the pick was not kept for the next article');
  await p.click('[data-bb-who="p-claire"]'); await p.fill('[data-bb-topic]', 'Why retirees need a written income plan');
  await p.click('[data-bb-create]'); await p.waitForSelector('#bb-brief-h', { timeout: 30000 });
  { const bw = await p.textContent('[data-bb-brief-who]'); const cc = await p.$eval('textarea[placeholder="Write the Brand Command facts that matter here"]', (x) => x.value);
    if (!/From: Claire Holloway, Founder and Managing Partner, written in their voice\./.test(bw)) fail.push(width + ': the brief does not record the author: ' + bw);
    if (!/^From Claire Holloway’s approved profile \(Founders & Leadership\):\nTheir perspectives:\n- A retirement plan should be written down/.test(cc) || !/Topics they speak on:\n- Retirement income/.test(cc)) fail.push(width + ': the brief does not use Claire’s approved knowledge: ' + cc.slice(0, 160));
    if (!/THIS ARTICLE IS FROM Claire Holloway, Founder and Managing Partner/.test(lastAsk(/Write the editorial brief/))) fail.push(width + ': the brief request was not told who it is from'); }
  await p.click('[data-bb-brief-approve]'); await p.click('[data-bb-write]'); await p.waitForSelector('[data-bb-write-as]', { timeout: 60000 }); await wait(400);
  if (!/Byline: Claire Holloway, Founder and Managing Partner \(written as them/.test(lastAsk(/Write a complete blog article/))) fail.push(width + ': the article was not written as Claire');
  if ((await p.textContent('[data-bb-wa-name]')).trim() !== 'Claire Holloway') fail.push(width + ': the byline is not Claire');
  // a byline-only change: asked in-page (three choices), no AI, the text unchanged
  { const t0 = await textOf(p), b0 = aiCalls;
    await p.click('[data-bb-wa-toggle]'); await p.click('#bb-wa-panel [data-bb-who="company"]'); await p.click('[data-bb-wa-apply]'); await p.waitForSelector('[data-bb-ask] [role="alertdialog"]'); await wait(200);
    const D = await p.evaluate(() => ({ h: document.querySelector('#bb-ask-h').textContent, b: [...document.querySelectorAll('[data-bb-ask] button')].map((x) => x.textContent.trim()), f: document.activeElement && document.activeElement.textContent.trim(), modal: document.querySelector('[data-bb-ask] [role="alertdialog"]').getAttribute('aria-modal') }));
    if (D.h !== 'Rewrite this article as the company voice?' || D.b.join('|') !== 'Rewrite All|Just Change the Byline|Cancel' || D.f !== 'Rewrite All' || D.modal !== 'true') fail.push(width + ': the rewrite question is wrong: ' + JSON.stringify(D));
    await shot(p, '15-ask-rewrite', width);
    await p.keyboard.press('Escape'); await wait(150); if (await p.$('[data-bb-ask]')) fail.push(width + ': Escape did not cancel');
    if ((await p.textContent('[data-bb-wa-name]')).trim() !== 'Claire Holloway') fail.push(width + ': Cancel changed the author');
    await p.click('[data-bb-wa-toggle]'); await p.click('#bb-wa-panel [data-bb-who="company"]'); await p.click('[data-bb-wa-apply]'); await p.click('[data-bb-ask-byline]'); await wait(200);
    if ((await p.textContent('[data-bb-wa-name]')).trim() !== 'Company voice' || (await textOf(p)) !== t0 || aiCalls !== b0) fail.push(width + ': Just Change the Byline changed the text or used AI'); }
  // Rewrite All: the writer again with the new voice; progress only in the shared popup; the old version kept (Switch Back)
  { const t0 = await textOf(p), b0 = aiCalls;
    await p.click('[data-bb-wa-toggle]'); await p.click('#bb-wa-panel [data-bb-who="p-claire"]'); await p.click('[data-bb-wa-apply]'); await p.waitForSelector('[data-bb-ask-rewrite]');
    if ((await p.textContent('#bb-ask-h')) !== 'Rewrite this article as Claire Holloway?') fail.push(width + ': rewrite question title wrong');
    await p.click('[data-bb-ask-rewrite]');
    await p.waitForSelector('[data-cos-working] >> text=Rewriting in Claire Holloway’s voice', { timeout: 15000 }).catch(() => fail.push(width + ': the status popup did not say Rewriting in Claire Holloway’s voice'));
    if (await p.$('[data-bb-busy]')) fail.push(width + ': a progress line on the page');
    await p.waitForSelector('[data-bb-switch-back]', { timeout: 60000 }).catch(() => fail.push(width + ': no Switch Back after Rewrite All'));
    const q = lastAsk(/Write a complete blog article/);
    if (aiCalls - b0 < 1 || !/Byline: Claire Holloway, Founder and Managing Partner \(written as them/.test(q) || !/REWRITE IN THE NEW VOICE/.test(q) || !/Keep the same outline/.test(q)) fail.push(width + ': Rewrite All did not ask the writer for Claire’s voice with the article as guidance');
    if ((await p.textContent('[data-bb-wa-name]')).trim() !== 'Claire Holloway') fail.push(width + ': the byline did not follow the rewrite');
    const vers = await p.$$eval('[data-bb-versions] li', (a) => a.map((x) => x.textContent.replace(/\s+/g, ' ').trim())); if (!vers.length || !/Before rewriting in Claire Holloway’s voice · Company voice/.test(vers[0])) fail.push(width + ': the earlier version is not listed: ' + vers);
    await p.$eval('[data-bb-write-as]', (el) => el.scrollIntoView({ block: 'start' })); await shot(p, '16-rewritten', width);
    await p.click('[data-bb-switch-back]'); await wait(200);
    if ((await p.textContent('[data-bb-wa-name]')).trim() !== 'Company voice' || (await textOf(p)) !== t0) fail.push(width + ': Switch Back did not bring back the company-voice version'); }
  // never written as someone who is not approved: the question offers only the byline, with the reason and the link
  { const b0 = aiCalls; await p.click('[data-bb-wa-toggle]'); await p.click('#bb-wa-panel [data-bb-who="p-theo"]');
    const nt = await p.textContent('[data-bb-wa-note]').catch(() => ''); if (!/Theo Marsh: Not approved for writing yet/.test(nt)) fail.push(width + ': picking Theo in the editor shows no reason');
    await p.click('[data-bb-wa-apply]'); await p.waitForSelector('[data-bb-ask]');
    const D = await p.evaluate(() => ({ h: document.querySelector('#bb-ask-h').textContent, p: document.querySelector('#bb-ask-p').textContent, rw: !!document.querySelector('[data-bb-ask-rewrite]'), link: (document.querySelector('[data-bb-ask] a') || {}).href || '' }));
    if (D.rw || D.h !== 'Change the byline to Theo Marsh?' || !/can’t write as Theo Marsh yet: Not approved for writing yet/.test(D.p) || !/#founders=p-theo$/.test(D.link)) fail.push(width + ': a not-approved person could be rewritten as: ' + JSON.stringify(D));
    await shot(p, '17-ask-not-ready', width);
    await p.click('[data-bb-ask-byline]'); await wait(200);
    if (aiCalls !== b0 || (await p.textContent('[data-bb-wa-name]')).trim() !== 'Theo Marsh') fail.push(width + ': the byline-only change to Theo failed');
    if (await p.$('[data-bb-create]')) fail.push('editor shows the start Create'); }
  if (width === 1440) { await p.click('[data-cos-save]'); await wait(600);
    const m = (await saved(p)).find((x) => (x.builder || {}).versions) || {}; if (!m.builder || m.builder.versions.length < 1 || (m.editorial || {}).author.id !== 'p-theo') fail.push('the saved article lost its versions or author: ' + JSON.stringify((m.editorial || {}).author)); }
  await p.close();
}
await browser.close(); server.close();
console.log('AI calls:', aiCalls);
if (fail.length) { console.error('FAILED:\n' + fail.join('\n')); process.exit(1); }
console.log('render ok');
