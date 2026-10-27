// Run: node --test tests/write-as.test.mjs
// Founder Intelligence, Phase 2 (Erika, Oct 27): the byline is chosen with the shared Write as picker (pilot-dash
// author-picker.js); a person approved for writing is written as (voiceOf: their profile id), and the choice survives saving.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { createRequire } from 'node:module';
globalThis.CosArticleModel = createRequire(import.meta.url)((process.env.COS_PILOT || '/home/claude/pilot-dash') + '/publishing/article-model.js');
const A = await import('../lib/article.js');

test('the author’s profile id survives a save and reopen', () => {
  const a = A.blankArticle({ typeId: 'blank', author: { name: 'Maren Oduya', title: 'Cofounder', personId: 'tm-maren' } });
  const back = A.fromModel(A.toModel(a, { clientId: 'c-lark' }));
  assert.deepStrictEqual(back.author, { name: 'Maren Oduya', title: 'Cofounder', personId: 'tm-maren' });
});
test('the writer gets voiceOf only for a chosen person, and the editor shows the shared picker', () => {
  const data = fs.readFileSync(new URL('../lib/data.js', import.meta.url), 'utf8');
  assert.ok(data.includes("...(author && author.personId ? { voiceOf: author.personId } : {})"));
  assert.ok(data.includes("...(article && article.author && article.author.personId ? { voiceOf: article.author.personId } : {})"));
  const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('data-cos-author-host="blog"') && page.includes("author-picker.js"));
});
