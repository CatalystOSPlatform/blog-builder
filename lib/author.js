// Blog Builder — who an article is from (Erika, Oct 29: "change the blog so it's from a founder or the company voice").
// Pure functions (browser and Node tests). The people come from Brand Command → Founders & Leadership (pilot-dash
// founder-voice.js authorsFor: { id, name, title, photoUrl, approved, hasVoice, reason }).
//
// One rule holds everywhere: the byline and the voice are the same choice.
//   Company voice → author { name: '', title: '' }: no byline, no personId, written in the company voice.
//   A person      → author { name, title, personId }: their byline. CatalystOS writes as them (voiceOf: personId) only
//                   when they are approved for writing; until then I'll Make This Myself works and nothing is written.

export const COMPANY = 'company';
const str = (v) => (v == null ? '' : String(v));
const key = (s) => str(s).trim().toLowerCase();

// ---------- status ----------
// { ready, label, reason } in plain words. Status is always text, never color alone.
export function statusOf(p) {
  if (!p) return { ready: false, label: 'Voice not ready yet', reason: 'Not in Founders & Leadership yet' };
  if (p.approved) return { ready: true, label: 'Ready', reason: '' };
  return { ready: false, label: 'Voice not ready yet', reason: p.reason || (p.hasVoice === false ? 'No voice profile yet' : 'Not approved for writing yet') };
}
export const firstName = (n) => str(n).trim().split(/\s+/)[0] || '';
export const possessive = (n) => { const t = str(n).trim(); return t ? t + (/s$/i.test(t) ? '’' : '’s') : ''; };
export const initials = (n) => str(n).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// ---------- the choice ⇄ the article's author ----------
export const pickOf = (author) => (author && author.personId ? author.personId : COMPANY);
export function personFor(author, people) {
  if (!author || !(author.personId || author.name)) return null;
  const list = people || [];
  return list.find((p) => author.personId && p.id === author.personId) || (!author.personId ? list.find((p) => key(p.name) === key(author.name)) || null : null);
}
// The author for a pick: the company voice clears the byline and the personId.
export function authorFor(pick, people) {
  if (!pick || pick === COMPANY) return { name: '', title: '' };
  const p = (people || []).find((x) => x.id === pick);
  return p ? { name: p.name, title: p.title || '', personId: p.id } : { name: '', title: '' };
}
// An article saved before the byline and the voice were one choice: a byline naming someone in Founders & Leadership gets
// their personId (so it is written as them, or blocked until they are approved). Returns the same author when nothing changes.
export function reconcile(author, people) {
  if (!author || author.personId || !author.name || !people || !people.length) return author;
  const p = people.find((x) => key(x.name) === key(author.name)); return p ? { ...author, personId: p.id } : author;
}
export const sameAuthor = (a, b) => pickOf(a) === pickOf(b) && key(a && a.name) === key(b && b.name);

// What stops CatalystOS writing as this author: '' (the company voice, or a person approved for writing) or the reason.
// people === null: not loaded yet (the shared writer refuses a person who is not approved anyway).
export function blockReason(author, people) {
  if (!author || (!author.personId && !author.name)) return '';
  if (people === null || people === undefined) return '';
  const p = personFor(author, people);
  if (!author.personId && !p) return 'Not in Founders & Leadership yet';
  const s = statusOf(p); return s.ready ? '' : s.reason;
}
export const isCompany = (author) => !author || (!author.personId && !author.name);
export const voiceName = (author) => (isCompany(author) ? 'the company voice' : possessive(author.name) + ' voice');
export const workingTitle = (author) => 'Rewriting in ' + voiceName(author);

// The plain note under a person who is not ready yet.
export function notReadyNote(p, reason) {
  const n = p ? p.name : 'This person', f = firstName(n) || n;
  return n + ': ' + (reason || statusOf(p).reason) + '. You can still make this yourself with ' + possessive(f) + ' byline. CatalystOS writes as ' + f + ' once they are approved for writing in Brand Command → Founders & Leadership.';
}

// Brand Command → Founders & Leadership on the person's profile (founders-panel.js reads #founders=<id>).
export function profileUrl({ base, clientId = '', orgId = '', personId = '' } = {}) {
  const q = new URLSearchParams(); if (orgId) q.set('org', orgId); if (clientId) q.set('client', clientId);
  return str(base) + 'Brand%20Command%20Center.dc.html' + (q.toString() ? '?' + q.toString() : '') + '#founders' + (personId ? '=' + encodeURIComponent(personId) : '');
}

// ---------- the brief: a person's approved perspectives, facts and topics as client content ----------
// k: { perspectives: [text], facts: [text], topics: [text] } (lib/data.js authorKnowledge).
export function knowledgeText(name, k) {
  if (!k) return '';
  const L = (label, a, n) => ((a || []).filter(Boolean).length ? label + ':\n' + a.filter(Boolean).slice(0, n).map((x) => '- ' + x).join('\n') : '');
  const parts = [L('Their perspectives', k.perspectives, 8), L('Facts about them', k.facts, 10), L('Topics they speak on', k.topics, 8)].filter(Boolean);
  return parts.length ? 'From ' + possessive(name) + ' approved profile (Founders & Leadership):\n' + parts.join('\n') : '';
}
export function briefAuthor(author) { return isCompany(author) ? { kind: COMPANY } : { kind: 'person', personId: author.personId || '', name: author.name, title: author.title || '' }; }

// ---------- versions: Rewrite All keeps the article as it was, so the person can switch back ----------
const FIELDS = ['author', 'title', 'subtitle', 'intro', 'sections', 'conclusion', 'cta', 'sources', 'review'];
const clone = (x) => JSON.parse(JSON.stringify(x == null ? null : x));
export const MAX_VERSIONS = 5;
let vn = 0;
export function snapshot(a, label, now = Date.now()) { const s = { id: 'v' + now.toString(36) + (++vn), at: now, label: str(label) }; FIELDS.forEach((k) => { s[k] = clone(a[k]); }); return s; }
export function pushVersion(a, label, now = Date.now()) { return { ...a, versions: [snapshot(a, label, now)].concat(a.versions || []).slice(0, MAX_VERSIONS) }; }
// Switch to an earlier version: the article as it is now becomes a version too, so switching is never a loss.
export function restoreVersion(a, id, now = Date.now()) {
  const v = (a.versions || []).find((x) => x.id === id); if (!v) return a;
  const cur = snapshot(a, 'Before switching back', now);
  const out = { ...a }; FIELDS.forEach((k) => { if (v[k] !== undefined && v[k] !== null) out[k] = clone(v[k]); else if (k === 'review') out.review = null; });
  out.brief = out.brief ? { ...out.brief, author: briefAuthor(out.author) } : out.brief;
  out.versions = [cur].concat((a.versions || []).filter((x) => x.id !== id)).slice(0, MAX_VERSIONS);
  return out;
}
export function hasText(a) { return !!a && [a.intro, a.conclusion, a.cta && a.cta.text].concat((a.sections || []).map((s) => s.body)).some((t) => str(t).trim()); }

// ---------- changing who it is from on an article that has text ----------
// byline: only the byline (and personId) change. rewrite: the plan for the writer — the article with the new author and
// the earlier version kept, and the guidance (the outline, facts and sources stay; the person's own edits steer it).
export function withAuthor(a, author) { return { ...a, author: { ...author }, brief: a.brief ? { ...a.brief, author: briefAuthor(author) } : a.brief }; }
export function rewriteGuidance(a) {
  const secs = (a.sections || []).filter((s) => str(s.body).trim() || str(s.heading).trim());
  const mine = secs.filter((s) => s.by === 'person' && str(s.body).trim());
  return ['REWRITE IN THE NEW VOICE: this article already exists. Rewrite all of it in the voice named in the byline above. Keep the same outline (the same sections, in the same order), the same facts, the same sources and the same call to action. Change the voice and wording, not the substance. Add no new facts.',
    mine.length ? 'The person edited these sections themselves; keep what they say and their points: ' + mine.map((s) => '“' + (s.heading || 'Untitled') + '”').join(', ') + '.' : '',
    'THE CURRENT ARTICLE (source material):', '# ' + str(a.title), a.subtitle ? '_' + a.subtitle + '_' : '', str(a.intro),
    ...secs.map((s) => (s.level === 3 ? '### ' : '## ') + str(s.heading) + (s.by === 'person' ? ' (edited by the person)' : '') + '\n' + str(s.body)),
    a.conclusion ? '## Conclusion\n' + a.conclusion : '', a.cta && a.cta.text ? '## Call to Action\n' + a.cta.text : ''].filter(Boolean).join('\n\n').slice(0, 12000);
}
export function rewritePlan(a, author, now = Date.now()) {
  const before = pushVersion(a, 'Before rewriting in ' + voiceName(author), now);
  return { article: withAuthor(before, author), guidance: rewriteGuidance(a), title: workingTitle(author) };
}
