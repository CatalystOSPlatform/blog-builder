// Run: node --test tests/write-as.test.mjs   (COS_PILOT = the pilot-dash checkout, default /home/claude/pilot-dash)
// Who an article is from (Erika, Oct 29: "change the blog so it's from a founder or the company voice"). The byline and the
// voice are one choice (lib/author.js): the company voice (no byline, no personId) or a person in Brand Command → Founders &
// Leadership, written as (voiceOf) only when approved for writing. Stubbed AI and fixture people: one approved, one not.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
globalThis.CosArticleModel = createRequire(import.meta.url)((process.env.COS_PILOT || '/home/claude/pilot-dash') + '/publishing/article-model.js');
const A = await import('../lib/article.js');
const AU = await import('../lib/author.js');
const D = await import('../lib/data.js');

const PEOPLE = [
  { id: 'p-maren', name: 'Maren Oduya', title: 'Cofounder', photoUrl: 'https://example.com/maren.jpg', approved: true, hasVoice: true, reason: '' },
  { id: 'p-hans', name: 'Hal Brenner', title: 'Founder and CEO', photoUrl: '', approved: false, hasVoice: true, reason: 'Not approved for writing yet' },
];
// A stand-in for the shared Senior Writer (Brand.write): records what it was asked and returns a fixed article.
function spyWriter() {
  const calls = [];
  const md = ['# The Same Plan, A New Voice', '', 'An opening in the new voice.', '', '## Why It Matters', 'Rewritten words.', '', '## What To Do', 'More rewritten words.', '', '## Conclusion', 'A close.', '', '## Call to Action', 'Talk to us.', 'Button: Book a Call'].join('\n');
  return { calls, write: async (cid, app, opts) => { calls.push(opts); return { text: md, flags: [], supportedPct: null }; } };
}
function draft(author) {
  const a = A.blankArticle({ typeId: 'blank', author, sections: [
    { id: 's1', key: '', heading: 'Why It Matters', level: 2, body: 'The first words, from the company.', what: '', required: false, kind: '', approved: true, by: 'agent' },
    { id: 's2', key: '', heading: 'What To Do', level: 2, body: 'Three steps the person wrote themselves.', what: '', required: false, kind: '', approved: false, by: 'person' }] });
  a.title = 'A Plain Plan'; a.intro = 'Hello.'; a.sources = [{ title: 'A verified report', url: 'https://example.com/r', publisher: 'Example' }];
  a.brief = { topic: 'Plans', outline: ['Why It Matters', 'What To Do'], research: [], author: AU.briefAuthor(author) };
  return a;
}

test('choosing on the start screen: the company voice by default, a person gives their byline and personId', () => {
  assert.deepEqual(AU.authorFor(AU.COMPANY, PEOPLE), { name: '', title: '' });
  assert.deepEqual(AU.authorFor('p-maren', PEOPLE), { name: 'Maren Oduya', title: 'Cofounder', personId: 'p-maren' });
  assert.equal(AU.pickOf({ name: '', title: '' }), 'company');
  assert.equal(AU.pickOf(AU.authorFor('p-hans', PEOPLE)), 'p-hans', 'a person who is not ready can still be picked');
  assert.deepEqual(AU.briefAuthor(AU.authorFor('p-maren', PEOPLE)), { kind: 'person', personId: 'p-maren', name: 'Maren Oduya', title: 'Cofounder' }, 'the brief records the author');
  assert.deepEqual(AU.statusOf(PEOPLE[0]), { ready: true, label: 'Ready', reason: '' });
  assert.deepEqual(AU.statusOf(PEOPLE[1]), { ready: false, label: 'Voice not ready yet', reason: 'Not approved for writing yet' });
  assert.equal(AU.statusOf({ name: 'X', approved: false, hasVoice: false }).reason, 'No voice profile yet');
  const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('<legend>Who is this from?</legend>') && page.includes('type="radio" name="bb-from"'), 'a labelled radio group on the start screen');
  assert.ok(page.indexOf('How do you want to start?') < page.indexOf('<legend>Who is this from?') && page.indexOf('<legend>Who is this from?') < page.indexOf('data-bb-topic'), 'right under How do you want to start?, before the brief');
  assert.ok(!page.includes('author-picker.js') && !page.includes('window.confirm'), 'one list everywhere, asked in-page');
});

test('a person who is not ready blocks Create (and the writer) with the reason; I’ll Make This Myself still sets the byline', async () => {
  const hal = AU.authorFor('p-hans', PEOPLE);
  assert.equal(AU.blockReason(hal, PEOPLE), 'Not approved for writing yet');
  assert.equal(AU.blockReason(AU.authorFor('p-maren', PEOPLE), PEOPLE), '');
  assert.equal(AU.blockReason({ name: '', title: '' }, PEOPLE), '');
  assert.equal(AU.blockReason({ name: 'A Guest', title: '' }, PEOPLE), 'Not in Founders & Leadership yet', 'a byline with no voice behind it is never written');
  assert.match(AU.notReadyNote(PEOPLE[1], 'Not approved for writing yet'), /^Hal Brenner: Not approved for writing yet\. You can still make this yourself with Hal’s byline\./);
  assert.equal(AU.profileUrl({ base: 'https://dash/', clientId: 'c-cf', orgId: 'o1', personId: 'p-hans' }), 'https://dash/Brand%20Command%20Center.dc.html?org=o1&client=c-cf#founders=p-hans');
  // the data layer refuses too, before the shared writer is asked
  D.__setAuthorsForTests(PEOPLE, 'c-test'); const W = spyWriter(); D.__setBrandForTests(W);
  await assert.rejects(D.writeArticle({ article: draft(hal), brief: null, campaign: null }), (e) => e.code === 'author-not-approved' && /can’t write as Hal Brenner yet: Not approved for writing yet/.test(e.userMessage));
  await assert.rejects(D.writeField({ article: draft(hal), label: 'Headline' }), /Not approved for writing yet/);
  assert.equal(W.calls.length, 0, 'nothing was written as them');
  const app = fs.readFileSync(new URL('../app.logic.js', import.meta.url), 'utf8');
  assert.ok(app.includes('vals.createOff = !!st.busy || !!why;') && app.includes("createBrief = async () => { const x = this.startCtx(); if (this.authorBlock(x.author)) return;"), 'Create is off, with the reason shown');
  assert.ok(/makeMyself = \(\) => \{[\s\S]*?author: \{ \.\.\.x\.author \}/.test(app), 'I’ll Make This Myself keeps the byline');
  assert.ok(app.includes('&& !this.authorBlock(),'), 'the floating Let CatalystOS Create This is off too');
});

test('a byline-only change keeps every word and calls no writer', () => {
  const a = draft({ name: '', title: '' }); const W = spyWriter(); D.__setBrandForTests(W);
  const b = AU.withAuthor(a, AU.authorFor('p-hans', PEOPLE));
  assert.deepEqual(b.author, { name: 'Hal Brenner', title: 'Founder and CEO', personId: 'p-hans' });
  assert.equal(b.brief.author.personId, 'p-hans', 'the brief follows');
  const words = (x) => A.articleText(x).split('\n').filter((l) => l.trim() && !/^By /.test(l)).join('\n');
  assert.equal(words(b), words(a), 'the text is unchanged');
  assert.match(A.articleHtml(b, {}), /By Hal Brenner, Founder and CEO/);
  assert.equal(W.calls.length, 0);
  assert.ok(AU.hasText(a) && !AU.hasText(A.blankArticle({})), 'a draft with text asks first; an empty one just changes');
});

test('Rewrite All calls the writer with the new voiceOf, keeps the outline, facts, sources and edits, and keeps the old version', async () => {
  D.__setAuthorsForTests(PEOPLE, 'c-test'); const W = spyWriter(); D.__setBrandForTests(W);
  const a = draft({ name: '', title: '' }); const before = A.articleText(a);
  const plan = AU.rewritePlan(a, AU.authorFor('p-maren', PEOPLE), 1000);
  assert.equal(plan.title, 'Rewriting in Maren Oduya’s voice'); assert.equal(AU.workingTitle({ name: '', title: '' }), 'Rewriting in the company voice');
  assert.equal(plan.article.versions.length, 1); assert.equal(plan.article.versions[0].label, 'Before rewriting in Maren Oduya’s voice');
  assert.deepEqual(plan.article.versions[0].author, { name: '', title: '' });
  await D.writeArticle({ article: plan.article, brief: plan.article.brief, campaign: null, guidance: plan.guidance });
  assert.equal(W.calls.length, 1); const o = W.calls[0];
  assert.equal(o.voiceOf, 'p-maren', 'written as the new person');
  assert.match(o.task, /Byline: Maren Oduya, Cofounder \(written as them/);
  assert.match(o.task, /Keep the same outline[\s\S]*same facts, the same sources/);
  assert.match(o.task, /edited these sections themselves[^\n]*“What To Do”/);
  assert.match(o.task, /Three steps the person wrote themselves\./, 'the person’s edits are guidance');
  assert.match(o.task, /1\. Why It Matters[\s\S]*2\. What To Do/, 'the outline is kept');
  // the old version survives a save and reopen, and switching back gives back the words and the company voice
  const back = A.fromModel(A.toModel(plan.article, { clientId: 'c-test' }));
  assert.equal(back.versions.length, 1); assert.equal(back.author.personId, 'p-maren');
  const rewritten = { ...back, intro: 'An opening in the new voice.' };
  const old = AU.restoreVersion(rewritten, back.versions[0].id, 2000);
  assert.equal(A.articleText(old), before); assert.deepEqual(old.author, { name: '', title: '' }); assert.equal(old.brief.author.kind, 'company');
  assert.equal(old.versions[0].label, 'Before switching back'); assert.equal(old.versions[0].intro, 'An opening in the new voice.', 'switching is never a loss');
  assert.ok(AU.pushVersion(AU.pushVersion(AU.pushVersion(AU.pushVersion(AU.pushVersion(AU.pushVersion(a, '1'), '2'), '3'), '4'), '5'), '6').versions.length === AU.MAX_VERSIONS);
  const app = fs.readFileSync(new URL('../app.logic.js', import.meta.url), 'utf8');
  assert.ok(app.includes('await this.writeArticle(plan.article, { stage: plan.title, guidance: plan.guidance });'), 'progress only in the CatalystOS popup, titled for the voice');
});

test('the company voice clears personId: no byline, no voiceOf', async () => {
  D.__setAuthorsForTests(PEOPLE, 'c-test'); const W = spyWriter(); D.__setBrandForTests(W);
  const a = AU.withAuthor(draft(AU.authorFor('p-maren', PEOPLE)), AU.authorFor(AU.COMPANY, PEOPLE));
  assert.equal(a.author.personId, undefined); assert.equal(a.author.name, ''); assert.deepEqual(a.brief.author, { kind: 'company' });
  assert.equal(A.toModel(a, { clientId: 'c' }).editorial.author.id, '', 'saved with no person');
  assert.doesNotMatch(A.articleHtml(a, {}), /class="byline"/);
  await D.writeArticle({ article: a, brief: a.brief, campaign: null });
  assert.equal('voiceOf' in W.calls[0], false); assert.match(W.calls[0].task, /No personal byline: write in the company voice\./);
});

test('an old article with a founder’s byline is linked to them, so its byline and voice match', () => {
  assert.deepEqual(AU.reconcile({ name: 'Maren Oduya', title: 'Cofounder' }, PEOPLE), { name: 'Maren Oduya', title: 'Cofounder', personId: 'p-maren' });
  const co = { name: '', title: '' }; assert.equal(AU.reconcile(co, PEOPLE), co);
  assert.equal(AU.reconcile({ name: 'Hal Brenner', title: '' }, PEOPLE).personId, 'p-hans', 'linked, and blocked until approved');
});

test('the brief uses the person’s approved perspectives, facts and topics as client content', async () => {
  const seen = []; const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { seen.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ text: JSON.stringify({ workingTitle: 'Plans', clientContent: 'Fee-only planning.', outline: ['One', 'Two'] }) }) }; };
  try {
    const k = { perspectives: ['Write the plan down.'], facts: ['Founded the studio in 2011.'], topics: ['Retirement income'] };
    const b = await D.draftBrief({ typeId: 'blank', topic: 'Plans', campaign: null, research: null, start: 'topic', author: AU.authorFor('p-maren', PEOPLE), knowledge: k });
    assert.match(b.clientContent, /^From Maren Oduya’s approved profile \(Founders & Leadership\):\nTheir perspectives:\n- Write the plan down\.\nFacts about them:\n- Founded the studio in 2011\.\nTopics they speak on:\n- Retirement income\n\nFee-only planning\.$/);
    assert.deepEqual(b.author, { kind: 'person', personId: 'p-maren', name: 'Maren Oduya', title: 'Cofounder' });
    assert.match(seen[0].messages[0].content, /THIS ARTICLE IS FROM Maren Oduya, Cofounder, with their byline, written as them/);
    const c = await D.draftBrief({ typeId: 'blank', topic: 'Plans', campaign: null, research: null, start: 'topic', author: { name: '', title: '' } });
    assert.deepEqual(c.author, { kind: 'company' }); assert.equal(c.clientContent, 'Fee-only planning.');
    assert.match(seen[1].messages[0].content, /THIS ARTICLE IS IN THE COMPANY VOICE/);
  } finally { globalThis.fetch = realFetch; }
});

test('the author’s profile id and versions survive a save and reopen', () => {
  const a = A.blankArticle({ typeId: 'blank', author: { name: 'Maren Oduya', title: 'Cofounder', personId: 'tm-maren' } });
  const back = A.fromModel(A.toModel(a, { clientId: 'c-lark' }));
  assert.deepEqual(back.author, { name: 'Maren Oduya', title: 'Cofounder', personId: 'tm-maren' });
  assert.equal(back.versions, undefined, 'no versions until there is one');
});
