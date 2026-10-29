// Run: node --test tests/voice.test.mjs
// Oct 29 ("Dial in the voice"): the article type shapes only the outline; the client's voice sets the tone and register.
// Proof only where the type calls for it. The byline from the team list keeps personId in step with the person picked;
// approving teaches the byline person's voice; the production check reads the founder's approved knowledge.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
const T = await import('../lib/article-types.js');

test('every type’s shape says the voice sets the register and headings are worded in the client’s voice', () => {
  for (const t of [...T.ARTICLE_TYPES, T.BLANK]) {
    const s = T.shapeText(t.id);
    assert.match(s, /The type shapes only the outline below\. The client’s voice \(THE COMPANY’S VOICE, or the person’s when writing as them\) sets the tone, register/);
    assert.match(s, /word each H2 heading the way the client would/); assert.doesNotMatch(s, /exactly as given/);
  }
  assert.doesNotMatch(JSON.stringify(T.ARTICLE_TYPES), /press-release clarity|analytical step/, 'no type forces a report register');
});
test('the writing rules: voice first; testimonials and proof only where the type or brief calls for them', () => {
  const data = fs.readFileSync(new URL('../lib/data.js', import.meta.url), 'utf8');
  assert.ok(data.includes('The client’s voice sets the tone and register; the article type only shapes the outline. Testimonials, client quotes and results go in only where the article type or brief calls for them, never dropped into the middle of the article.'));
});
test('personIdFor: an approved founder by name, or none; the byline is never chosen apart from the voice', async () => {
  const src = fs.readFileSync(new URL('../lib/data.js', import.meta.url), 'utf8');
  const body = src.match(/export function personIdFor\(member, authors = AUTHORS\) \{([\s\S]*?)\n\}/)[1];
  const personIdFor = new Function('member', 'authors', body);
  const authors = [{ id: 'tm-maren', name: 'Maren Oduya', approved: true }, { id: 'tm-priya', name: 'Priya Castellan', approved: false }];
  assert.strictEqual(personIdFor({ name: 'Maren Oduya' }, authors), 'tm-maren');
  assert.strictEqual(personIdFor({ name: 'Priya Castellan' }, authors), '', 'not approved for writing: the company voice');
  assert.strictEqual(personIdFor({ name: 'Tobias Wren' }, authors), '');
  const app = fs.readFileSync(new URL('../app.logic.js', import.meta.url), 'utf8');
  assert.ok(!/defaultAuthor|setAuthor/.test(app), 'no byline is chosen apart from the voice (lib/author.js authorFor is the one way)');
  assert.ok(app.includes("this.D.learnApproved(this._draft || '', this.A.articleText(a), (a.author && a.author.personId) || '')"));
  assert.ok(app.includes("this.D.learnApproved(this._draft || '', this.A.articleText(x), (x.author && x.author.personId) || '')"), 'approving one section teaches the same voice');
  assert.ok(src.includes("...(voiceOf ? { voiceOf } : {})"));
});
test('the production check reads the byline person’s approved knowledge', () => {
  const src = fs.readFileSync(new URL('../lib/data.js', import.meta.url), 'utf8');
  assert.ok(src.includes("export function sourceText(article, founderKnowledge = '')") && src.includes('return [kb(), founderKnowledge, b.clientContent,'));
  assert.ok(src.includes("const P = await FVm.prepare({ clientId: S.clientId, voiceOf: pid }); fk = (P && P.factsBlock) || '';") && src.includes('sourceText: sourceText(article, fk)'));
});
