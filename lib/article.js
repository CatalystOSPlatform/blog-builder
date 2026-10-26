// Blog Builder — the article in the editor, and its conversions. Pure functions (browser and Node tests).
//
// Editor shape (what the page edits):
//   { id, typeId, title, subtitle, intro, sections: [{ id, key, heading, level (2|3), body, what, required, kind, approved, by }],
//     conclusion, cta: { text, label, url }, author: { name, title }, sources: [{ title, url, publisher }],
//     image: { src, alt, altReview } | null, seo: { title, metaDescription, slug, excerpt, imageAltText, searchIntent },
//     brief, campaignId, campaignName, start: 'topic'|'campaign'|'blank', review, approvals, createdAt, updatedAt }
// A section's body is light text: blank lines separate paragraphs; "- " lines are a bulleted list, "1. " lines a numbered
// list, "> " lines a callout ("> Note: …" gives it a title); [words](https://…) is a link.
//
// Saved format: the CatalystOS article model (pilot-dash publishing/article-model.js, `create()`), which keeps unknown keys,
// plus `templateId` (the article type), `brief`, `sectionMeta` (each section's key, guidance, approval) and the editor's
// own fields under `builder`. fromModel(toModel(a)) gives the same article back.

import { typeById, newId } from './article-types.js';

const str = (v) => (v == null ? '' : String(v));
const M = () => {
  const m = globalThis.CosArticleModel;
  if (!m) throw new Error('The article model (publishing/article-model.js) is not loaded.');
  return m;
};

export const SOURCE_NEEDED = '[Source needed]';
export const isUrl = (u) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(str(u).trim());

// ---------- new articles ----------
export function blankArticle({ typeId = 'blank', sections = [], brief = null, campaignId = '', campaignName = '', start = 'blank', author = null } = {}) {
  const T = typeById(typeId) || typeById('blank');
  return { id: newId('a'), typeId: T.id, title: '', subtitle: '', intro: '', sections, conclusion: '', cta: { text: '', label: '', url: '' }, author: author || { name: '', title: '' }, sources: [], image: null,
    seo: { title: '', metaDescription: '', slug: '', excerpt: '', imageAltText: '', searchIntent: T.intent || 'informational' }, brief, campaignId: campaignId || '', campaignName: campaignName || '', start,
    review: null, approvals: [], createdAt: Date.now(), updatedAt: Date.now() };
}

// ---------- inline text: [words](url) ⇄ runs ----------
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
export function toRuns(text) {
  const t = str(text); const out = []; let last = 0; let m; LINK.lastIndex = 0;
  while ((m = LINK.exec(t))) { if (m.index > last) out.push({ text: t.slice(last, m.index) }); out.push({ text: m[1], href: m[2] }); last = m.index + m[0].length; }
  if (last < t.length || !out.length) out.push({ text: t.slice(last) });
  return out;
}
export function fromRuns(runs) { return (runs || []).map((r) => (r.href ? '[' + r.text + '](' + r.href + ')' : r.text)).join(''); }

// ---------- body text ⇄ article model blocks ----------
export function bodyToBlocks(body, idBase = 'b') {
  const blocks = []; let n = 0; const id = () => idBase + '-' + (++n);
  const paras = str(body).replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  paras.forEach((p) => {
    const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => /^[-*•]\s+/.test(l))) blocks.push({ type: 'list', id: id(), ordered: false, items: lines.map((l) => toRuns(l.replace(/^[-*•]\s+/, ''))) });
    else if (lines.every((l) => /^\d+[.)]\s+/.test(l))) blocks.push({ type: 'list', id: id(), ordered: true, items: lines.map((l) => toRuns(l.replace(/^\d+[.)]\s+/, ''))) });
    else if (lines.every((l) => /^>\s?/.test(l))) {
      const txt = lines.map((l) => l.replace(/^>\s?/, '')).join(' ');
      const m = /^([^:]{2,40}):\s+(.*)$/.exec(txt);
      blocks.push({ type: 'callout', id: id(), title: m ? m[1] : '', runs: toRuns(m ? m[2] : txt), tone: 'info' });
    } else blocks.push({ type: 'paragraph', id: id(), runs: toRuns(lines.join(' ')) });
  });
  return blocks;
}
export function blocksToBody(blocks) {
  return (blocks || []).map((b) => {
    if (b.type === 'list') return b.items.map((it, i) => (b.ordered ? (i + 1) + '. ' : '- ') + fromRuns(it)).join('\n');
    if (b.type === 'callout') return '> ' + (b.title ? b.title + ': ' : '') + fromRuns(b.runs);
    if (b.type === 'quote' || b.type === 'pullquote') return '> ' + b.text + (b.cite ? ' — ' + b.cite : '');
    if (b.type === 'paragraph') return fromRuns(b.runs);
    if (b.type === 'stat') return '> ' + b.value + ' ' + b.label;
    if (b.type === 'cta') return b.text;
    return '';
  }).filter(Boolean).join('\n\n');
}

// ---------- editor article → article model (the saved format) ----------
export function toModel(a, { clientId = '', author = null } = {}) {
  const T = typeById(a.typeId) || typeById('blank');
  const blocks = [];
  (a.sections || []).forEach((s) => {
    blocks.push({ type: 'heading', id: s.id, level: s.level === 3 ? 3 : 2, text: s.heading });
    bodyToBlocks(s.body, s.id).forEach((b) => blocks.push(b));
  });
  const seo = a.seo || {};
  const approved = isApproved(a);
  const model = M().create({
    articleId: a.id, clientId, campaignId: a.campaignId || '', articleType: T.articleType || 'blog', title: a.title, subtitle: a.subtitle,
    summary: seo.excerpt || '', introduction: a.intro, blocks, conclusion: a.conclusion, cta: a.cta || {},
    editorial: { author: author || a.author || {}, sources: (a.sources || []).filter((x) => x && (x.title || x.url)).map((x) => ({ title: x.title || x.url, url: isUrl(x.url) ? x.url.trim() : '', publisher: x.publisher || '' })),
      researchDate: (a.brief && a.brief.researchDate) || '', state: approved ? 'approved' : (a.sections || []).some((s) => s.body) ? 'review' : 'writing',
      editorialApproval: approved ? { status: 'approved', by: (a.approvals || []).slice(-1)[0] ? a.approvals.slice(-1)[0].by : '', at: new Date((a.approvals || []).slice(-1)[0] ? a.approvals.slice(-1)[0].at : Date.now()).toISOString() } : { status: 'not_requested' },
      complianceApproval: { status: 'not_requested', required: !!(a.review && a.review.regulated) } },
    seo: { title: seo.title || '', metaDescription: seo.metaDescription || '', slug: seo.slug || '', excerpt: seo.excerpt || '', searchIntent: seo.searchIntent || T.intent, imageAltText: (a.image && a.image.alt) || seo.imageAltText || '' },
    design: { featuredImage: a.image && a.image.src ? { src: a.image.src, alt: a.image.alt || '', key: 'featured' } : null, layoutStyle: 'standard' },
    // Blog Builder fields (kept by the model as unknown keys)
    templateId: a.typeId, brief: a.brief || null, campaignName: a.campaignName || '', start: a.start || 'blank',
    sectionMeta: (a.sections || []).map((s) => ({ id: s.id, key: s.key || '', what: s.what || '', required: s.required !== false, kind: s.kind || '', approved: !!s.approved, by: s.by || '' })),
    builder: { review: a.review || null, approvals: a.approvals || [], imageAltReview: !!(a.image && a.image.altReview), createdAt: a.createdAt || Date.now(), updatedAt: a.updatedAt || Date.now(), sourcesRaw: a.sources || [] },
  });
  return model;
}

// ---------- article model → editor article ----------
export function fromModel(m0) {
  const m = M().create(m0);
  const meta = new Map((m.sectionMeta || []).map((x) => [x.id, x]));
  const sections = []; let cur = null; const pre = [];
  m.blocks.forEach((b) => {
    if (b.type === 'heading') { cur = { id: b.id || newId(), heading: b.text, level: b.level === 3 ? 3 : 2, blocks: [] }; sections.push(cur); }
    else if (cur) cur.blocks.push(b); else pre.push(b);
  });
  const out = sections.map((s) => { const x = meta.get(s.id) || {}; return { id: s.id, key: x.key || '', heading: s.heading, level: s.level, body: blocksToBody(s.blocks), what: x.what || '', required: x.required !== false, kind: x.kind || '', approved: !!x.approved, by: x.by || '' }; });
  const b = m.builder || {}; const fi = m.design.featuredImage;
  return { id: m.articleId, typeId: m.templateId || 'blank', title: m.title, subtitle: m.subtitle, intro: m.introduction + (pre.length ? (m.introduction ? '\n\n' : '') + blocksToBody(pre) : ''), sections: out, conclusion: m.conclusion,
    cta: { ...m.cta }, author: { name: m.editorial.author.name, title: m.editorial.author.title }, sources: Array.isArray(b.sourcesRaw) ? b.sourcesRaw : m.editorial.sources.map((s) => ({ title: s.title, url: s.url, publisher: s.publisher })),
    image: fi ? { src: fi.src, alt: fi.alt, altReview: !!b.imageAltReview } : null,
    seo: { title: m.seo.title, metaDescription: m.seo.metaDescription, slug: m.seo.slug, excerpt: m.seo.excerpt, imageAltText: m.seo.imageAltText, searchIntent: m.seo.searchIntent },
    brief: m.brief || null, campaignId: m.campaignId || '', campaignName: m.campaignName || '', start: m.start || 'blank', review: b.review || null, approvals: b.approvals || [],
    createdAt: b.createdAt || Date.now(), updatedAt: b.updatedAt || Date.now() };
}

export function isApproved(a) { const s = (a && a.sections) || []; return s.length > 0 && s.every((x) => x.approved); }

// ---------- the Senior Writer's markdown → editor article ----------
// Expected: "# Headline", an optional "_dek_" line, the introduction, "## Section" / "### Subsection" blocks, then optional
// "## Conclusion", "## Call to Action" (with an optional "Button: …" line) and "## Sources" ("- Title — https://…").
export function parseDraft(md, outline = []) {
  const lines = str(md).replace(/\r/g, '').split('\n');
  let title = '', subtitle = ''; const intro = []; const secs = []; let cur = null; let special = null; const sp = { conclusion: [], cta: [], sources: [] };
  for (const raw of lines) {
    const l = raw.replace(/\s+$/, '');
    let m;
    if (!title && (m = /^#\s+(.+)$/.exec(l))) { title = clean(m[1]); continue; }
    if ((m = /^(#{2,3})\s+(.+)$/.exec(l))) {
      const h = clean(m[2]);
      if (/^(conclusion|in conclusion|final thoughts)$/i.test(h)) { special = 'conclusion'; cur = null; continue; }
      if (/^(call to action|cta|next step)$/i.test(h)) { special = 'cta'; cur = null; continue; }
      if (/^(sources|references|sources and references)$/i.test(h)) { special = 'sources'; cur = null; continue; }
      special = null; cur = { heading: h, level: m[1].length === 3 ? 3 : 2, lines: [] }; secs.push(cur); continue;
    }
    if (special) { sp[special].push(l); continue; }
    if (cur) { cur.lines.push(l); continue; }
    if (!subtitle && !intro.join('').trim() && (m = /^[_*]{1,2}(.+?)[_*]{1,2}$/.exec(l.trim()))) { subtitle = clean(m[1]); continue; }
    intro.push(l);
  }
  const used = new Set();
  const sections = secs.map((s) => {
    const o = outline.find((x) => !used.has(x.id) && norm(x.heading) === norm(s.heading)) || null; if (o) used.add(o.id);
    return { id: o ? o.id : newId(), key: o ? o.key : '', heading: s.heading, level: s.level, body: tidy(s.lines.join('\n')), what: o ? o.what : '', required: o ? o.required : false, kind: o ? o.kind : '', approved: false, by: 'agent' };
  });
  // CTA: the text, and the button label from "Button: …" (or the bold words) — the URL is never invented.
  const ctaLines = sp.cta.filter((l) => l.trim()); let label = '';
  const ctaText = ctaLines.filter((l) => { const m = /^\s*(?:button|label)\s*:\s*(.+)$/i.exec(l); if (m) { label = clean(m[1]); return false; } return true; }).join(' ').trim();
  const sources = sp.sources.map((l) => l.replace(/^\s*[-*\d.)]+\s*/, '').trim()).filter(Boolean).map((l) => {
    const md = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/.exec(l); if (md) return { title: md[1], url: md[2], publisher: '' };
    const u = (l.match(/https?:\/\/[^\s)]+/) || [''])[0]; const t = clean(l.replace(u, '').replace(/[—–-]\s*$/, '').replace(/[(<\[]\s*$/, ''));
    return { title: t || u, url: u, publisher: '' };
  });
  return { title, subtitle, intro: tidy(intro.join('\n')), sections, conclusion: tidy(sp.conclusion.join('\n')), cta: { text: clean(ctaText.replace(/\*\*/g, '')), label: label.replace(/\*\*/g, ''), url: '' }, sources };
}
const clean = (s) => str(s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).toLowerCase().replace(/[^a-z0-9 ]/g, '');
const tidy = (s) => str(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim();

// ---------- claims that need a source ----------
// "[Source needed]" markers the Writer left, plus figures in the text that no source, research fact or Brand Command states.
export function sourceFlags(a, sourceText = '') {
  const out = []; const src = str(sourceText).toLowerCase();
  const each = (where, text) => {
    str(text).split(/(?<=[.!?])\s+/).forEach((sent) => {
      if (sent.includes(SOURCE_NEEDED)) out.push({ where, text: sent.replace(/\s*\[Source needed\]/g, '').trim(), why: 'The Writer marked this claim as needing a source.' });
      else { const figs = (sent.match(/\d[\d,.]*\s?%|\$\s?\d[\d,.]*\s?(?:million|billion|[mbk])?|\b\d{2,}[\d,.]*\b/gi) || []).filter((f) => !/^(19|20)\d\d$/.test(f.trim()));
        const missing = figs.filter((f) => !src.includes(f.toLowerCase().replace(/\s/g, '')) && !src.includes(f.toLowerCase()));
        if (missing.length && !/\]\(https?:/.test(sent)) out.push({ where, text: sent.trim().slice(0, 240), why: 'Figure ' + missing.slice(0, 2).join(', ') + ' is not in Brand Command, the research or a listed source.' }); }
    });
  };
  each('Introduction', a.intro);
  (a.sections || []).forEach((s) => each(s.heading || 'Section', s.body));
  each('Conclusion', a.conclusion);
  return out;
}

// ---------- SEO defaults (deterministic; the person edits them) ----------
export function seoDefaults(a, slugify) {
  const first = (t, n) => { const s = str(t).replace(LINK, '$1').replace(/\[Source needed\]/g, '').replace(/\s+/g, ' ').trim(); if (s.length <= n) return s; const cut = s.slice(0, n - 1); return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20)).replace(/[,;:]$/, '') + '…'; };
  const sentences = str(a.intro).replace(LINK, '$1').split(/(?<=[.!?])\s+/);
  return { title: first(a.title, 60), metaDescription: first(sentences.slice(0, 2).join(' ') || a.subtitle, 155), slug: (slugify || ((x) => x))(a.title), excerpt: first(sentences.slice(0, 2).join(' '), 220), imageAltText: (a.image && a.image.alt) || '' };
}

// ---------- outputs: HTML, Markdown, plain text ----------
export const esc = (s) => str(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inlineHtml = (t) => toRuns(t).map((r) => (r.href ? '<a href="' + esc(r.href) + '">' + esc(r.text) + '</a>' : esc(r.text))).join('').replace(/\[Source needed\]/g, '<mark class="need">[Source needed]</mark>');
export function bodyHtml(body) {
  return bodyToBlocks(body).map((b) => {
    if (b.type === 'list') return '<' + (b.ordered ? 'ol' : 'ul') + '>' + b.items.map((it) => '<li>' + inlineHtml(fromRuns(it)) + '</li>').join('') + '</' + (b.ordered ? 'ol' : 'ul') + '>';
    if (b.type === 'callout') return '<aside class="callout">' + (b.title ? '<strong>' + esc(b.title) + '</strong> ' : '') + inlineHtml(fromRuns(b.runs)) + '</aside>';
    return '<p>' + inlineHtml(fromRuns(b.runs)) + '</p>';
  }).join('\n');
}
// A standalone, accessible HTML article in the client's brand (Brand Command fonts and colors). brand: { head, body, ink, accent, name, fontsHref }.
export function articleHtml(a, brand = {}) {
  const head = brand.head || 'Manrope', body = brand.body || 'Inter', ink = brand.ink || '#14182B', accent = brand.accent || '#0E2266';
  const fam = (f) => "'" + str(f).replace(/'/g, '') + "'";
  const secs = (a.sections || []).map((s) => '<section>\n<h' + (s.level === 3 ? 3 : 2) + '>' + esc(s.heading) + '</h' + (s.level === 3 ? 3 : 2) + '>\n' + bodyHtml(s.body) + '\n</section>').join('\n');
  const src = (a.sources || []).filter((x) => x && (x.title || x.url));
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc((a.seo && a.seo.title) || a.title || 'Article') + '</title>\n'
    + (a.seo && a.seo.metaDescription ? '<meta name="description" content="' + esc(a.seo.metaDescription) + '">\n' : '')
    + (brand.fontsHref ? '<link rel="stylesheet" href="' + esc(brand.fontsHref) + '">\n' : '')
    + '<style>body{margin:0;background:#FFFFFF;color:' + ink + ';font:400 18px/1.65 ' + fam(body) + ',Georgia,serif}main{max-width:720px;margin:0 auto;padding:48px 20px 80px}h1,h2,h3{font-family:' + fam(head) + ',system-ui,sans-serif;color:' + accent + ';line-height:1.2;text-wrap:balance}h1{font-size:40px;margin:0 0 12px}h2{font-size:28px;margin:40px 0 12px}h3{font-size:22px;margin:28px 0 8px}.dek{font-size:21px;color:#3A4159;margin:0 0 20px}.byline{font-size:15px;color:#4A5168;margin:0 0 28px}figure{margin:0 0 28px}figure img{width:100%;height:auto;border-radius:8px;display:block}a{color:' + accent + ';text-decoration:underline}.callout{border-left:4px solid ' + accent + ';background:#F5F6FA;padding:14px 18px;margin:20px 0;border-radius:0 8px 8px 0}.cta{margin:40px 0;padding:24px;border:2px solid ' + accent + ';border-radius:12px}.cta a{display:inline-block;margin-top:10px;background:' + accent + ';color:#FFFFFF;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700}.sources{font-size:15px;border-top:1px solid #DCE0EA;margin-top:40px;padding-top:12px}mark.need{background:#FFF4D6;color:#7A2E0E}</style>\n</head>\n<body>\n<main>\n<article>\n<header>\n'
    + '<h1>' + esc(a.title || 'Untitled article') + '</h1>\n' + (a.subtitle ? '<p class="dek">' + esc(a.subtitle) + '</p>\n' : '')
    + (a.author && a.author.name ? '<p class="byline">By ' + esc(a.author.name) + (a.author.title ? ', ' + esc(a.author.title) : '') + '</p>\n' : '') + '</header>\n'
    + (a.image && a.image.src ? '<figure><img src="' + esc(a.image.src) + '" alt="' + esc(a.image.alt || '') + '"></figure>\n' : '')
    + (a.intro ? bodyHtml(a.intro) + '\n' : '') + secs + '\n'
    + (a.conclusion ? '<section>\n<h2>Conclusion</h2>\n' + bodyHtml(a.conclusion) + '\n</section>\n' : '')
    + (a.cta && (a.cta.text || a.cta.label) ? '<aside class="cta" aria-label="Next step"><p>' + inlineHtml(a.cta.text) + '</p>' + (a.cta.label && isUrl(a.cta.url) ? '<a href="' + esc(a.cta.url) + '">' + esc(a.cta.label) + '</a>' : a.cta.label ? '<p><strong>' + esc(a.cta.label) + '</strong></p>' : '') + '</aside>\n' : '')
    + (src.length ? '<section class="sources" aria-labelledby="src-h"><h2 id="src-h">Sources</h2><ol>' + src.map((s) => '<li>' + (isUrl(s.url) ? '<a href="' + esc(s.url) + '">' + esc(s.title || s.url) + '</a>' : esc(s.title)) + (s.publisher ? ', ' + esc(s.publisher) : '') + '</li>').join('') + '</ol></section>\n' : '')
    + '</article>\n</main>\n</body>\n</html>\n';
}
export function articleMarkdown(a) {
  const out = ['# ' + (a.title || 'Untitled article')];
  if (a.subtitle) out.push('_' + a.subtitle + '_');
  if (a.author && a.author.name) out.push('By ' + a.author.name + (a.author.title ? ', ' + a.author.title : ''));
  if (a.image && a.image.src) out.push('![' + (a.image.alt || '') + '](' + a.image.src + ')');
  if (a.intro) out.push(a.intro);
  (a.sections || []).forEach((s) => { out.push((s.level === 3 ? '### ' : '## ') + s.heading); if (s.body) out.push(s.body); });
  if (a.conclusion) out.push('## Conclusion', a.conclusion);
  if (a.cta && (a.cta.text || a.cta.label)) out.push('## Call to Action', [a.cta.text, a.cta.label ? (isUrl(a.cta.url) ? '[' + a.cta.label + '](' + a.cta.url + ')' : a.cta.label) : ''].filter(Boolean).join('\n\n'));
  const src = (a.sources || []).filter((x) => x && (x.title || x.url)); if (src.length) out.push('## Sources', src.map((s) => '- ' + (isUrl(s.url) ? '[' + (s.title || s.url) + '](' + s.url + ')' : s.title) + (s.publisher ? ', ' + s.publisher : '')).join('\n'));
  return out.join('\n\n') + '\n';
}
export function articleText(a) {
  return articleMarkdown(a).replace(/^#{1,3}\s+/gm, '').replace(/^_(.+)_$/gm, '$1').replace(/!\[([^\]]*)\]\([^)]*\)/g, '').replace(LINK, '$1 ($2)').replace(/\n{3,}/g, '\n\n');
}
// Word: an HTML document Word opens (.doc), with real headings so Word's navigation and styles work.
export function articleWord(a, brand = {}) {
  return articleHtml(a, brand).replace('<html lang="en">', '<html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">');
}

// The article as a production-review content object (pilot-dash production-review/checks-editorial.js).
export function contentObject(a) {
  const el = (id, text, kind = 'paragraph') => ({ id, kind, text });
  const secs = [{ key: 'intro', title: 'Introduction', elements: [el('title', a.title, 'heading'), el('intro', a.intro)] }]
    .concat((a.sections || []).map((s) => ({ key: s.key || s.id, title: s.heading, status: s.approved ? 'kept' : '', elements: [el(s.id, s.body)] })))
    .concat([{ key: 'conclusion', title: 'Conclusion', elements: [el('conclusion', a.conclusion)] }, { key: 'cta', title: 'Call to action', elements: [el('cta', [a.cta && a.cta.text, a.cta && a.cta.label].filter(Boolean).join(' '))] }]);
  return { sections: secs.filter((s) => s.elements.some((e) => str(e.text).trim())) };
}
