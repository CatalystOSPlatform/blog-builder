// Blog Builder — Download Article (Erika, Oct 30: "Download as a PDF, Word .doc, plain .txt, HTML package").
// Every format is made from one reading order (exportBlocks): the title, the dek, the byline ("From: …"), the date, the
// featured image, the introduction, the sections (H2/H3), the images and charts where they were placed, the conclusion,
// the call to action and the sources. Only the article: never the brief, review notes, compliance guidance or the
// "[Source needed]" markers. Pure functions, apart from the JSZip and picture readers the caller passes in.
//
//   exportBlocks(a, { clientName, date })   → [{ t: 'title'|'dek'|'byline'|'date'|'p'|'list'|'callout'|'h2'|'h3'|'figure'|'cta' , ... }]
//   plainText(a, opts)                       → the .txt
//   htmlPage(a, { brand, files })            → index.html of the HTML package (files: figure id → 'images/…')
//   await htmlPackage(a, { JSZip, brand, picture }) → Uint8Array (.zip: index.html, images/, README.txt)
//   await docx(a, { JSZip, brand, picture })        → Uint8Array (.docx)
//   picture(figure) → { bytes: Uint8Array, type: 'png'|'jpeg'|'gif'|'webp'|'svg', w, h } | null (the caller fetches; charts drawn to PNG)

import { bodyToBlocks, toRuns, isUrl } from './article.js';
import * as FG from './figures.js';

const str = (v) => (v == null ? '' : String(v));
export const esc = (s) => str(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Internal notes never leave CatalystOS.
export const clean = (t) => str(t).replace(/\s*\[Source needed\]/gi, '').replace(/[ \t]{2,}/g, ' ');
const runsOf = (t) => toRuns(clean(t));
export const dateText = (t) => new Date(t || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// ---------- file names ----------
export function slug(s) { return str(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, ''); }
// From the working title (the brief's), else the headline.
export const fileBase = (a) => slug((a && a.brief && a.brief.workingTitle) || (a && a.title)) || 'article';
export const FORMATS = [
  { id: 'pdf', label: 'PDF (.pdf)', note: 'Letter size, ready to read or print', ext: '.pdf', mime: 'application/pdf' },
  { id: 'docx', label: 'Word (.docx)', note: 'Opens in Microsoft Word and Google Docs', ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'txt', label: 'Plain Text (.txt)', note: 'Words only', ext: '.txt', mime: 'text/plain' },
  { id: 'zip', label: 'HTML Package (.zip)', note: 'A web page and its images, for your website', ext: '.zip', mime: 'application/zip' },
];
export const hasText = (a) => !!a && [a.title, a.intro, a.conclusion].concat((a.sections || []).map((s) => s.body)).some((t) => str(t).trim());
export const sourceNeededCount = (a) => [a.intro, a.conclusion].concat((a.sections || []).map((s) => s.body)).reduce((n, t) => n + (str(t).match(/\[Source needed\]/gi) || []).length, 0);

// ---------- the reading order ----------
export function byline(a, clientName = '') {
  const au = (a && a.author) || {};
  return 'From: ' + (au.name ? au.name + (au.title ? ', ' + au.title : '') : (clientName || 'the company'));
}
export function exportBlocks(a, { clientName = '', date = null } = {}) {
  const out = []; const B = (b) => out.push(b);
  B({ t: 'title', text: clean(a.title) || 'Untitled article' });
  if (str(a.subtitle).trim()) B({ t: 'dek', text: clean(a.subtitle) });
  B({ t: 'byline', text: byline(a, clientName) });
  B({ t: 'date', text: dateText(date || a.updatedAt) });
  if (a.image && a.image.src) B({ t: 'figure', figure: FG.newFigure({ id: 'featured', kind: 'image', src: a.image.src, alt: a.image.alt, caption: a.image.caption || '', size: 'full', origin: 'brand' }) });
  const text = (where, body) => FG.interleave(a, where, bodyToBlocks(clean(body))).forEach((x) => {
    if (x.figure) return B({ t: 'figure', figure: x.figure });
    const b = x.block;
    if (b.type === 'list') B({ t: 'list', ordered: !!b.ordered, items: b.items });
    else if (b.type === 'callout') B({ t: 'callout', title: b.title || '', runs: b.runs });
    else B({ t: 'p', runs: b.runs });
  });
  text('intro', a.intro);
  (a.sections || []).forEach((s) => { if (str(s.heading).trim()) B({ t: s.level === 3 ? 'h3' : 'h2', text: clean(s.heading) }); text(s.id, s.body); });
  const con = str(a.conclusion).trim() || FG.figuresIn(a, 'conclusion').size;
  if (con) { if (str(a.conclusion).trim()) B({ t: 'h2', text: 'Conclusion' }); text('conclusion', a.conclusion); }
  const cta = a.cta || {};
  if (str(cta.text).trim() || str(cta.label).trim()) B({ t: 'cta', runs: runsOf(cta.text), label: str(cta.label).trim(), url: isUrl(cta.url) ? str(cta.url).trim() : '' });
  const src = (a.sources || []).filter((x) => x && (str(x.title).trim() || isUrl(x.url)));
  if (src.length) { B({ t: 'h2', text: 'Sources' }); B({ t: 'list', ordered: true, sources: true, items: src.map((s) => [{ text: str(s.title).trim() || str(s.url), ...(isUrl(s.url) ? { href: str(s.url).trim() } : {}) }].concat(s.publisher ? [{ text: ', ' + s.publisher }] : [])) }); }
  return out;
}
export const headings = (blocks) => blocks.filter((b) => /^(title|h2|h3)$/.test(b.t)).map((b) => b.text);

// ---------- plain text ----------
const runsText = (runs) => (runs || []).map((r) => (r.href ? r.text + (r.text === r.href ? '' : ' (' + r.href + ')') : r.text)).join('');
export function plainText(a, opts = {}) {
  const out = [];
  exportBlocks(a, opts).forEach((b) => {
    if (b.t === 'title' || b.t === 'dek' || b.t === 'byline' || b.t === 'date' || b.t === 'h2' || b.t === 'h3') out.push(b.text);
    else if (b.t === 'p') out.push(runsText(b.runs));
    else if (b.t === 'callout') out.push((b.title ? b.title + ': ' : '') + runsText(b.runs));
    else if (b.t === 'list') out.push(b.items.map((it, i) => (b.ordered ? (i + 1) + '. ' : '- ') + runsText(it)).join('\n'));
    else if (b.t === 'figure') { const f = b.figure; const alt = FG.altOf(f); if (!f.decorative) out.push('[' + (f.kind === 'chart' ? 'Chart' : 'Image') + ': ' + (alt || 'no description') + ']' + (f.caption ? '\n' + f.caption : '') + (f.credit ? '\n' + f.credit : '')); }
    else if (b.t === 'cta') out.push([runsText(b.runs), b.label ? b.label + (b.url ? ' (' + b.url + ')' : '') : ''].filter(Boolean).join('\n'));
  });
  return out.filter((x) => str(x).trim()).join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

// ---------- HTML (the package's index.html) ----------
const inline = (runs) => (runs || []).map((r) => (r.href ? '<a href="' + esc(r.href) + '">' + esc(r.text) + '</a>' : esc(r.text))).join('');
export function figureHtml(f, src) {
  const alt = FG.altOf(f); const pct = FG.SIZE_PCT[f.size] || 100;
  const st = 'max-width:' + pct + '%;' + (f.align === 'left' ? 'margin:24px auto 24px 0' : f.align === 'right' ? 'margin:24px 0 24px auto' : 'margin:24px auto');
  const table = f.kind === 'chart' && f.chart ? (() => { const T = FG.chartTable(f.chart); return '\n<details><summary>Chart data</summary><table><thead><tr>' + T.head.map((h) => '<th scope="col">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + T.rows.map((r) => '<tr><th scope="row">' + esc(r[0]) + '</th>' + r.slice(1).map((v) => '<td>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></details>'; })() : '';
  const cap = [f.caption ? esc(f.caption) : '', f.credit ? '<small>' + esc(f.credit) + '</small>' : ''].filter(Boolean).join(' ');
  return '<figure style="' + st + '"><img src="' + esc(src || f.src) + '" alt="' + esc(alt) + '"' + (f.decorative ? ' role="presentation"' : '') + '>' + (cap ? '<figcaption>' + cap + '</figcaption>' : '') + table + '</figure>';
}
export function htmlPage(a, { brand = {}, files = {}, clientName = '', date = null } = {}) {
  const blocks = exportBlocks(a, { clientName: clientName || brand.name, date });
  const seo = a.seo || {}, br = a.brief || {};
  const title = clean(seo.title || br.workingTitle || a.title) || 'Article';
  const desc = clean(seo.metaDescription || seo.excerpt || br.objective || a.subtitle || '');
  const accent = /^#[0-9a-f]{6}$/i.test(brand.accent || '') ? brand.accent : '#0E2266';
  const fam = (f, fb) => (f ? "'" + str(f).replace(/['";{}<>]/g, '') + "'," : '') + fb;
  let body = '', head = '';
  blocks.forEach((b) => {
    if (b.t === 'title') head += '<h1>' + esc(b.text) + '</h1>\n';
    else if (b.t === 'dek') head += '<p class="dek">' + esc(b.text) + '</p>\n';
    else if (b.t === 'byline') head += '<p class="byline">' + esc(b.text) + '</p>\n';
    else if (b.t === 'date') head += '<p class="byline"><time datetime="' + new Date(date || a.updatedAt || Date.now()).toISOString().slice(0, 10) + '">' + esc(b.text) + '</time></p>\n';
    else if (b.t === 'h2' || b.t === 'h3') body += '<' + b.t + '>' + esc(b.text) + '</' + b.t + '>\n';
    else if (b.t === 'p') body += '<p>' + inline(b.runs) + '</p>\n';
    else if (b.t === 'callout') body += '<aside class="callout">' + (b.title ? '<strong>' + esc(b.title) + ':</strong> ' : '') + inline(b.runs) + '</aside>\n';
    else if (b.t === 'list') body += '<' + (b.ordered ? 'ol' : 'ul') + '>' + b.items.map((it) => '<li>' + inline(it) + '</li>').join('') + '</' + (b.ordered ? 'ol' : 'ul') + '>\n';
    else if (b.t === 'figure') body += figureHtml(b.figure, files[b.figure.id]) + '\n';
    else if (b.t === 'cta') body += '<aside class="cta" aria-label="Next step">' + (b.runs.some((r) => r.text.trim()) ? '<p>' + inline(b.runs) + '</p>' : '') + (b.label ? (b.url ? '<p><a class="button" href="' + esc(b.url) + '">' + esc(b.label) + '</a></p>' : '<p><strong>' + esc(b.label) + '</strong></p>') : '') + '</aside>\n';
  });
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(title) + '</title>\n'
    + (desc ? '<meta name="description" content="' + esc(desc) + '">\n' : '')
    + '<style>\nbody{margin:0;background:#FFFFFF;color:#14182B;font:400 18px/1.65 ' + fam(brand.body, 'Georgia,serif') + '}\nmain{max-width:720px;margin:0 auto;padding:40px 20px 72px}\n'
    + 'h1,h2,h3{font-family:' + fam(brand.head, 'system-ui,sans-serif') + ';color:' + accent + ';line-height:1.2}\nh1{font-size:2.2em;margin:0 0 .3em}h2{font-size:1.5em;margin:1.8em 0 .5em}h3{font-size:1.2em;margin:1.4em 0 .4em}\n'
    + '.dek{font-size:1.15em;color:#3A4159;margin:0 0 .8em}.byline{font-size:.85em;color:#4A5168;margin:0}\na{color:' + accent + '}\nfigure img{display:block;width:100%;height:auto}figcaption{font-size:.85em;color:#4A5168;margin-top:6px}figcaption small{display:block}\n'
    + '.callout{border-left:4px solid ' + accent + ';background:#F4F5F8;padding:12px 16px;margin:1em 0}.cta{border:2px solid ' + accent + ';border-radius:12px;padding:12px 16px;margin:1.6em 0}\n'
    + 'details{font-size:.85em;margin-top:6px}table{border-collapse:collapse}th,td{border:1px solid #D5D9E3;padding:4px 8px;text-align:left}\n</style>\n</head>\n<body>\n<main>\n<article>\n<header>\n'
    + head + '</header>\n' + body + '</article>\n</main>\n</body>\n</html>\n';
}
export function readme(a, { missing = [] } = {}) {
  const t = clean(a.title) || 'the article';
  return ['HTML package: ' + t, '',
    'What is inside',
    '- index.html: the article as a clean web page (headings, paragraphs, lists, links, images with alt text).',
    '- images/: every picture and chart in the article.', '',
    'How to put it on your website',
    '1. Open index.html in a browser to check it.',
    '2. Upload the files in images/ to your website’s media library (WordPress: Media > Add New; HubSpot: Files).',
    '3. In your site’s editor, switch to the HTML or code view and paste everything between <article> and </article>.',
    '4. Change each image address (src="images/...") to the address your media library gives it.',
    '5. Copy the page title and description from the top of index.html into your site’s SEO fields.',
    '6. Preview, then publish from your website.']
    .concat(missing.length ? ['', 'Pictures that could not be copied into this package keep their web address in index.html:'].concat(missing.map((m) => '- ' + m)) : [])
    .join('\r\n') + '\r\n';
}
const EXT = { png: 'png', jpeg: 'jpg', jpg: 'jpg', gif: 'gif', webp: 'webp', svg: 'svg' };
export async function htmlPackage(a, { JSZip, brand = {}, picture, clientName = '', date = null } = {}) {
  const zip = new JSZip(); const files = {}; const missing = []; const n = { image: 0, chart: 0 };
  const figs = exportBlocks(a, { clientName: clientName || brand.name, date }).filter((b) => b.t === 'figure').map((b) => b.figure);
  for (const f of figs) {
    const p = picture ? await picture(f).catch(() => null) : null;
    if (p && p.bytes) { const name = 'images/' + (f.id === 'featured' ? 'featured' : (f.kind === 'chart' ? 'chart-' + (++n.chart) : 'image-' + (++n.image))) + '.' + (EXT[p.type] || 'png'); zip.file(name, p.bytes); files[f.id] = name; }
    else if (/^https?:/.test(f.src)) missing.push(f.src);
  }
  zip.file('index.html', htmlPage(a, { brand, files, clientName, date }));
  zip.file('README.txt', readme(a, { missing }));
  if (!Object.keys(files).length) zip.folder('images');
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

// ---------- Word (.docx) ----------
// A real Word file: Heading 1 (the title), Heading 2 and Heading 3 as Word heading styles (the navigation pane works),
// numbered and bulleted lists, working links, pictures with their alt text, captions, a footer with page numbers, Letter size.
const x = (s) => str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const hex6 = (c, fb) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.slice(1).toUpperCase() : fb);
const EMU = (pt) => Math.round(pt * 12700);
export async function docx(a, { JSZip, brand = {}, picture, clientName = '', date = null } = {}) {
  const blocks = exportBlocks(a, { clientName: clientName || brand.name, date });
  const rels = []; const media = []; const nums = []; let pid = 0;
  const rid = (type, target, ext) => { const id = 'rId' + (rels.length + 10); rels.push({ id, type, target, ext }); return id; };
  const T = { img: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', link: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink' };
  const run = (t, rPr = '') => '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + x(t) + '</w:t></w:r>';
  const runs = (rs, rPr = '') => (rs || []).map((r) => (r.href ? '<w:hyperlink r:id="' + rid(T.link, r.href, true) + '" w:history="1">' + run(r.text, '<w:rStyle w:val="Hyperlink"/>' + rPr) + '</w:hyperlink>' : run(r.text, rPr))).join('');
  const p = (style, inner, pPr = '') => '<w:p><w:pPr><w:pStyle w:val="' + style + '"/>' + pPr + '</w:pPr>' + inner + '</w:p>';
  const W = 468; // 6.5 in of text width, in points
  const body = [];
  for (const b of blocks) {
    if (b.t === 'title') body.push(p('Heading1', run(b.text)));
    else if (b.t === 'dek') body.push(p('Subtitle', run(b.text)));
    else if (b.t === 'byline' || b.t === 'date') body.push(p('Byline', run(b.text)));
    else if (b.t === 'h2') body.push(p('Heading2', run(b.text)));
    else if (b.t === 'h3') body.push(p('Heading3', run(b.text)));
    else if (b.t === 'p') body.push(p('Normal', runs(b.runs)));
    else if (b.t === 'callout') body.push(p('Callout', (b.title ? run(b.title + ': ', '<w:b/>') : '') + runs(b.runs)));
    else if (b.t === 'list') { const id = nums.length + 1; nums.push(b.ordered ? 'decimal' : 'bullet'); b.items.forEach((it) => body.push(p('ListParagraph', runs(it), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + id + '"/></w:numPr>'))); }
    else if (b.t === 'cta') { if (b.runs.some((r) => r.text.trim())) body.push(p('Callout', runs(b.runs))); if (b.label) body.push(p('Callout', b.url ? runs([{ text: b.label, href: b.url }], '<w:b/>') : run(b.label, '<w:b/>'))); }
    else if (b.t === 'figure') {
      const f = b.figure; const pic = picture ? await picture(f).catch(() => null) : null;
      const jc = '<w:jc w:val="' + (f.align === 'left' ? 'left' : f.align === 'right' ? 'right' : 'center') + '"/>';
      if (pic && pic.bytes && /^(png|jpeg|jpg|gif)$/.test(pic.type)) {
        const ext = pic.type === 'jpg' ? 'jpeg' : pic.type; const name = 'image' + (media.length + 1) + '.' + ext; media.push({ name, bytes: pic.bytes, ext });
        const id = rid(T.img, 'media/' + name); const n = ++pid;
        let w = W * (FG.SIZE_PCT[f.size] || 100) / 100, h = w * (pic.h || 1) / (pic.w || 1); if (h > 560) { w = w * 560 / h; h = 560; }
        const alt = FG.altOf(f);
        body.push('<w:p><w:pPr><w:pStyle w:val="Figure"/><w:keepNext/>' + jc + '</w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + EMU(w) + '" cy="' + EMU(h) + '"/><wp:docPr id="' + n + '" name="Picture ' + n + '" descr="' + x(alt) + '"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="' + n + '" name="' + name + '" descr="' + x(alt) + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + id + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + EMU(w) + '" cy="' + EMU(h) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>');
      } else if (!f.decorative) body.push(p('Caption', run('[' + (f.kind === 'chart' ? 'Chart' : 'Image') + ': ' + (FG.altOf(f) || 'no description') + ']'), jc));
      const cap = [f.caption, f.credit].filter((s) => str(s).trim()).join(' · ');
      if (cap) body.push(p('Caption', run(cap), jc));
    }
  }
  const NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const fld = (instr) => '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  const fId = rid('http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer', 'footer1.xml');
  const title = clean(a.title) || 'Untitled article';
  const document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + body.join('')
    + '<w:sectPr><w:footerReference w:type="default" r:id="' + fId + '"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="576" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const footer = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + NS + '><w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs></w:pPr>' + run(title) + '<w:r><w:tab/><w:t xml:space="preserve">Page </w:t></w:r>' + fld('PAGE') + '<w:r><w:t xml:space="preserve"> of </w:t></w:r>' + fld('NUMPAGES') + '</w:p></w:ftr>';
  const hf = str(brand.head || 'Calibri').replace(/["<>&]/g, ''), bf = str(brand.body || 'Calibri').replace(/["<>&]/g, ''); const acc = hex6(brand.accent, '0E2266');
  const font = (f) => '<w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:cs="' + f + '" w:eastAsia="' + f + '"/>';
  const ps = (id, name, rPr, pPr = '', extra = '') => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' + extra + '<w:qFormat/><w:pPr>' + pPr + '</w:pPr><w:rPr>' + rPr + '</w:rPr></w:style>';
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:docDefaults><w:rPrDefault><w:rPr>' + font(bf) + '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="14182B"/></w:rPr></w:style>'
    + ps('Heading1', 'heading 1', font(hf) + '<w:b/><w:color w:val="' + acc + '"/><w:sz w:val="48"/><w:szCs w:val="48"/>', '<w:keepNext/><w:spacing w:before="0" w:after="120" w:line="264" w:lineRule="auto"/><w:outlineLvl w:val="0"/>', '<w:uiPriority w:val="9"/>')
    + ps('Heading2', 'heading 2', font(hf) + '<w:b/><w:color w:val="' + acc + '"/><w:sz w:val="32"/><w:szCs w:val="32"/>', '<w:keepNext/><w:keepLines/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="1"/>', '<w:uiPriority w:val="9"/>')
    + ps('Heading3', 'heading 3', font(hf) + '<w:b/><w:color w:val="' + acc + '"/><w:sz w:val="26"/><w:szCs w:val="26"/>', '<w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/>', '<w:uiPriority w:val="9"/>')
    + ps('Subtitle', 'Subtitle', '<w:color w:val="3A4159"/><w:sz w:val="28"/><w:szCs w:val="28"/>', '<w:spacing w:after="160"/>')
    + ps('Byline', 'Byline', '<w:color w:val="4A5168"/><w:sz w:val="20"/><w:szCs w:val="20"/>', '<w:spacing w:after="40"/>')
    + ps('ListParagraph', 'List Paragraph', '', '<w:spacing w:after="80"/><w:ind w:left="720"/><w:contextualSpacing/>')
    + ps('Callout', 'Callout', '', '<w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="' + acc + '"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F4F5F8"/><w:ind w:left="200"/>')
    + ps('Figure', 'Figure', '', '<w:spacing w:before="240" w:after="80"/>')
    + ps('Caption', 'caption', '<w:color w:val="4A5168"/><w:sz w:val="18"/><w:szCs w:val="18"/>', '<w:spacing w:after="240"/>')
    + ps('Footer', 'footer', '<w:color w:val="4A5168"/><w:sz w:val="18"/><w:szCs w:val="18"/>', '<w:spacing w:after="0"/>')
    + '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:uiPriority w:val="99"/><w:rPr><w:color w:val="' + acc + '"/><w:u w:val="single"/></w:rPr></w:style></w:styles>';
  const lvl = (kind) => kind === 'decimal' ? '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>' : '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:lvl>';
  const numbering = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + nums.map((k, i) => '<w:abstractNum w:abstractNumId="' + i + '"><w:multiLevelType w:val="singleLevel"/>' + lvl(k) + '</w:abstractNum>').join('')
    + nums.map((k, i) => '<w:num w:numId="' + (i + 1) + '"><w:abstractNumId w:val="' + i + '"/></w:num>').join('') + '</w:numbering>';
  const exts = [...new Set(media.map((m) => m.ext))];
  const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    + exts.map((e) => '<Default Extension="' + e + '" ContentType="image/' + e + '"/>').join('')
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
    + rels.map((r) => '<Relationship Id="' + r.id + '" Type="' + r.type + '" Target="' + x(r.target) + '"' + (r.ext ? ' TargetMode="External"' : '') + '/>').join('') + '</Relationships>';
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + x(title) + '</dc:title><dc:creator>' + x((a.author && a.author.name) || clientName || brand.name || '') + '</dc:creator><dc:language>en-US</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>';
  const zip = new JSZip();
  zip.file('[Content_Types].xml', ct);
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('word/document.xml', document); zip.file('word/styles.xml', styles); zip.file('word/numbering.xml', numbering); zip.file('word/footer1.xml', footer);
  zip.file('word/_rels/document.xml.rels', docRels); zip.file('docProps/core.xml', core);
  media.forEach((m) => zip.file('word/media/' + m.name, m.bytes));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

// ---------- PDF pages (laid out in the browser; lib/export-pdf.js draws them) ----------
// The blocks as HTML fragments for the PDF pages; a heading stays with what follows it. figSrc(figure) → { src } or { svg }.
export function pdfBlocks(a, { clientName = '', date = null, figSrc = (f) => ({ src: f.src }) } = {}) {
  const out = []; const B = (html, keep) => out.push({ html, keep: !!keep });
  exportBlocks(a, { clientName, date }).forEach((b) => {
    if (b.t === 'title') B('<h1>' + esc(b.text) + '</h1>', true);
    else if (b.t === 'dek') B('<p class="dek">' + esc(b.text) + '</p>', true);
    else if (b.t === 'byline') B('<p class="by">' + esc(b.text) + '</p>', true);
    else if (b.t === 'date') B('<p class="by">' + esc(b.text) + '</p>');
    else if (b.t === 'h2' || b.t === 'h3') B('<' + b.t + '>' + esc(b.text) + '</' + b.t + '>', true);
    else if (b.t === 'p') B('<p>' + inline(b.runs) + '</p>');
    else if (b.t === 'callout') B('<p class="callout">' + (b.title ? '<strong>' + esc(b.title) + ':</strong> ' : '') + inline(b.runs) + '</p>');
    else if (b.t === 'list') B('<' + (b.ordered ? 'ol' : 'ul') + '>' + b.items.map((it) => '<li>' + inline(it) + '</li>').join('') + '</' + (b.ordered ? 'ol' : 'ul') + '>');
    else if (b.t === 'cta') B('<div class="cta">' + (b.runs.some((r) => r.text.trim()) ? '<p>' + inline(b.runs) + '</p>' : '') + (b.label ? '<p><strong>' + (b.url ? '<a href="' + esc(b.url) + '">' + esc(b.label) + '</a>' : esc(b.label)) + '</strong></p>' : '') + '</div>');
    else if (b.t === 'figure') {
      const f = b.figure; const s = figSrc(f) || {}; const alt = FG.altOf(f); const pct = FG.SIZE_PCT[f.size] || 100;
      const cap = [f.caption, f.credit].filter((v) => str(v).trim()).map(esc).join(' · ');
      const inner = s.svg ? s.svg : '<img src="' + esc(s.src || f.src) + '" alt="' + esc(alt) + '"' + (f.decorative ? ' data-decorative=""' : '') + '>';
      B('<figure class="fig fig-' + (f.align || 'center') + '" style="width:' + pct + '%">' + inner + (cap ? '<figcaption>' + cap + '</figcaption>' : '') + '</figure>');
    }
  });
  return out;
}
