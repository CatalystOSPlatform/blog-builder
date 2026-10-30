// Download Article and images/charts in the article: lib/export.js and lib/figures.js (Node; no browser).
// JSZip: COS_JSZIP, else pilot-dash vendor/jszip.min.js. Word files are also opened with python-docx when it is installed.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const PILOT = process.env.COS_PILOT || '/home/claude/pilot-dash';
const require = createRequire(import.meta.url);
globalThis.CosArticleModel = require(PILOT + '/publishing/article-model.js');
const JSZip = require(process.env.COS_JSZIP || PILOT + '/vendor/jszip.min.js');
const A = await import('../lib/article.js');
const X = await import('../lib/export.js');
const FG = await import('../lib/figures.js');
const C = await import(PILOT + '/designer-charts.js');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8DwnwEIGAEACf0B/0SXrb4AAAAASUVORK5CYII=', 'base64');
function sample() {
  const a = A.blankArticle({ typeId: 'educational', author: { name: 'Claire Holloway', title: 'Founder' }, brief: { workingTitle: 'Income Plans: Why Writing It Down Helps!', objective: 'Explain the value of a written plan', topic: 'x', compliance: ['Never promise returns'], approved: true } });
  Object.assign(a, { title: 'Why a Written Plan Helps', subtitle: 'A calmer retirement', intro: 'When paychecks stop, choices appear.\n\nA plan makes them easier.',
    sections: [{ id: 's1', heading: 'The Basics', level: 2, body: 'Know your numbers.\n\n- Spending\n- Income' }, { id: 's2', heading: 'A Detail', level: 3, body: 'Most spend 80% of income [Source needed]. See [the report](https://example.com/r).' }],
    conclusion: 'Write it down.', cta: { text: 'Talk to us.', label: 'Book a Review', url: 'https://example.com/book' }, sources: [{ title: 'Demo report', url: 'https://example.com/r', publisher: 'Demo' }],
    seo: { title: 'Written Plan', metaDescription: 'Why writing a plan helps.', slug: 'written-plan' }, review: { check: { issues: [{ text: 'Compliance: review needed' }] } } });
  const chk = FG.checkChart({ type: 'bar', title: 'Clients by year', unit: 'clients', labels: ['2023', '2024'], series: [{ name: 'Clients', values: ['120', '1,450'] }] });
  a.figures = [FG.newFigure({ id: 'f1', kind: 'image', origin: 'brand', src: 'https://example.com/team.png', alt: 'Advisors at a table', caption: 'Our team', credit: 'Photo: Harbor Point', at: { where: 'intro', after: 1 }, size: 'medium', align: 'left' }),
    FG.newFigure({ id: 'f2', kind: 'chart', src: FG.svgDataUrl(C.chartSvg(FG.chartSpec(chk.chart), FG.chartTheme({}))), chart: chk.chart, at: { where: 's1', after: FG.END } }),
    FG.newFigure({ id: 'f3', kind: 'image', origin: 'upload', src: 'data:image/png;base64,' + PNG.toString('base64'), alt: '', decorative: true, at: { where: 'conclusion', after: 0 } })];
  return a;
}
const picture = async (f) => ({ bytes: new Uint8Array(PNG), type: 'png', w: 2, h: 1 });

test('figures: places, insert at the cursor, interleave, move, labels and a removed section', () => {
  const a = sample();
  assert.strictEqual(FG.afterForCaret(a.intro, 3), 1, 'cursor in paragraph 1 → after paragraph 1');
  assert.strictEqual(FG.afterForCaret(a.intro, a.intro.length), 2);
  assert.strictEqual(FG.placeLabel(a, a.figures[0].at), 'After paragraph 1 of 2 in the introduction');
  assert.strictEqual(FG.placeLabel(a, a.figures[1].at), 'At the end of section 1 (The Basics)');
  const order = FG.interleave(a, 'intro', A.bodyToBlocks(a.intro)).map((x) => (x.figure ? x.figure.id : x.block.type));
  assert.deepStrictEqual(order, ['paragraph', 'f1', 'paragraph']);
  assert.deepStrictEqual(FG.ordered(a).map((f) => f.id), ['f1', 'f2', 'f3']);
  let b = { ...a, figures: FG.move(a, 'f1', 1) }; assert.strictEqual(FG.placeLabel(b, b.figures.find((f) => f.id === 'f1').at), 'At the end of the introduction');
  b = { ...b, figures: FG.move(b, 'f1', 1) }; assert.strictEqual(b.figures.find((f) => f.id === 'f1').at.where, 's1');
  assert.strictEqual(FG.canMove(a, 'f1', -1), true); const top = { ...a, figures: FG.move(a, 'f1', -1) }; assert.strictEqual(FG.placeLabel(top, top.figures.find((f) => f.id === 'f1').at), 'At the start of the introduction');
  assert.strictEqual(FG.canMove(top, 'f1', -1), false, 'the first place in the article cannot move up');
  const r = FG.reanchor(a, 's1'); assert.deepStrictEqual(r.find((f) => f.id === 'f2').at, { where: 'intro', after: FG.END }, 'figures of a removed section are kept, at the end of the text before it');
  assert.ok(FG.altProblem({ kind: 'image', alt: '' })); assert.strictEqual(FG.altProblem({ kind: 'image', alt: '', decorative: true }), '');
});

test('charts: only typed numbers, problems in words, alt text with every value', () => {
  assert.strictEqual(FG.parseNum('1,450'), 1450); assert.strictEqual(FG.parseNum('12.5%'), 12.5); assert.ok(Number.isNaN(FG.parseNum('about 40')));
  const empty = FG.checkChart(FG.blankChart()); assert.strictEqual(empty.ok, false); assert.ok(empty.problems.some((p) => /two rows/.test(p)));
  const bad = FG.checkChart({ type: 'pie', title: 'Mix', labels: ['A', 'B'], series: [{ name: 'x', values: ['40', 'lots'] }] });
  assert.strictEqual(bad.ok, false); assert.ok(bad.problems.some((p) => /“lots” in row 2 is not a number/.test(p)));
  const ok = FG.checkChart({ type: 'line', title: 'Clients', unit: '', labels: ['2023', '2024', ''], series: [{ name: '', values: ['120', '140', ''] }] });
  assert.ok(ok.ok, ok.problems.join()); assert.deepStrictEqual(ok.chart.series[0].values, [120, 140], 'the empty row is dropped, nothing filled in');
  assert.strictEqual(FG.chartAlt(ok.chart), 'Clients (line chart): 2023 120; 2024 140.');
  const svg = C.chartSvg(FG.chartSpec(ok.chart), FG.chartTheme({ accent: '#123456' })); assert.match(svg, /data-series="[^"]*120[^"]*140/); assert.match(svg, /#123456/);
  assert.match(FG.uploadProblem({ name: 'x.bmp', type: 'image/bmp', size: 10 }), /isn’t supported/); assert.match(FG.uploadProblem({ name: 'x.png', type: 'image/png', size: 9e6 }), /limit is 8 MB/); assert.strictEqual(FG.uploadProblem({ name: 'x.png', type: 'image/png', size: 9 }), '');
});

test('saved with the article: figures survive toModel/fromModel and sit as image blocks in the model', () => {
  const a = sample(); const m = A.toModel(a, { clientId: 'demo' });
  assert.ok(CosArticleModel.validate(m, { purpose: 'draft' }).ok);
  const imgs = m.blocks.filter((b) => b.type === 'image'); assert.deepStrictEqual(imgs.map((b) => b.id), ['f1'], 'web pictures in the intro and sections are image blocks in place (charts and the conclusion are kept in builder.figures)');
  assert.strictEqual(m.blocks[0].id, 'f1'); assert.deepStrictEqual(m.design.images.map((x) => [x.key, x.alt]), [['f1', 'Advisors at a table']]);
  const b = A.fromModel(JSON.parse(JSON.stringify(m)));
  assert.deepStrictEqual(b.figures, a.figures); assert.strictEqual(b.intro, a.intro); assert.strictEqual(b.sections[0].body, a.sections[0].body);
});

test('plain text: title, paragraphs with blank lines, headings on their own lines, links as text (url), images as [Image: alt]; no internal notes', () => {
  const t = X.plainText(sample(), { clientName: 'Harbor Point Wealth', date: Date.UTC(2026, 9, 30, 12) });
  const lines = t.split('\n');
  assert.strictEqual(lines[0], 'Why a Written Plan Helps'); assert.strictEqual(lines[2], 'A calmer retirement'); assert.strictEqual(lines[4], 'From: Claire Holloway, Founder'); assert.strictEqual(lines[6], 'October 30, 2026');
  assert.match(t, /\n\nWhen paychecks stop, choices appear\.\n\n\[Image: Advisors at a table\]\nOur team\nPhoto: Harbor Point\n\nA plan makes them easier\.\n\n/);
  assert.match(t, /\n\nThe Basics\n\nKnow your numbers\.\n\n- Spending\n- Income\n\n\[Chart: Clients by year \(bar chart\): 2023 120 clients; 2024 1,450 clients\.\]\n\nA Detail\n\n/);
  assert.match(t, /See the report \(https:\/\/example\.com\/r\)\./); assert.match(t, /Book a Review \(https:\/\/example\.com\/book\)/);
  assert.doesNotMatch(t, /Source needed|Compliance|Never promise|Explain the value/); assert.doesNotMatch(t, /\[Image: no description\]/, 'a decorative image is left out of the text');
  assert.strictEqual(X.fileBase(sample()), 'income-plans-why-writing-it-down-helps', 'file name from the working title');
  const co = { ...sample(), author: { name: '', title: '' } }; assert.match(X.plainText(co, { clientName: 'Harbor Point Wealth' }), /^From: Harbor Point Wealth$/m);
});

test('HTML package: index.html (semantic, meta title and description, alt text), images/ and README.txt', async () => {
  const zip = await JSZip.loadAsync(await X.htmlPackage(sample(), { JSZip, brand: { name: 'Harbor Point', head: 'Lora', body: 'Inter', accent: '#0E2266' }, picture }));
  const names = Object.keys(zip.files).sort(); assert.deepStrictEqual(names.filter((n) => !n.endsWith('/')), ['README.txt', 'images/chart-1.png', 'images/image-1.png', 'images/image-2.png', 'index.html']);
  const h = await zip.file('index.html').async('string');
  assert.match(h, /<title>Written Plan<\/title>/); assert.match(h, /<meta name="description" content="Why writing a plan helps\.">/);
  assert.match(h, /<h1>Why a Written Plan Helps<\/h1>/); assert.match(h, /<h2>The Basics<\/h2>/); assert.match(h, /<h3>A Detail<\/h3>/); assert.match(h, /<ul><li>Spending<\/li><li>Income<\/li><\/ul>/);
  assert.match(h, /<img src="images\/image-1\.png" alt="Advisors at a table">/); assert.match(h, /<figcaption>Our team <small>Photo: Harbor Point<\/small><\/figcaption>/);
  assert.match(h, /<img src="images\/chart-1\.png" alt="Clients by year[^"]*">\n<details><summary>Chart data<\/summary><table>/);
  assert.match(h, /<img src="images\/image-2\.png" alt="" role="presentation">/);
  assert.ok(h.indexOf('images/image-1.png') < h.indexOf('A plan makes them easier'), 'the image sits after the first paragraph');
  assert.doesNotMatch(h, /Source needed|Compliance|Never promise|<script/);
  assert.match(await zip.file('README.txt').async('string'), /paste everything between <article> and <\/article>/);
});

test('Word (.docx): Heading 1/2/3 styles, lists, links, pictures with alt text, page numbers, Letter size', async () => {
  const bytes = await X.docx(sample(), { JSZip, brand: { name: 'Harbor Point', head: 'Lora', body: 'Inter', accent: '#0E2266' }, picture });
  const zip = await JSZip.loadAsync(bytes); const d = await zip.file('word/document.xml').async('string');
  const para = (style) => [...d.matchAll(new RegExp('<w:pStyle w:val="' + style + '"/>.*?</w:p>', 'g'))].map((m) => m[0].replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(para('Heading1'), ['Why a Written Plan Helps']); assert.deepStrictEqual(para('Heading2'), ['The Basics', 'Conclusion', 'Sources']); assert.deepStrictEqual(para('Heading3'), ['A Detail']);
  assert.deepStrictEqual(para('ListParagraph').slice(0, 2), ['Spending', 'Income']);
  assert.match(d, /<w:hyperlink r:id="rId\d+" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"\/><\/w:rPr><w:t xml:space="preserve">the report<\/w:t>/);
  assert.match(d, /descr="Advisors at a table"/); assert.match(d, /descr="Clients by year \(bar chart\)/); assert.match(d, /<w:pgSz w:w="12240" w:h="15840"\/>/);
  assert.doesNotMatch(d, /Source needed|Compliance|Never promise/);
  assert.match(await zip.file('word/footer1.xml').async('string'), /PAGE.*NUMPAGES/s); assert.match(await zip.file('word/styles.xml').async('string'), /w:styleId="Heading2"><w:name w:val="heading 2"\/>/);
  assert.strictEqual(Object.keys(zip.files).filter((n) => n.startsWith('word/media/') && !n.endsWith('/')).length, 3);
  // python-docx opens it (a real Word file), when installed
  let py = ''; try { py = execFileSync('python3', ['-c', 'import docx'], { stdio: 'pipe' }) && 'ok'; } catch (e) { py = ''; }
  if (py) { const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bbx-')), 'a.docx'); fs.writeFileSync(f, bytes);
    const out = execFileSync('python3', ['-I', '-c', 'import sys,docx; d=docx.Document(sys.argv[1]); print("|".join(p.style.name+":"+p.text for p in d.paragraphs if p.style.name.startswith("Heading"))); print(len(d.inline_shapes))', f]).toString().trim().split('\n');
    assert.strictEqual(out[0], 'Heading 1:Why a Written Plan Helps|Heading 2:The Basics|Heading 3:A Detail|Heading 2:Conclusion|Heading 2:Sources'); assert.strictEqual(out[1], '3'); }
});

test('nothing to download before there is text; [Source needed] counted for the menu note', () => {
  const a = A.blankArticle({}); assert.strictEqual(X.hasText(a), false); assert.strictEqual(X.hasText(null), false);
  assert.strictEqual(X.hasText(sample()), true); assert.strictEqual(X.sourceNeededCount(sample()), 1);
  assert.deepStrictEqual(X.FORMATS.map((f) => f.label), ['PDF (.pdf)', 'Word (.docx)', 'Plain Text (.txt)', 'HTML Package (.zip)']);
});
