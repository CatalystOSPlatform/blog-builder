// node --test tests/team-links.test.mjs   (COS_PILOT = the pilot-dash checkout, default /home/claude/pilot-dash)
// "Why are titles wrong or missing and out of sync with Brand Command?" (Erika, Oct 28). The byline is linked to Brand
// Command › Team Member Profiles: an article saved with an old title opens with the team member's current title; after the
// team's title changes the byline follows; a title typed here (titleOverride) survives a save and reopen; an empty title in
// Brand Command means no title in the byline; the link (team id) is kept with the saved article. Fictional people only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const PILOT = process.env.COS_PILOT || '/home/claude/pilot-dash';
globalThis.CosArticleModel = createRequire(import.meta.url)(PILOT + '/publishing/article-model.js');
const A = await import('../lib/article.js');
const D = await import('../lib/data.js');
D.setTeamLink(await import(PILOT + '/team-link.js'));

const team = () => [{ id: 'tm-ada', name: 'Ada Quill', title: 'Founder and CEO' }, { id: 'tm-cy', name: 'Cy Ormond', title: '' }];
const saved = (author) => { const a = A.blankArticle({ typeId: 'blank', author }); a.title = 'A Plain Plan'; return A.toModel(a, { clientId: 'demo' }); };
const open = (m) => { const a = A.fromModel(m); a.author = D.linkAuthor(a.author); return a; };

test('a byline saved with an old title opens with the team member’s current title, and keeps the link', () => {
  D.__setRawForTests({ name: 'Fictional Co', team: team() });
  const a = open(saved({ name: 'Ada Quill', title: 'Strategy' }));
  assert.deepEqual([a.author.name, a.author.title, a.author.teamId], ['Ada Quill', 'Founder and CEO', 'tm-ada']);
  assert.match(A.articleHtml(a, {}), /By Ada Quill, Founder and CEO/);
  const back = A.fromModel(A.toModel(a, { clientId: 'demo' }));
  assert.equal(back.author.teamId, 'tm-ada', 'the team id is saved with the article');
});

test('after the team title changes the byline follows; a typed title survives; an empty title shows no title', () => {
  const T = team(); T[0].title = 'Chief Executive Officer'; D.__setRawForTests({ name: 'Fictional Co', team: T });
  assert.equal(open(saved({ name: 'Ada Quill', title: 'Founder and CEO', teamId: 'tm-ada' })).author.title, 'Chief Executive Officer');
  const typed = open(saved({ name: 'Ada Quill', title: 'Guest editor', teamId: 'tm-ada', titleOverride: true }));
  assert.equal(typed.author.title, 'Guest editor');
  const cy = open(saved({ name: 'Cy Ormond', title: 'Senior Executive' }));
  assert.equal(cy.author.title, '');
  assert.match(A.articleHtml(cy, {}), /By Cy Ormond<\/p>/);
  const guest = open(saved({ name: 'A Guest', title: 'Contributor' }));
  assert.equal(guest.author.title, 'Contributor', 'someone not on the team stays as saved');
});

test('the app links every article it opens, and the author picker stores the team id', () => {
  const logic = fs.readFileSync(new URL('../app.logic.js', import.meta.url), 'utf8');
  assert.ok(/const art = this\.live\(this\.A\.fromModel\(open\)\)/.test(logic), 'deep link');
  assert.ok(/const a = this\.live\(A\.fromModel\(m\)\)/.test(logic), 'opened from the list');
  assert.ok(/art: this\.live\(x\.art\)/.test(logic), 'restored');
  assert.ok(/setAuthor = [^\n]*teamId: m\.id/.test(logic), 'picked author keeps the link');
  const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('this.live(this.A.fromModel(open))'), 'index.html is built from app.logic.js');
});
