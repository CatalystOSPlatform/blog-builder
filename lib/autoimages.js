// Blog Builder — images chosen automatically when an article is written or rewritten (Erika, Oct 30: "check the website
// and Brand Command for any images that match the topic and automatically use them where appropriate").
// Pure functions (browser and Node tests). No crawling: only what Brand Command already holds.
//
//   choose(article, { pool, raw, clientName }) → { lead: fill | null, inline: [figure], suggested: [{ src, title, sourcePage, why }], note }
//     pool: brand-photos.js pool(client) (approved Brand Command photos: no Found ones, no logos); raw: client.brandImages
//     (for tags, captions and source pages, and the website pictures still waiting for approval).
//
// Rules: approved Brand Command photos only are placed (a lead image under the title, then at most two in the article,
// after the first paragraph of the section they fit best). A website picture still marked Found (waiting for approval)
// is only suggested, never placed. Never a generated picture of people; a named person's photo only beside text about
// that person; never a picture showing another company's logo unless the article is about that company. Nothing fits:
// nothing is placed and the note says so. Captions only from Brand Command (never written here).

import { newFigure } from './figures.js';

const str = (v) => (v == null ? '' : String(v));
const STOP = new Set('about above after again against also among another because been before being below between both but came come could does doing down during each even every from further have having here how into just like made make many more most much must near never only other over said same should since some such than that their them then there these they this those through under until upon very want were what when where which while will with within would your yours ours image photo picture jpeg png file img copy final edit large small new use using used article blog post page www http https com html'.split(' '));
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/(.)\1$/, '$1');
export function tokens(text) { const out = new Set(); str(text).toLowerCase().replace(/https?:\/\/[^\s/]+/g, ' ').split(/[^a-z0-9]+/).forEach((w) => { if (w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)) out.add(stem(w)); }); return out; }
const pathWords = (u) => { try { return decodeURIComponent(new URL(u).pathname).replace(/[-_/.]+/g, ' '); } catch (e) { return ''; } };
const has = (text, name) => { const n = str(name).trim().toLowerCase(); return n.length > 2 && str(text).toLowerCase().includes(n); };
export const NONE_NOTE = 'No matching images found. Add one.';
const LOGO = /\b(logo|logos|logotype|wordmark|signage|sponsor|sponsors)\b/i;

function rawFor(p, raw) { return (raw || []).find((r) => r && ((p.id && String(r.id) === p.id) || (r.url && r.url === p.src) || (r.webUrl && r.webUrl === p.src))) || {}; }
// The words that say what a picture shows: tags, category, caption, alt, title, who it shows and the page it came from.
function wordsOf(p, r) {
  const tags = Array.isArray(r.tags) ? r.tags.join(' ') : r.tags && typeof r.tags === 'object' ? Object.keys(r.tags).filter((k) => r.tags[k]).join(' ') : '';
  return [p.words, r.caption, r.alt, r.title, r.description, r.category, r.shows, r.personSuggested, r.person, tags, pathWords(r.sourcePage), r.docName].filter(Boolean).join(' ');
}
// Another company's mark in the picture (its tags or words), unless the article is about that company.
function otherLogo(r, words, articleText, clientName) {
  const names = [].concat(r.companies || [], r.brands || [], r.logoOf || []).map(str).filter(Boolean);
  if (names.some((n) => !has(clientName, n) && !has(articleText, n))) return true;
  return LOGO.test(words) && !(clientName && has(words, clientName));
}
function score(t, ctx, head) { let s = 0; t.forEach((w) => { if (head.has(w)) s += 2; else if (ctx.has(w)) s += 1; }); return s; }

export function choose(a, { pool = [], raw = [], clientName = '', max = 2 } = {}) {
  const text = (x) => [x.heading, x.body].join('\n');
  const all = [a.title, a.subtitle, a.intro, a.conclusion].concat((a.sections || []).map(text)).join('\n');
  const leadHead = tokens([a.title, a.brief && a.brief.topic, a.brief && a.brief.workingTitle, a.campaignName].join(' ')), leadCtx = tokens([a.subtitle, a.intro].join(' '));
  const cands = pool.filter((p) => p && p.src && !p.ai && p.source !== 'logo').map((p) => { const r = rawFor(p, raw); const words = wordsOf(p, r); return { p, r, words, t: tokens(words), person: str(p.person || r.person || r.personSuggested).trim(), people: !!p.people }; })
    .filter((c) => !otherLogo(c.r, c.words, all, clientName))
    .filter((c) => !(c.r.found || c.r.aiGenerated || c.r.generated));
  // a named person only beside text about them; a group photo of people only when the text is about people
  const fits = (c, txt) => (c.person ? has(txt, c.person) || has(txt, c.person.split(/\s+/).slice(-1)[0]) : !c.people || /\b(team|staff|advisors?|people|colleagues|clients?|families|members?)\b/i.test(txt));
  const used = new Set();
  // lead image (only when the article has none)
  let lead = null;
  if (!(a.image && a.image.src)) {
    const leadTxt = [a.title, a.subtitle, a.intro].join('\n');
    const best = cands.filter((c) => fits(c, leadTxt)).map((c) => ({ c, s: score(c.t, leadCtx, leadHead) + (c.person && has(leadTxt, c.person) ? 3 : 0) })).filter((x) => x.s >= 2).sort((x, y) => y.s - x.s)[0];
    if (best) { used.add(best.c.p.src); lead = { src: best.c.p.src, alt: str(best.c.p.alt || best.c.r.alt).trim(), caption: str(best.c.r.caption).trim(), photoId: best.c.p.id || '', auto: true, why: whyOf(best.c, leadHead, leadCtx) }; }
  }
  // inline: the best section for each remaining picture, one picture per section, at most `max`
  const rows = [];
  (a.sections || []).forEach((s) => { const head = tokens(s.heading), ctx = tokens(s.body), txt = text(s); if (!str(s.body).trim()) return;
    cands.forEach((c) => { if (used.has(c.p.src) || !fits(c, txt)) return; const sc = score(c.t, ctx, head) + (c.person && has(txt, c.person) ? 3 : 0); if (sc >= 3) rows.push({ c, s, sc, head, ctx }); }); });
  rows.sort((x, y) => y.sc - x.sc);
  const inline = []; const secs = new Set();
  for (const r of rows) { if (inline.length >= max) break; if (used.has(r.c.p.src) || secs.has(r.s.id)) continue; used.add(r.c.p.src); secs.add(r.s.id);
    inline.push({ kind: 'image', origin: 'brand', auto: true, src: r.c.p.src, alt: str(r.c.p.alt || r.c.r.alt).trim(), altReview: !str(r.c.p.alt || r.c.r.alt).trim(), caption: str(r.c.r.caption).trim(), photoId: r.c.p.id || '', at: { where: r.s.id, after: 1 }, size: 'full', align: 'center', why: whyOf(r.c, r.head, r.ctx) }); }
  // website pictures waiting for approval in Brand Command: suggested only
  const allT = tokens(all), headT = tokens(a.title);
  const suggested = (raw || []).filter((r) => r && r.found && (r.url || r.webUrl) && r.rights !== 'permission' && /website|web/i.test(str(r.category) + ' ' + str(r.origin) + ' ' + str(r.source)) && !r.aiGenerated)
    .map((r) => { const words = wordsOf({}, r); return { r, words, sc: score(tokens(words), allT, headT) }; })
    .filter((x) => x.sc >= 3 && !otherLogo(x.r, x.words, all, clientName) && !(str(x.r.personSuggested || x.r.person) && !has(all, x.r.personSuggested || x.r.person)))
    .sort((x, y) => y.sc - x.sc).slice(0, 3)
    .map((x) => ({ src: x.r.thumbnail || x.r.url || x.r.webUrl, title: str(x.r.caption || x.r.alt || x.r.title || 'Picture from your website').trim(), sourcePage: str(x.r.sourcePage), id: str(x.r.id) }));
  const placed = (lead ? 1 : 0) + inline.length;
  const note = placed ? 'CatalystOS added ' + (lead ? 'a lead image' + (inline.length ? ' and ' : '') : '') + (inline.length ? inline.length + ' image' + (inline.length === 1 ? '' : 's') + ' in the article' : '') + ' from Brand Command. Each says “Chosen automatically”: change or remove any of them.' : NONE_NOTE;
  return { lead, inline, suggested, note, placed };
}
function whyOf(c, head, ctx) { const hit = [...c.t].filter((w) => head.has(w) || ctx.has(w)).slice(0, 4); return hit.length ? 'Matches: ' + hit.join(', ') : ''; }
// Applied to a freshly written article: earlier automatic picks are replaced, the person's own pictures are kept.
export function apply(a, res) {
  const out = { ...a };
  const mine = (a.figures || []).filter((f) => !f.auto);
  out.figures = mine.concat(res.inline.map(({ why, ...f }) => newFigure(f)));
  if (res.lead) { const { why, ...l } = res.lead; out.image = { src: l.src, alt: l.alt, altReview: !l.alt, auto: true, caption: l.caption || '' }; if (out.seo) out.seo = { ...out.seo, imageAltText: l.alt }; }
  else if (a.image && a.image.auto && !res.lead) out.image = a.image; // kept: nothing better found
  out.autoImages = { at: Date.now(), note: res.note, placed: res.placed, suggested: res.suggested };
  return out;
}
