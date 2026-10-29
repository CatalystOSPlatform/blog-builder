// Blog Builder — topic ideas for the current campaign (Erika, Oct 29: "Blog builder: suggest topics based on the existing
// campaign"). One quick model request (Haiku, through the dashboard's /api/claude) suggests 4 to 6 ideas for the article
// type that is open, from the campaign, its Campaign Strategy, the verified research, Brand Command (content pillars,
// personas) and the client's own voice, avoiding what the client has already written.
//
// Rules, enforced in code after the model answers (never trusted to the prompt alone):
//   - No invented facts. A number, percentage, dollar figure or "million"/"percent" in an idea must come from a verified
//     research fact the idea cites (R1, R2…); otherwise the idea is dropped. A cited fact must exist.
//   - Real news only. Company News (and Product Announcement, Event Recap) ideas must quote the update from the campaign
//     or Brand Command word for word; when nothing real is there, the list says so plainly instead of inventing news.
//   - Plain words: no CatalystOS agent names, never "scraped", no spaced dashes, none of the common AI wording.
//   - No repeats of the client's saved articles, approved content, or ideas already shown.
// Plain data and pure functions plus an injected `complete` and storage: works in the browser and in Node tests.

export const TOPIC_MODEL = 'claude-haiku-4-5';
export const NO_CAMPAIGN = 'Pick a campaign at the top to see topic ideas';
export const CACHE_DAYS = 14;
export const SHOW = { min: 4, max: 6, first: 6, more: 4, cap: 12 };

const str = (v) => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'object' && typeof v.text === 'string' ? v.text : String(v));
const cap = (s, n) => { s = str(s).trim(); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; };
const norm = (s) => str(s).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9%$'.]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => new Set(norm(s).replace(/[.'%$]/g, ' ').split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'you', 'our', 'how', 'why', 'what', 'when', 'from', 'that', 'this', 'are', 'can', 'into', 'about', 'its', 'who', 'need', 'needs']);

// Types whose ideas must come from real updates the client has shared (never invented news).
export const NEWS_TYPES = {
  'company-news': { what: 'company news (a new hire, a launch, an award, a partnership, a milestone)', none: 'This campaign and Brand Command don’t mention any company news yet (a new hire, a launch, an award, a milestone), so there’s nothing real to announce. Add the update to the campaign or Brand Command, or write it in the Topic box.' },
  'product-announcement': { what: 'a product or service the company is launching or has changed', none: 'This campaign and Brand Command don’t mention a product or service launch, so there’s nothing real to announce. Add the launch details to the campaign or Brand Command, or write them in the Topic box.' },
  'event-recap': { what: 'an event the company held, spoke at or attended', none: 'This campaign and Brand Command don’t mention an event the company held or attended, so there’s nothing real to recap. Add the event to the campaign or Brand Command, or write it in the Topic box.' },
};

// Words that must never reach the screen (agent persona names, "scraped") and the common AI wording (voice-profile.js
// SEED_AVOID). An idea that still has a banned word after the dash clean-up is dropped.
export const BANNED = /\bStrategist\b|\bSenior Writer\b|\bscrap(?:e|ed|es|ing)\b|\bdelve|\bmanifests\b|\bdevolve|\bsystemic\b|in today[’']s fast-paced|perhaps most significantly/i;

// ---------- the prompt ----------
// ctx: { clientName, type {id,label,purpose,audience,evidence}, campaign {id,name,goal,…, piecePlan}, campaignText,
//   research (lib/data.js campaignResearch: version, state, core, positioning, angle, audience, pillars, blog,
//   deliverables, cta, facts), personas [names], personasText, pillars (Brand Command content pillars text), kb (Brand
//   Command text), voice (the approved company voice, optional), titles (already written), shown (ideas on screen) }
export function factList(research) { return ((research && research.facts) || []).map((f, i) => ({ id: 'R' + (i + 1), fact: str(f.fact), attribution: str(f.attribution || f.publisher) })); }
export function strategyText(r) {
  if (!r) return 'No Campaign Strategy yet.';
  const L = ['Campaign Strategy v' + r.version + ' (' + (r.state === 'approved' ? 'approved' : 'draft') + ')',
    r.positioning && 'Positioning: ' + r.positioning, r.core && 'Core message: ' + r.core, r.angle && 'Recommended angle: ' + r.angle,
    (r.pillars || []).length && 'Message pillars: ' + r.pillars.join(' | '), r.audience && 'For the audience: ' + r.audience,
    r.blog && 'Guidance for blog articles: ' + r.blog,
    (r.deliverables || []).length && 'Planned articles:\n' + r.deliverables.map((d) => '- ' + [d.deliverable, d.angle, d.purpose].filter(Boolean).join(': ')).join('\n'),
    r.cta && 'Call to action: ' + r.cta];
  return L.filter(Boolean).join('\n');
}
export function piecePlanText(c) {
  const pp = (c && c.piecePlan) || null; if (!pp) return '';
  const items = (pp.items || []).filter((x) => x && /blog|article/i.test(str(x.kind) + ' ' + str(x.label) + ' ' + str(x.title)));
  return [pp.summary && 'Plan: ' + cap(pp.summary, 600), ...items.map((x) => '- ' + [x.title || x.label || x.kind, x.why].filter(Boolean).map(str).join(': '))].filter(Boolean).join('\n');
}
export function buildPrompt(ctx, { count = SHOW.first } = {}) {
  const T = ctx.type || {}; const news = NEWS_TYPES[T.id]; const facts = factList(ctx.research);
  const system = 'You suggest blog article topics for ' + (ctx.clientName || 'the client') + ', in the company’s own voice. '
    + 'Facts come only from what you are given. Never invent statistics, percentages, dollar figures, studies, quotes, people, clients, awards, launches or news. '
    + 'An idea may use an outside fact ONLY if it is in VERIFIED RESEARCH, and then it must list that fact’s id (R1, R2…) in "facts". Ideas without a fact use no numbers except a small count in a list headline (such as "5 Questions to Ask"). '
    + 'Use plain, everyday words a busy client would use. No jargon, no hype. Never write "scraped". Never name internal team roles or job titles of the AI. No spaced dashes; use a colon or a comma. Avoid: delve, systemic, manifests, devolve, "in today’s fast-paced".'
    + (news ? ' THIS ARTICLE TYPE IS ' + T.label.toUpperCase() + ': every idea must be about ' + news.what + ' that the CAMPAIGN or BRAND COMMAND below actually states, and must copy the words that state it into "evidence" exactly. If they state none, return no ideas and say so in "note".' : '');
  const parts = [
    '## ARTICLE TYPE: ' + (T.label || 'Blog article') + '\nPurpose: ' + str(T.purpose) + (T.audience ? '\nUsual reader: ' + str(T.audience) : '') + (T.evidence ? '\nEvidence it needs: ' + str(T.evidence) : ''),
    '## CAMPAIGN\n' + (ctx.campaignText || '(none)') + (piecePlanText(ctx.campaign) ? '\n' + piecePlanText(ctx.campaign) : ''),
    '## CAMPAIGN STRATEGY\n' + strategyText(ctx.research),
    '## VERIFIED RESEARCH (the only outside facts allowed)\n' + (facts.length ? facts.map((f) => '[' + f.id + '] ' + f.fact + ' (' + f.attribution + ')').join('\n') : 'None. Use no outside facts or figures.'),
    '## PERSONAS (Brand Command)\n' + (ctx.personasText || (ctx.personas || []).map((p) => '- ' + p).join('\n') || '(none)'),
    ctx.pillars ? '## CONTENT PILLARS (Brand Command)\n' + cap(ctx.pillars, 1500) : '',
    '## BRAND COMMAND\n' + cap(ctx.kb || '', 6000),
    ctx.voice ? '## THE COMPANY’S VOICE (style only, never a source of facts)\n' + cap(ctx.voice, 1500) : '',
    (ctx.titles || []).length ? '## ALREADY WRITTEN (do not repeat these topics)\n' + ctx.titles.slice(0, 60).map((t) => '- ' + cap(t, 140)).join('\n') : '',
    (ctx.shown || []).length ? '## ALREADY SUGGESTED (give different ideas)\n' + ctx.shown.map((t) => '- ' + t).join('\n') : '',
  ].filter(Boolean);
  const ask = 'Suggest ' + count + ' blog topic ideas for this ' + (T.label || 'article') + ' that serve this campaign. Each idea fits the article type’s purpose, follows the campaign strategy, and is new for this client.\n'
    + 'Return ONLY JSON: {"ideas":[{"headline":"working headline, under 12 words, in the company’s voice","angle":"one sentence: the specific angle for this ' + (T.label || 'article') + '","why":"one short sentence: why it serves the campaign (its goal, a key message, a pillar, a persona or a research fact)","basis":"goal|message|pillar|persona|fact' + (news ? '|news' : '') + '","persona":"exact persona name from PERSONAS, or empty","facts":["R1"],"evidence":"' + (news ? 'the exact words from CAMPAIGN or BRAND COMMAND that state the update' : 'empty') + '"}],"note":"empty, or one plain sentence if no good ideas fit"}';
  return { system, messages: [{ role: 'user', content: parts.join('\n\n') + '\n\n' + ask }] };
}

// ---------- checking what came back ----------
export const readJson = (t) => { const c = String(t || '').replace(/```json|```/gi, '').trim(); try { return JSON.parse(c); } catch (e) {} const a = c.search(/[[{]/), b = Math.max(c.lastIndexOf(']'), c.lastIndexOf('}')); if (a >= 0 && b > a) { try { return JSON.parse(c.slice(a, b + 1)); } catch (e) {} } return null; };
// Figures that would be a factual claim: any %, $, a number of 13 or more that is not a year, decimals, or the words
// percent / million / billion / "one in five"-style ratios. Small counts ("5 Questions") and years are not claims.
export function claimFigures(s) {
  const t = str(s); const out = [];
  for (const m of t.matchAll(/\$\s?\d[\d,.]*(?:\s?(?:k|m|bn|million|billion|thousand))?|\d[\d,.]*\s?(?:%|percent\b|per cent\b)|\d+\.\d+|\d[\d,]*/gi)) {
    const x = m[0]; const n = Number(x.replace(/[^\d.]/g, ''));
    if (/^\(k\)/i.test(t.slice(m.index + x.length))) continue; // a plan name like 401(k), not a figure
    if (/[$%]|percent|per cent/i.test(x) || /\d\.\d/.test(x)) { out.push(x); continue; }
    if (/^(19|20)\d\d$/.test(x.replace(/,/g, '')) ) continue; // a year
    if (n >= 13) out.push(x);
  }
  for (const m of t.matchAll(/\b(?:million|billion|trillion|percent|per cent|majority|(?:one|two|three|four|five|six|seven|eight|nine) in (?:two|three|four|five|six|seven|eight|nine|ten|\d+))\b/gi)) out.push(m[0]);
  return out;
}
const figKey = (x) => str(x).toLowerCase().replace(/\s+/g, '').replace(/per ?cent/g, '%').replace(/,/g, '');
function supported(fig, factTexts) { const k = figKey(fig); const digits = k.replace(/[^\d.]/g, ''); return factTexts.some((f) => { const fk = figKey(f); return fk.includes(k) || (digits && fk.replace(/[^\d.%]/g, ' ').split(/\s+/).some((n) => n.replace(/%$/, '') === digits)); }); }
const tidy = (s, head) => str(s).replace(/\s+[—–-]\s+/g, head ? ': ' : ', ').replace(/\s+/g, ' ').replace(/^["“]+|["”]+$/g, '').trim();
export function similar(a, b) { const A = words(a), B = words(b); if (!A.size || !B.size) return false; let n = 0; A.forEach((w) => { if (B.has(w)) n++; }); return n / Math.min(A.size, B.size) >= 0.7 && n >= 2; }

// raw: the model's text. Returns { ideas: [{ id, headline, angle, why, basis, persona, facts:[{id,fact,attribution}], evidence }], note, dropped }.
export function checkIdeas(raw, ctx, { max = SHOW.max } = {}) {
  const j = typeof raw === 'string' ? readJson(raw) : raw; const T = ctx.type || {}; const news = NEWS_TYPES[T.id];
  const facts = factList(ctx.research); const byId = new Map(facts.map((f) => [f.id, f]));
  const personas = (ctx.personas || []).map(str).filter(Boolean);
  const sourceText = norm([ctx.campaignText, piecePlanText(ctx.campaign), ctx.kb, ctx.pillars].filter(Boolean).join('\n'));
  const avoid = (ctx.titles || []).concat(ctx.shown || []);
  const dropped = []; const out = [];
  for (const x of ((j && Array.isArray(j.ideas)) ? j.ideas : [])) {
    if (!x || typeof x !== 'object') continue;
    const idea = { headline: tidy(x.headline, true), angle: tidy(x.angle), why: tidy(x.why), basis: str(x.basis).toLowerCase().trim(), persona: '', facts: [], evidence: str(x.evidence).trim() };
    if (!idea.headline || !idea.angle) { dropped.push({ idea, reason: 'incomplete' }); continue; }
    const ids = (Array.isArray(x.facts) ? x.facts : []).map((v) => str(v).toUpperCase().replace(/[^R\d]/g, '')).filter(Boolean);
    if (ids.some((id) => !byId.has(id))) { dropped.push({ idea, reason: 'cites a fact that is not in the verified research' }); continue; }
    idea.facts = [...new Set(ids)].map((id) => byId.get(id));
    if (idea.basis === 'fact' && !idea.facts.length) { dropped.push({ idea, reason: 'says it rests on a fact but cites none' }); continue; }
    const text = [idea.headline, idea.angle, idea.why].join(' ');
    const figs = claimFigures(text).filter((f) => !supported(f, idea.facts.map((ff) => ff.fact)));
    if (figs.length) { dropped.push({ idea, reason: 'figure not in the verified research: ' + figs.join(', ') }); continue; }
    if (BANNED.test(text)) { dropped.push({ idea, reason: 'banned wording' }); continue; }
    if (news) { const ev = norm(idea.evidence); if (ev.length < 8 || !sourceText.includes(ev)) { dropped.push({ idea, reason: 'news not stated in the campaign or Brand Command' }); continue; } }
    if (avoid.some((t) => similar(t, idea.headline)) || out.some((o) => similar(o.headline, idea.headline))) { dropped.push({ idea, reason: 'repeats existing work' }); continue; }
    const p = personas.find((n) => n.toLowerCase() === str(x.persona).toLowerCase().trim()); if (p) idea.persona = p;
    if (!idea.why) idea.why = idea.persona ? 'Written for ' + idea.persona + '.' : 'Supports the campaign’s key message.';
    if (idea.facts.length) idea.source = idea.facts.map((f) => f.attribution).filter(Boolean).join('; ');
    idea.id = 't' + hash(idea.headline);
    out.push(idea); if (out.length >= max) break;
  }
  let note = cap(tidy(j && j.note), 300); if (BANNED.test(note)) note = '';
  if (!out.length && news) note = news.none;
  else if (!out.length && !note) note = 'No new ideas fit this campaign right now. Write your own topic, or try again.';
  else if (out.length) note = '';
  return { ideas: out, note, dropped };
}
function hash(s) { let h = 5381; s = str(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

// ---------- what clicking an idea fills ----------
// The Topic box gets the headline and its angle; Audience gets the idea's persona only when Audience is empty.
export const ideaTopic = (idea) => (idea ? idea.headline.replace(/[.!?]+$/, '') + '. ' + idea.angle : '');
export function applyIdea(idea, { topic = '', aud = '' } = {}) {
  if (!idea) return { topic, aud };
  return { topic: ideaTopic(idea), aud: !str(aud).trim() && idea.persona ? idea.persona : aud };
}

// ---------- cache: per client + campaign + article type, so coming back costs nothing ----------
export const cacheKey = (clientId, campaignId, typeId) => [clientId || '', campaignId || '', typeId || 'blank'].join('|');
export function makeCache(storage, prefix = 'cos-blog-builder:topic-ideas', { days = CACHE_DAYS, now = () => Date.now() } = {}) {
  const mem = new Map(); const sk = (key) => prefix + ':' + key.split('|')[0];
  const all = (key) => { try { return JSON.parse((storage && storage.getItem(sk(key))) || '{}') || {}; } catch (e) { return {}; } };
  return {
    get(key) { let v = mem.get(key); if (!v) { v = all(key)[key] || null; if (v) mem.set(key, v); } return v && now() - (v.at || 0) < days * 86400000 ? v : null; },
    set(key, v) { const rec = { ...v, at: v.at || now() }; mem.set(key, rec); try { const a = all(key); a[key] = rec; storage && storage.setItem(sk(key), JSON.stringify(a)); } catch (e) {} return rec; },
    clear(key) { mem.delete(key); try { const a = all(key); delete a[key]; storage && storage.setItem(sk(key), JSON.stringify(a)); } catch (e) {} },
  };
}

// ---------- one call: cached, more, refresh ----------
// complete(body) → the model's text. mode: 'first' (cached when there is one), 'more' (adds ideas), 'refresh' (new list).
export async function ideasFor(ctx, { complete, cache, key, mode = 'first' } = {}) {
  if (!ctx || !ctx.campaign) return { state: 'no-campaign', ideas: [], note: NO_CAMPAIGN };
  const hit = cache && key ? cache.get(key) : null;
  if (mode === 'first' && hit) return { ...hit, state: 'ready', cached: true };
  const prev = mode === 'more' && hit ? hit.ideas || [] : [];
  const c2 = { ...ctx, shown: prev.map((i) => i.headline) };
  const body = buildPrompt(c2, { count: mode === 'more' ? SHOW.more + 1 : SHOW.first });
  const text = await complete({ model: TOPIC_MODEL, max_tokens: 1600, ...body });
  const r = checkIdeas(text, c2, { max: mode === 'more' ? SHOW.more : SHOW.max });
  const ideas = prev.concat(r.ideas).slice(0, SHOW.cap);
  const note = r.ideas.length ? '' : prev.length ? 'No new ideas this time. Pick one above or write your own topic.' : r.note;
  const rec = { ideas, note, version: (ctx.research && ctx.research.version) || 0, campaign: ctx.campaign.name || '' };
  const saved = cache && key ? cache.set(key, rec) : { ...rec, at: Date.now() };
  return { ...saved, state: 'ready', cached: false, added: r.ideas.length, dropped: r.dropped };
}
