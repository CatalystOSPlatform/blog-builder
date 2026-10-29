// Run: node --test tests/topics.test.mjs
// Topic ideas for the current campaign (Erika, Oct 29: "Blog builder: suggest topics based on the existing campaign"),
// with the AI stubbed: ideas from a fixture campaign, the cache, what clicking fills, no invented facts (only verified
// research is cited), Company News with no real news, and no campaign.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import * as TP from '../lib/topics.js';
import { typeById } from '../lib/article-types.js';
import { stubIdeas } from './stub-ai.mjs';

const T = (id) => { const t = typeById(id); return { id: t.id, label: t.label, purpose: t.purpose, audience: t.audience, evidence: t.evidence }; };
const campaign = { id: 'c-reclaim', name: 'Reclaim Your Tech Power', goal: 'Book 15 IT assessments', targetAudience: 'Owners of small offices', keyMessage: 'You can run your own tech without fear.', cta: 'Book a free IT assessment',
  piecePlan: { summary: 'Teach owners to take back control, then invite an assessment.', items: [{ kind: 'blog-article', why: 'Answers what owners ask before they call.' }, { kind: 'social-post', why: 'Reach.' }] } };
const research = { version: 3, state: 'approved', core: 'You can run your own tech without fear.', positioning: 'The calm IT partner for small offices.', angle: 'Control, not complexity.', audience: 'Owners fear losing data.',
  pillars: ['Own your accounts', 'Backups you can trust'], blog: 'One practical fix per article.', deliverables: [{ deliverable: 'Blog article', angle: 'A checklist owners can use', purpose: 'Build trust' }], cta: 'Book a free IT assessment',
  facts: [{ fact: '43% of cyberattacks target small businesses.', attribution: 'Demo Security Report, 2026', url: 'https://example.com/r' }, { fact: 'Password reuse is common among office staff.', attribution: 'Demo Survey, 2026', url: 'https://example.com/s' }] };
const ctx = (o = {}) => ({ clientName: 'Lark IT', type: T('educational'), campaign, campaignText: 'Campaign: Reclaim Your Tech Power\nGoal: Book 15 IT assessments\nKey message: You can run your own tech without fear.', research,
  personas: ['Office managers', 'Small business owners'], personasText: '- Office managers\n- Small business owners', pillars: 'Security basics; Owning your accounts', kb: 'Lark IT is a managed IT firm in Portland for small offices.', voice: '', titles: [], ...o });
const answer = (ideas, note = '') => JSON.stringify({ ideas, note });
const good = (n, extra = {}) => ({ headline: 'Idea number ' + ['one', 'two', 'three', 'four', 'five', 'six', 'seven'][n] + ' about ' + ['passwords', 'backups', 'email', 'printers', 'laptops', 'vendors', 'wifi'][n], angle: 'A plain angle for an educational article.', why: 'Supports the key message.', basis: 'message', persona: '', facts: [], ...extra });
function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; }

test('the prompt reads the campaign, its strategy and piece plan, verified research, the type, pillars, personas and past titles', () => {
  const p = TP.buildPrompt(ctx({ titles: ['Five Signs Your Backups Are Failing'], voice: 'Short sentences. Friendly.' }));
  const u = p.messages[0].content;
  ['Reclaim Your Tech Power', 'Book 15 IT assessments', 'Positioning: The calm IT partner', 'Message pillars: Own your accounts | Backups you can trust', 'Guidance for blog articles: One practical fix', 'Planned articles:', 'Plan: Teach owners',
    'Answers what owners ask before they call', '[R1] 43% of cyberattacks target small businesses. (Demo Security Report, 2026)', 'ARTICLE TYPE: Educational Article', typeById('educational').purpose, '- Office managers', 'CONTENT PILLARS', 'Security basics',
    'ALREADY WRITTEN', 'Five Signs Your Backups Are Failing', 'THE COMPANY’S VOICE', 'Short sentences.'].forEach((x) => assert.ok(u.includes(x), 'prompt has ' + x));
  assert.ok(!u.includes('social-post') && !u.includes('Reach.'), 'only blog items of the piece plan');
  assert.match(p.system, /Never invent statistics/); assert.match(p.system, /ONLY if it is in VERIFIED RESEARCH/); assert.match(p.system, /Never write "scraped"/);
  assert.ok(!TP.buildPrompt(ctx({ voice: '' })).messages[0].content.includes('THE COMPANY’S VOICE'), 'the voice is optional');
});

test('generating ideas from a fixture campaign: 4 to 6 ideas with headline, angle, why and the persona when it is named', async () => {
  let calls = 0, body = null;
  const complete = async (b) => { calls++; body = b; return answer([good(0, { persona: 'office managers' }), good(1, { basis: 'fact', facts: ['R2'], why: 'Staff reuse passwords, so this fix matters.' }), good(2), good(3), good(4), good(5), good(6)]); };
  const r = await TP.ideasFor(ctx(), { complete, cache: TP.makeCache(memStore()), key: 'k1' });
  assert.strictEqual(calls, 1); assert.strictEqual(body.model, 'claude-haiku-4-5', 'one quick (Haiku) request');
  assert.strictEqual(r.state, 'ready'); assert.ok(r.ideas.length >= 4 && r.ideas.length <= 6, 'shows 4 to 6: ' + r.ideas.length);
  r.ideas.forEach((i) => assert.ok(i.headline && i.angle && i.why && i.id));
  assert.strictEqual(r.ideas[0].persona, 'Office managers', 'persona matched to the Brand Command name');
  assert.strictEqual(r.ideas[1].source, 'Demo Survey, 2026', 'a fact idea shows its source');
});

test('caching: the same client + campaign + type does not ask again; More adds, Refresh replaces; another type asks', async () => {
  let calls = 0; const store = memStore();
  const complete = async (b) => { calls++; return /ALREADY SUGGESTED/.test(b.messages[0].content) ? answer([good(5), good(6)]) : answer([good(0), good(1), good(2), good(3)]); };
  const key = TP.cacheKey('lark', 'c-reclaim', 'educational');
  const a = await TP.ideasFor(ctx(), { complete, cache: TP.makeCache(store), key });
  const b = await TP.ideasFor(ctx(), { complete, cache: TP.makeCache(store), key }); // a fresh page: read from storage
  assert.strictEqual(calls, 1); assert.ok(b.cached); assert.deepStrictEqual(b.ideas.map((i) => i.headline), a.ideas.map((i) => i.headline));
  const cache = TP.makeCache(store);
  const more = await TP.ideasFor(ctx(), { complete, cache, key, mode: 'more' });
  assert.strictEqual(calls, 2); assert.strictEqual(more.ideas.length, 6); assert.strictEqual(more.added, 2);
  assert.strictEqual(cache.get(key).ideas.length, 6, 'More is cached too');
  await TP.ideasFor(ctx(), { complete, cache, key, mode: 'refresh' }); assert.strictEqual(calls, 3); assert.strictEqual(cache.get(key).ideas.length, 4);
  await TP.ideasFor(ctx({ type: T('how-to') }), { complete, cache, key: TP.cacheKey('lark', 'c-reclaim', 'how-to') }); assert.strictEqual(calls, 4, 'each type has its own ideas');
  const old = TP.makeCache(store, undefined, { now: () => Date.now() + 15 * 86400000 }); assert.strictEqual(old.get(key), null, 'ideas older than two weeks are asked for again');
});

test('clicking an idea fills the Topic box, and Audience only when it is empty and the idea names a persona', () => {
  const idea = { id: 'x', headline: 'Own Your Accounts Before You Need Them', angle: 'Why the owner should hold every admin password.', persona: 'Small business owners' };
  assert.deepStrictEqual(TP.applyIdea(idea, { topic: 'old', aud: '' }), { topic: 'Own Your Accounts Before You Need Them. Why the owner should hold every admin password.', aud: 'Small business owners' });
  assert.strictEqual(TP.applyIdea(idea, { topic: '', aud: 'Dentists' }).aud, 'Dentists', 'a typed audience is kept');
  assert.strictEqual(TP.applyIdea({ ...idea, persona: '' }, { aud: '' }).aud, '', 'no persona, no audience');
  const app = fs.readFileSync(new URL('../app.logic.js', import.meta.url), 'utf8');
  assert.ok(app.includes('T.applyIdea(idea, { topic: st.topic, aud: st.aud })'), 'the page uses applyIdea');
});

test('no invented facts: figures must come from a cited verified fact; unknown fact ids and fact claims without a fact are dropped', () => {
  const r = TP.checkIdeas(answer([
    good(0, { headline: '43% of Cyberattacks Hit Small Offices: Are You Ready?', basis: 'fact', facts: ['R1'] }),
    good(1, { headline: 'Most Offices Lose $50,000 to Downtime', facts: [] }),
    good(2, { angle: 'Studies show 60 percent of owners skip backups.', facts: ['R1'] }),
    good(3, { basis: 'fact', facts: ['R9'] }),
    good(4, { basis: 'fact', facts: [] }),
    good(5, { headline: '5 Questions to Ask Your IT Vendor in 2026' }),
    good(6, { why: 'Half a million offices were hit last year.' }),
  ]), ctx());
  assert.deepStrictEqual(r.ideas.map((i) => i.headline), ['43% of Cyberattacks Hit Small Offices: Are You Ready?', '5 Questions to Ask Your IT Vendor in 2026']);
  assert.strictEqual(r.ideas[0].facts[0].fact, research.facts[0].fact, 'cites only the verified fact');
  assert.strictEqual(r.dropped.length, 5);
  // every figure in what is shown is in a verified fact the idea cites
  for (const i of r.ideas) for (const f of TP.claimFigures([i.headline, i.angle, i.why].join(' '))) assert.ok(i.facts.some((x) => x.fact.includes(f)), f);
  // the stub the page renders with: the made-up 80% idea never reaches the screen
  const s = TP.checkIdeas(JSON.stringify(stubIdeas('')), ctx({ personas: ['Pre-retirees', 'Business owners'], research: { version: 2, facts: [{ fact: 'Sample fact for the local preview only.', attribution: 'Demo Research Institute, 2026' }] } }));
  assert.ok(!s.ideas.some((i) => /80/.test(i.headline + i.angle)) && s.ideas.length === 6);
  assert.strictEqual(TP.claimFigures('Is your 401(k) ready?').length, 0, 'a plan name is not a figure');
});

test('plain words: no agent names, never "scraped", no spaced dashes; repeats of saved titles are dropped', () => {
  const r = TP.checkIdeas(answer([good(0, { why: 'The Strategist says it fits.' }), good(1, { angle: 'What we scraped from the web.' }), good(2, { headline: 'Backups You Trust — Every Night' }), good(3, { headline: 'Five Signs Your Backups Are Failing Now' })]), ctx({ titles: ['Five Signs Your Backups Are Failing'] }));
  assert.deepStrictEqual(r.ideas.map((i) => i.headline), ['Backups You Trust: Every Night']);
});

test('Company News: only real updates the campaign or Brand Command states; otherwise a plain note, never invented news', async () => {
  const news = ctx({ type: T('company-news') });
  const p = TP.buildPrompt(news); assert.match(p.system, /THIS ARTICLE TYPE IS COMPANY NEWS/); assert.match(p.system, /copy the words that state it into "evidence"/);
  const made = TP.checkIdeas(answer([{ headline: 'Lark IT Opens a Seattle Office', angle: 'A new office.', why: 'Growth.', basis: 'news', evidence: 'opens a Seattle office' }]), news);
  assert.strictEqual(made.ideas.length, 0); assert.match(made.note, /don’t mention any company news yet/); assert.match(made.note, /nothing real to announce/);
  const real = TP.checkIdeas(answer([{ headline: 'Lark IT Welcomes a New Security Lead', angle: 'Who she is and what changes for clients.', why: 'Real news from the campaign.', basis: 'news', evidence: 'Maya Chen joined as security lead in October' }]),
    ctx({ type: T('company-news'), campaignText: 'Campaign: Reclaim Your Tech Power\nAbout: Maya Chen joined as security lead in October.' }));
  assert.strictEqual(real.ideas.length, 1); assert.strictEqual(real.note, '');
  let calls = 0; const r = await TP.ideasFor(news, { complete: async () => { calls++; return JSON.stringify(stubIdeas('THIS ARTICLE TYPE IS COMPANY NEWS')); }, cache: TP.makeCache(memStore()), key: 'n' });
  assert.strictEqual(calls, 1); assert.strictEqual(r.ideas.length, 0); assert.match(r.note, /nothing real to announce/);
});

test('no campaign: no request, and the list says to pick a campaign at the top', async () => {
  let calls = 0; const r = await TP.ideasFor(ctx({ campaign: null }), { complete: async () => { calls++; return '{}'; } });
  assert.strictEqual(calls, 0); assert.strictEqual(r.state, 'no-campaign'); assert.strictEqual(r.note, 'Pick a campaign at the top to see topic ideas');
  const page = fs.readFileSync(new URL('../index.template.html', import.meta.url), 'utf8');
  assert.ok(page.includes('{{ ideasNoCampText }}') && page.includes('role="status" data-bb-ideas-status'));
});
