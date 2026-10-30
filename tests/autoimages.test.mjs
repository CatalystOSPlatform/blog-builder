// Images chosen automatically when an article is written (lib/autoimages.js), with the shared Brand Command photo pool.
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
const PILOT = process.env.COS_PILOT || '/home/claude/pilot-dash';
createRequire(import.meta.url)(PILOT + '/brand-photos.js');
const BP = globalThis.CosBrandPhotos;
const AI = await import('../lib/autoimages.js');
const FG = await import('../lib/figures.js');

const article = () => ({ title: 'Why a Written Income Plan Calms Retirement Decisions', subtitle: 'Retirement income, planned', intro: 'Retirement changes the question. A written income plan helps.', image: null, figures: [], brief: { topic: 'retirement income plan' },
  sections: [{ id: 's1', heading: 'What a Written Plan Covers', body: 'Spending, income and withdrawals.\n\nMore.' }, { id: 's2', heading: 'Meet Your Planner', body: 'Claire Holloway reviews each plan with you.\n\nShe explains each step.' }, { id: 's3', heading: 'Market Outlook', body: 'Rates change.' }], conclusion: 'Write it down.' });
const IMGS = [
  { id: 'i1', url: 'https://img.example/retire.jpg', category: 'Lifestyle', caption: 'A couple reviews their retirement income plan', alt: 'A couple at a kitchen table reviewing a retirement plan', tags: ['retirement', 'planning'], width: 1600, height: 900 },
  { id: 'i2', url: 'https://img.example/claire.jpg', category: 'Team', person: 'Claire Holloway', alt: 'Claire Holloway, founder', caption: 'Claire Holloway', tags: { people: true }, width: 800, height: 1000 },
  { id: 'i3', url: 'https://img.example/theo.jpg', category: 'Team', person: 'Theo Marsh', alt: 'Theo Marsh', tags: { people: true }, width: 800, height: 1000 },
  { id: 'i4', url: 'https://img.example/ai-people.jpg', category: 'Generated', generated: true, alt: 'Smiling retirees planning income', tags: { people: true, ai: true } },
  { id: 'i5', url: 'https://img.example/sponsor.jpg', category: 'Events', caption: 'Retirement income plan workshop with the Acme Bank logo', alt: 'Workshop stage', companies: ['Acme Bank'] },
  { id: 'i6', url: 'https://img.example/found.jpg', category: 'From Website', found: true, rights: 'client', sourcePage: 'https://example.com/retirement-income-planning', caption: 'Retirement income planning session', alt: 'Planner with clients' },
  { id: 'i7', url: 'https://img.example/plan-desk.jpg', category: 'Office', caption: 'A written plan covers spending, income and withdrawals', alt: 'Printed plan on a desk', tags: ['plan', 'spending'] },
];
const pool = () => BP.pool({ brandImages: IMGS, team: [] });

test('approved Brand Command photos are placed: a lead image and inline images where they fit, marked automatic', () => {
  const r = AI.choose(article(), { pool: pool(), raw: IMGS, clientName: 'Harbor Point Wealth' });
  assert.ok(r.lead); assert.strictEqual(r.lead.src, 'https://img.example/retire.jpg'); assert.strictEqual(r.lead.caption, 'A couple reviews their retirement income plan');
  const srcs = r.inline.map((f) => [f.src, f.at.where]);
  assert.ok(srcs.some(([s, w]) => s === 'https://img.example/claire.jpg' && w === 's2'), 'a named person only beside text about them: ' + JSON.stringify(srcs));
  assert.ok(!srcs.some(([s]) => /theo|ai-people|sponsor|found/.test(s)), 'never: another person, a generated person, another company’s logo, a Found picture');
  assert.ok(r.inline.length <= 2 && r.inline.every((f) => f.auto && f.at.after === 1));
  assert.deepStrictEqual(r.suggested.map((x) => x.sourcePage), ['https://example.com/retirement-income-planning'], 'website pictures waiting for approval are only suggested');
  const out = AI.apply({ ...article(), figures: [FG.newFigure({ id: 'mine', src: 'https://x/y.png', alt: 'mine', at: { where: 's1', after: 0 } }), FG.newFigure({ id: 'old', auto: true, src: 'https://x/old.png', at: { where: 's1', after: 1 } })] }, r);
  assert.ok(out.image.auto); assert.ok(out.figures.some((f) => f.id === 'mine')); assert.ok(!out.figures.some((f) => f.id === 'old'), 'earlier automatic picks are replaced, the person’s own kept');
  assert.match(out.autoImages.note, /Chosen automatically/);
  assert.ok(out.figures.every((f) => f.id && f.at && f.auto !== undefined || f.id === 'mine'), 'placed figures are full figures with ids');
});
test('an article about the company in the picture may use its logo photo; nothing fits → nothing placed, and the note says so', () => {
  const a = { ...article(), title: 'Our Retirement Income Plan Workshop With Acme Bank', intro: 'Acme Bank hosted our retirement income plan workshop.' };
  const only = [{ ...IMGS[4], caption: 'Retirement income plan workshop stage' }], sp = [{ id: 'i5', src: IMGS[4].url, words: 'workshop', people: false, ai: false, alt: 'Workshop stage' }]; // (the shared pool already drops pictures it reads as logos)
  assert.strictEqual((AI.choose(a, { pool: sp, raw: only, clientName: 'Harbor Point Wealth' }).lead || {}).src, 'https://img.example/sponsor.jpg', 'allowed when the article is about that company');
  assert.strictEqual(AI.choose(article(), { pool: sp, raw: only, clientName: 'Harbor Point Wealth' }).lead, null, 'not otherwise');
  const none = AI.choose({ title: 'Quarterly Bond Ladder Mechanics', intro: 'Duration and convexity.', sections: [{ id: 'x', heading: 'Convexity', body: 'Math.' }], figures: [] }, { pool: pool(), raw: IMGS });
  assert.strictEqual(none.lead, null); assert.strictEqual(none.inline.length, 0); assert.strictEqual(none.note, 'No matching images found. Add one.');
  assert.strictEqual(AI.choose(article(), { pool: [], raw: [] }).note, AI.NONE_NOTE);
});
