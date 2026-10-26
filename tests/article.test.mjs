// node --test tests/*.test.mjs   (uses pilot-dash publishing/article-model.js; COS_PILOT = the checkout)
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
const PILOT = process.env.COS_PILOT || '/home/claude/pilot-dash';
globalThis.CosArticleModel = createRequire(import.meta.url)(PILOT + '/publishing/article-model.js');
const A = await import('../lib/article.js');
const T = await import('../lib/article-types.js');

const MD = '# Why a Written Plan Helps\n_A calmer retirement_\n\nWhen paychecks stop, choices appear.\n\n## The Basics\n- Know your spending\n- List your income\n\n## How It Works\nMost spend 80% of income [Source needed]. See [the report](https://example.com/r).\n\n### A Detail\n> Note: plans change.\n\n## Conclusion\nWrite it down.\n\n## Call to Action\nTalk to a planner.\nButton: Book a Review\n\n## Sources\n- Demo report — https://example.com/r\n';
function sample() {
  const outline = T.outlineFor('educational').slice(0, 2).map((s, i) => ({ ...s, heading: ['The Basics', 'How It Works'][i] }));
  const d = A.parseDraft(MD, outline);
  const a = A.blankArticle({ typeId: 'educational', sections: d.sections, brief: { topic: 'Income plans', approved: true }, campaignId: 'c1', campaignName: 'Q4', start: 'campaign' });
  return Object.assign(a, { title: d.title, subtitle: d.subtitle, intro: d.intro, conclusion: d.conclusion, cta: { ...d.cta, url: 'https://example.com/book' }, sources: d.sources, image: { src: 'https://example.com/i.jpg', alt: 'A planner at a desk', altReview: false }, author: { name: 'Claire Holloway', title: 'Founder' } });
}
test('parseDraft: headline, dek, intro, sections and subsections, conclusion, CTA label (no invented URL), sources', () => {
  const a = sample();
  assert.strictEqual(a.title, 'Why a Written Plan Helps'); assert.strictEqual(a.subtitle, 'A calmer retirement'); assert.strictEqual(a.intro, 'When paychecks stop, choices appear.');
  assert.deepStrictEqual(a.sections.map((s) => [s.heading, s.level]), [['The Basics', 2], ['How It Works', 2], ['A Detail', 3]]);
  assert.strictEqual(a.sections[0].key, 'intro', 'matched outline sections keep their guidance');
  assert.strictEqual(a.conclusion, 'Write it down.'); assert.strictEqual(a.cta.label, 'Book a Review');
  assert.deepStrictEqual(A.parseDraft(MD).cta.url, '');
  assert.deepStrictEqual(a.sources, [{ title: 'Demo report', url: 'https://example.com/r', publisher: '' }]);
});
test('save/open round trip: toModel is a valid article model and fromModel gives the same article back', () => {
  const a = sample(); a.sections[0].approved = true; a.seo = { ...a.seo, ...A.seoDefaults(a, CosArticleModel.slugify) };
  const m = A.toModel(a, { clientId: 'demo' });
  const v = CosArticleModel.validate(m, { purpose: 'draft' }); assert.ok(v.ok, JSON.stringify(v.errors));
  assert.strictEqual(m.templateId, 'educational'); assert.strictEqual(m.campaignId, 'c1'); assert.strictEqual(m.seo.slug, 'why-a-written-plan-helps');
  assert.deepStrictEqual(m.headingHierarchy.map((h) => h.level), [2, 2, 3]);
  assert.ok(m.blocks.some((b) => b.type === 'list') && m.blocks.some((b) => b.type === 'callout'));
  assert.ok(m.links.some((l) => l.href === 'https://example.com/r'));
  const back = A.fromModel(JSON.parse(JSON.stringify(m)));
  for (const k of ['id', 'typeId', 'title', 'subtitle', 'intro', 'conclusion', 'campaignId', 'campaignName', 'start']) assert.deepStrictEqual(back[k], a[k], k);
  assert.deepStrictEqual(back.sections, a.sections); assert.deepStrictEqual(back.cta, a.cta); assert.deepStrictEqual(back.sources, a.sources);
  assert.deepStrictEqual(back.image, a.image); assert.deepStrictEqual(back.brief, a.brief); assert.deepStrictEqual(back.author, a.author);
  assert.strictEqual(A.toModel(back, { clientId: 'demo' }).blocks.length, m.blocks.length, 'stable');
});
test('approval: editorial approval only when every section is approved; never a publication state', () => {
  const a = sample(); assert.strictEqual(A.toModel(a, { clientId: 'd' }).editorial.editorialApproval.status, 'not_requested');
  a.sections.forEach((s) => { s.approved = true; }); a.approvals = [{ at: Date.now(), by: 'x@y.z', on: true }];
  const m = A.toModel(a, { clientId: 'd' }); assert.strictEqual(m.editorial.editorialApproval.status, 'approved'); assert.strictEqual(m.editorial.state, 'approved'); assert.strictEqual(m.publishing.state, 'not_synced');
});
test('claims that need a source: the Writer’s markers and figures no source states', () => {
  const a = sample(); const f = A.sourceFlags(a, 'nothing');
  assert.ok(f.some((x) => x.where === 'How It Works' && /80%/.test(x.text) && !/\[Source needed\]/.test(x.text)));
  a.sections[0].body = 'We serve 120 families.'; assert.ok(A.sourceFlags(a, 'nothing').some((x) => /120/.test(x.why)));
  assert.ok(!A.sourceFlags(a, 'we serve 120 families').some((x) => /120/.test(x.why)), 'a figure in Brand Command is fine');
});
test('downloads: accessible HTML in the brand fonts, Word, Markdown and plain text', () => {
  const a = sample(); const h = A.articleHtml(a, { head: 'Lora', body: 'Inter', accent: '#0B3D5C' });
  ['<html lang="en">', '<h1>Why a Written Plan Helps</h1>', "'Lora'", 'alt="A planner at a desk"', '<h3>A Detail</h3>', '<ul><li>', 'href="https://example.com/book"', '<mark class="need">'].forEach((x) => assert.ok(h.includes(x), x));
  assert.ok(!/<script/i.test(A.articleHtml({ ...a, title: '<script>x</script>' })), 'escaped');
  assert.ok(A.articleWord(a).includes('urn:schemas-microsoft-com:office:word'));
  const md = A.articleMarkdown(a); assert.ok(md.startsWith('# Why a Written Plan Helps') && md.includes('### A Detail') && md.includes('[Book a Review](https://example.com/book)'));
  const t = A.articleText(a); assert.ok(!/^#/m.test(t) && t.includes('the report (https://example.com/r)'));
});
test('production review content object: one section per article part, approved ones marked kept', () => {
  const a = sample(); a.sections[1].approved = true; const c = A.contentObject(a);
  assert.deepStrictEqual(c.sections.map((s) => s.title), ['Introduction', 'The Basics', 'How It Works', 'A Detail', 'Conclusion', 'Call to action']);
  assert.strictEqual(c.sections[2].status, 'kept');
});
