// node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import * as T from '../lib/article-types.js';

const SPEC_TYPES = ['Thought Leadership', 'Educational Article', 'How-To Guide', 'Industry Analysis', 'Case Study Article', 'Research Article', 'Product Announcement', 'Company News', 'Comparison Article', 'Expert Interview', 'List Article', 'Event Recap', 'FAQ Article', 'Content Series Article'];
test('the 14 article types of spec §3, each with every field the writer and the brief read', () => {
  assert.deepStrictEqual(T.ARTICLE_TYPES.map((t) => t.label), SPEC_TYPES);
  for (const t of T.ARTICLE_TYPES) {
    for (const k of ['purpose', 'audience', 'hierarchy', 'evidence', 'cta', 'visuals', 'seo', 'compliance']) assert.ok(String(t[k] || '').length > 10, t.id + ' ' + k);
    assert.ok(t.words[0] > 0 && t.words[1] > t.words[0], t.id + ' words');
    assert.ok(t.sections.length >= 3 && t.sections.every((s) => s.key && s.heading && s.what), t.id + ' sections');
    assert.ok(T.categoryById(t.category), t.id + ' category');
    assert.ok(['blog', 'news', 'how-to', 'thought-leadership', 'case-study', 'listicle', 'announcement', 'interview', 'other'].includes(t.articleType), t.id + ' model type');
    assert.ok(new Set(t.sections.map((s) => s.key)).size === t.sections.length, t.id + ' unique keys');
  }
});
test('Blank first is separate; outlines carry each section’s guidance and get fresh ids', () => {
  assert.strictEqual(T.typeById('blank').label, 'Blank Article');
  const a = T.outlineFor('how-to'), b = T.outlineFor('how-to');
  assert.strictEqual(a[0].heading, 'What You Will Do'); assert.ok(a.every((s) => s.body === '' && s.what && !s.approved));
  assert.notStrictEqual(a[0].id, b[0].id);
});
test('recommendations follow the taxonomy industry and always include the types for everyone', () => {
  const fin = T.recommendFor('finance').map((t) => t.id);
  assert.ok(fin.includes('educational') && fin.includes('thought-leadership') && fin.includes('company-news') && fin.length <= 6);
  const tech = T.recommendFor('technology').map((t) => t.id); assert.ok(tech.includes('how-to'));
  assert.deepStrictEqual(T.recommendFor('').map((t) => t.id), ['thought-leadership', 'company-news']);
});
test('shapeText gives the Writer the type’s sections, hierarchy, length, evidence, CTA and compliance', () => {
  const s = T.shapeText('case-study');
  ['Case Study Article', '1. At a Glance', 'Heading hierarchy:', 'Length: 700–1300', 'Evidence:', 'Call to action:', 'Compliance:', '(optional'].forEach((x) => assert.ok(s.includes(x), x));
});
