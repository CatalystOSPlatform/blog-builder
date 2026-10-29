// Blog Builder — data layer.
// Live: signs in with CatalystOS, reads the client's Brand Command record (brand-connect.js on the dashboard site), saves each
// article under catalystos_clients/{clientId}/blogArticles/{articleId} in the CatalystOS article model
// (publishing/article-model.js), and writes through the shared Senior Writer (Brand.write: industry and specialty
// intelligence, claim checks, the editorial engine). Research is the Strategist's: the campaign's Campaign Strategy
// (approved version first), read only here. Preview (local test): a demo client saved in this browser only.
import { ARTICLE_TYPES, typeById, shapeText } from './article-types.js';
import { contentObject } from './article.js';
import * as TP from './topics.js';
import * as AU from './author.js';

export const PILOT = 'https://pilot-dash-ten.vercel.app/';
export const APP = 'blogbuilder';
export const APP_LABEL = 'Blog Builder';
export const OPEN_URL = 'https://blog-builder-cyan.vercel.app/';
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

export const PREVIEW = (() => { try { const h = location.hostname; return !(/vercel\.app$/i.test(h) || /catalyst/i.test(h) || h === 'localhost'); } catch (e) { return false; } })();

let Brand = null;
let BFM = null;
const BFP = import(PILOT + 'brand-fonts.js').then((m) => (BFM = m)).catch((e) => { console.warn('brand fonts', e); return null; });
const S = { clientId: null, brand: null, raw: null, orgId: null, user: null, ctx: { text: '', rules: '' } };

// ---------- start-up (same as every CatalystOS app) ----------
export async function init() {
  await Promise.race([BFP, new Promise((r) => setTimeout(r, 4000))]);
  if (PREVIEW) { const raw = demoRaw(); Object.assign(S, { clientId: 'demo', raw, brand: { name: raw.name, logos: {} }, ctx: { text: demoKb(raw), rules: '' } }); return { mode: 'preview', user: { email: 'you@agency.com' }, agency: 'McGuire Marketing', clientId: 'demo', clients: [{ id: 'demo', name: raw.name }] }; }
  let user = window.CatalystAuth ? await window.CatalystAuth.ready : null;
  for (let i = 0; !user && window.CatalystAuth && i < 40; i++) { await new Promise((r) => setTimeout(r, 150)); user = window.CatalystAuth.user(); }
  if (!user) { try { const fb = await import(PILOT + 'firebase-sync.js'); user = await fb.currentUser(); } catch (e) {} }
  if (!user) return { mode: 'signed-out' };
  Brand = await import(PILOT + 'brand-connect.js');
  try { Brand.showBackButton(true); } catch (e) {}
  const lp = Brand.launchParams ? Brand.launchParams() : {};
  S.orgId = lp.orgId || null;
  if (lp.clientId) { try { if (!(await Brand.hasAccess(lp.clientId, APP))) await Brand.setAccess(lp.clientId, APP, true); } catch (e) { console.warn('auto access', e); } }
  const conn = await Brand.connect({ app: APP });
  if (!conn) return { mode: 'no-client', user };
  return { ...(await useClient(conn.clientId, conn.brand)), user };
}
export async function switchClient(clientId) {
  if (PREVIEW) return null;
  try { if (!(await Brand.hasAccess(clientId, APP))) await Brand.setAccess(clientId, APP, true); } catch (e) {}
  const conn = await Brand.connect({ app: APP, clientId });
  return conn ? useClient(conn.clientId, conn.brand) : null;
}
async function useClient(clientId, brand) {
  S.clientId = clientId; S.brand = brand || {};
  S.ctx = await Brand.getContext(clientId, APP).catch(() => ({ text: '', rules: '' }));
  const clients = await Brand.listClients({ orgId: S.orgId || undefined }).catch(() => []);
  S.raw = (clients || []).find((c) => c.id === clientId) || { id: clientId };
  try { const fbm = await import(PILOT + 'firebase-sync.js'); const { f, db } = await fs(); const snap = await f.getDoc(f.doc(db, 'catalystos_clients', clientId)); if (snap.exists()) S.raw = { ...(fbm.unpack ? fbm.unpack(snap.data()) : snap.data()), id: clientId }; } catch (e) { console.warn('Full Brand Command record not loaded', e); }
  try { const ic = await import(PILOT + 'image-check.js'); if (ic.guardClient) S.raw = await ic.guardClient(S.raw, { maxMs: 15000 }); } catch (e) { console.warn('image check', e); S.raw = { ...S.raw, brandImages: [] }; }
  let agency = '';
  try { const fb = await import(PILOT + 'firebase-sync.js'); const o = S.orgId && (await fb.getOrganization(S.orgId)); agency = (o && o.name) || ''; S.user = await fb.currentUser(); } catch (e) {}
  return { mode: 'live', agency, clientId, clients: (clients || []).map((c) => ({ id: c.id, name: c.name })) };
}
export function dashboardUrl() { try { return Brand ? Brand.dashboardUrl(S.clientId) : PILOT + 'COS.dc.html'; } catch (e) { return PILOT + 'COS.dc.html'; } }
export function signOut() { try { window.CatalystAuth && window.CatalystAuth.signOut(); } catch (e) {} }
export function orgId() { return S.orgId || ''; }
export function clientRaw() { return S.raw || null; }
export function clientName() { return (S.raw && S.raw.name) || (S.brand && S.brand.name) || 'Client'; }
export function userEmail() { return (S.user && S.user.email) || ''; }

let fsP = null;
async function fs() { if (!fsP) fsP = (async () => { const appMod = await import(SDK + 'firebase-app.js'); const f = await import(SDK + 'firebase-firestore.js'); return { f, db: f.getFirestore(appMod.getApp()) }; })(); return fsP; }

// ---------- the brand, as the article preview uses it (Brand Command only; Designer conventions) ----------
export function articleBrand() {
  const c = S.raw || {}, b = S.brand || {};
  const cols0 = (c.colors || []).filter((x) => x && (x.value || x.hex));
  const byRole = (r) => cols0.filter((x) => x.role === r).map((x) => x.value || x.hex);
  const cols = byRole('primary').concat(byRole('secondary'), cols0.map((x) => x.value || x.hex)).filter((v, i, a) => a.indexOf(v) === i);
  const typo = (c.typography || []).filter((x) => x && x.fontFamily);
  const pick = (re) => (typo.find((x) => re.test(String(x.label || x.id || ''))) || {}).fontFamily;
  const R = BFM ? BFM.roles({ ...c, customFonts: b.customFonts }) : null;
  const head = (R && R.heading) || pick(/head|display|title|h1/i) || (typo[0] || {}).fontFamily || 'Manrope';
  const body = (R && R.body) || pick(/body|text|paragraph/i) || (typo[1] || {}).fontFamily || 'Inter';
  // Text colors: the brand's darkest color that reads at 4.5:1 on white for headings and links; body stays near-black.
  const dark = cols.filter((h) => contrast(h, '#FFFFFF') >= 4.5).sort((x, y) => lum(x) - lum(y));
  const accent = dark[0] || '#0E2266';
  const fam = [head, body].filter((x, i, a) => x && a.indexOf(x) === i && !/^(arial|helvetica|georgia|times|system-ui)/i.test(x));
  const fontsHref = fam.length ? 'https://fonts.googleapis.com/css2?' + fam.map((f) => 'family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;600;700;800').join('&') + '&display=swap' : '';
  const team = (c.team || []).filter((m) => m && m.name).map((m) => ({ id: m.id != null ? String(m.id) : '', name: m.name, title: String(m.title || '').trim() }));
  return { name: c.name || b.name || 'Client', head, body, accent, ink: '#14182B', colors: cols, fontsHref, team, industry: c.industry || '',
    photoPool: globalThis.CosBrandPhotos ? globalThis.CosBrandPhotos.pool({ brandImages: c.brandImages || [], team: c.team || [], logos: b.logos || {}, manualLogoColor: c.manualLogoColor || '', manualLogoWhite: c.manualLogoWhite || '' }) : [] };
}
function hexRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lum(h) { const c = hexRgb(h); if (!c) return 1; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
export function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

// ---------- campaigns (Brand Command) ----------
// The byline follows Brand Command › Team Member Profiles, live (Erika, Oct 28: titles out of sync with Brand Command): an
// author who is on the team (team id, else name with credentials ignored; pilot-dash team-link.js) shows the member's
// current name and title every time the article opens. A title saved with the article is never kept; only one typed here
// with its flag (titleOverride). An empty title in Brand Command: no title in the byline. Someone not on the team: as saved.
let TL = null; if (!PREVIEW) import(PILOT + 'team-link.js').then((m) => { TL = m; }).catch(() => {});
export function setTeamLink(m) { TL = m || null; }
export function __setRawForTests(raw) { S.raw = raw; }
export function linkAuthor(au) {
  if (!au || typeof au !== 'object' || !(au.name || au.teamId)) return au;
  const team = articleBrand().team;
  if (TL) return TL.linkPerson(au, team, { fields: ['name', 'title'] });
  const m = team.find((x) => (au.teamId && x.id === au.teamId) || String(x.name).trim().toLowerCase() === String(au.name || '').trim().toLowerCase());
  return m ? { ...au, ...(m.id ? { teamId: m.id } : {}), name: au.nameOverride ? au.name : m.name, title: au.titleOverride ? au.title : m.title } : au;
}
export async function currentCampaign() { if (PREVIEW || !Brand || !Brand.currentCampaign || !S.clientId) return ''; try { return (await Brand.currentCampaign(S.clientId)) || ''; } catch (e) { return ''; } }
export async function campaigns() {
  if (PREVIEW) return demoCampaigns();
  try { const fb = await import(PILOT + 'firebase-sync.js'); const rows = await fb.loadCampaigns(S.clientId); return (rows || []).filter((c) => c && !/^(completed|archived)$/i.test(c.status || '')); } catch (e) { console.warn(e); return []; }
}
export function isActiveCampaign(c, now = Date.now()) {
  if (!c || /^(completed|archived)$/i.test(c.status || '')) return false; if (/^active$/i.test(c.status || '')) return true;
  const s = Date.parse(c.startDate || c.launchDate || ''), e = Date.parse(c.endDate || ''); return (!isNaN(s) || !isNaN(e)) && (isNaN(s) || s <= now) && (isNaN(e) || now <= e + 86400000);
}
export const campaignBrief = (c) => !c ? '' : [['Campaign', c.name], ['Goal', c.goal || c.objective], ['Audience', c.targetAudience], ['Key message', c.keyMessage], ['Supporting messages', c.supportingMessages], ['Offer', c.offer], ['Call to action', c.cta], ['Required language', c.requiredLanguage], ['About', c.description]].filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => k + ': ' + v.trim()).join('\n');

// ---------- saved articles (the article model) ----------
const LS = () => 'cos-blog-builder:' + S.clientId;
export async function listArticles() {
  if (PREVIEW) { try { return Object.values(JSON.parse(localStorage.getItem(LS()) || '{}')).sort((a, b) => ((b.builder || {}).updatedAt || 0) - ((a.builder || {}).updatedAt || 0)); } catch (e) { return []; } }
  const { f, db } = await fs(); const snap = await f.getDocs(f.collection(db, 'catalystos_clients', S.clientId, 'blogArticles'));
  const out = []; snap.forEach((d) => { try { out.push({ ...JSON.parse(d.data().json || '{}'), articleId: d.id }); } catch (e) {} });
  return out.sort((a, b) => ((b.builder || {}).updatedAt || 0) - ((a.builder || {}).updatedAt || 0));
}
export async function getArticle(id) {
  if (PREVIEW) { try { return JSON.parse(localStorage.getItem(LS()) || '{}')[id] || null; } catch (e) { return null; } }
  const { f, db } = await fs(); const d = await f.getDoc(f.doc(db, 'catalystos_clients', S.clientId, 'blogArticles', id)); if (!d.exists()) return null;
  try { return { ...JSON.parse(d.data().json || '{}'), articleId: d.id }; } catch (e) { return null; }
}
// model: an article model record (lib/article.js toModel).
export async function saveArticle(model) {
  const m = { ...model, builder: { ...(model.builder || {}), updatedAt: Date.now(), updatedBy: userEmail() } };
  if (PREVIEW) { try { const all = JSON.parse(localStorage.getItem(LS()) || '{}'); all[m.articleId] = m; localStorage.setItem(LS(), JSON.stringify(all)); } catch (e) {} return m; }
  const { f, db } = await fs();
  await f.setDoc(f.doc(db, 'catalystos_clients', S.clientId, 'blogArticles', m.articleId), { json: JSON.stringify(m), title: m.title || '', templateId: m.templateId || '', campaignId: m.campaignId || null, state: (m.editorial || {}).state || '', updatedAt: m.builder.updatedAt, updatedBy: m.builder.updatedBy });
  return m;
}
export async function deleteArticle(id) {
  if (PREVIEW) { try { const all = JSON.parse(localStorage.getItem(LS()) || '{}'); delete all[id]; localStorage.setItem(LS(), JSON.stringify(all)); } catch (e) {} return; }
  const { f, db } = await fs(); await f.deleteDoc(f.doc(db, 'catalystos_clients', S.clientId, 'blogArticles', id));
}
// Saved Files (pilot-dash saved-files.js): every save is listed under the client, with its campaign; openUrl reopens it.
export function openUrlFor(id) { const p = new URLSearchParams(); p.set('client', S.clientId || ''); if (S.orgId) p.set('org', S.orgId); p.set('article', id); return OPEN_URL + '?' + p.toString(); }
export async function recordSave(model, { approved = false, text = '' } = {}) {
  if (PREVIEW || !S.clientId) return null;
  try { const m = await import(PILOT + 'saved-files.js'); return await m.recordSave({ clientId: S.clientId, orgId: S.orgId || '', app: APP, ref: model.articleId, title: model.title || 'Untitled article', campaignIds: model.campaignId ? [model.campaignId] : [], openUrl: openUrlFor(model.articleId), approved, kind: ((typeById(model.templateId) || {}).label || 'Blog article'), deliverable: 'blog-article', text: String(text || '').slice(0, 20000) }); } catch (e) { console.warn('Saved Files', e); return null; }
}
export async function removeSave(id) { if (PREVIEW || !S.clientId) return; try { const m = await import(PILOT + 'saved-files.js'); await m.removeSave(S.clientId, APP, id); } catch (e) {} }
export async function listSavedRefs() { if (PREVIEW || !S.clientId) return null; const m = await import(PILOT + 'saved-files.js'); return new Set(((await m.listSaved(S.clientId)) || []).filter((r) => r && r.app === APP).map((r) => String(r.ref))); }

// ---------- AI (the dashboard's /api/claude, cost-logged per client and app) ----------
async function complete(body) {
  const r = await fetch(PILOT + 'api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 4000, ...body }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((window.CosAiRefusal && window.CosAiRefusal.since(0)) || (data && data.error) || ('The AI service could not be reached (' + r.status + ').'));
  if (data && data.usage && !PREVIEW) { const u = data.usage; import(PILOT + 'firebase-sync.js').then((m) => m.logAiUsage && m.logAiUsage({ at: Date.now(), app: APP_LABEL, clientId: S.clientId || '', model: data.model || '', input: u.input_tokens || 0, output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 })).catch(() => {}); }
  return (data && data.text) || '';
}
export const readJson = (t) => { const c = String(t || '').replace(/```json|```/gi, '').trim(); try { return JSON.parse(c); } catch (e) {} const a = c.search(/[[{]/), b = Math.max(c.lastIndexOf(']'), c.lastIndexOf('}')); if (a >= 0 && b > a) { try { return JSON.parse(c.slice(a, b + 1)); } catch (e) {} } return null; };
async function knowledge(role) { if (PREVIEW) return ''; try { const k = await import(PILOT + 'team-knowledge.js'); return (await k.liveKnowledgeFor({ format: 'blog', role, app: APP })) || ''; } catch (e) { return ''; } }
const sys = (know, rest) => (know ? [{ type: 'text', text: 'TEAM KNOWLEDGE:\n' + know, cache_control: { type: 'ephemeral' } }, { type: 'text', text: rest }] : rest);
export function personas() { return ((S.raw && S.raw.personas) || []).filter((p) => p && p.name).map((p) => p.name); }
function personasText() { return ((S.raw && S.raw.personas) || []).map((p) => { const at = Object.entries(p.fields || {}).filter(([, v]) => v && v.enabled && v.text).map(([k, v]) => k + ': ' + v.text).join('; '); return '- ' + (p.name || 'Persona') + (at ? ': ' + at : ''); }).join('\n'); }
export function kb() { return String((S.ctx && S.ctx.text) || '').slice(0, 14000); }
function complianceText() { const c = S.raw || {}; const t = (v) => (typeof v === 'string' ? v : (v && v.text) || ''); return [t((c.writingComponents || {}).compliance), t((c.writingSystem || {}).compliance)].filter(Boolean).join('\n').slice(0, 3000); }

// ---------- the Strategist's verified research (Campaign Strategy; read only, never invented) ----------
export async function campaignResearch(campaignId) {
  if (!campaignId) return null;
  let rec = null;
  if (PREVIEW) rec = demoResearch(campaignId);
  else { try { rec = Brand && Brand.getCampaignResearch ? await Brand.getCampaignResearch(S.clientId, campaignId) : await (await import(PILOT + 'campaign-strategy.js')).getCampaignResearch(S.clientId, campaignId); } catch (e) { console.warn('Campaign research', e); } }
  const v = rec && (rec.use || rec.approved || rec.latest); if (!v) return null;
  let current = []; try { const R = await import(PILOT + 'strategist-research.js'); current = R.currentFacts(v); } catch (e) { current = []; }
  const T = v.strategy || {}, Y = v.synthesis || {};
  const blogDel = (T.deliverables || []).filter((d) => d && /blog|article/i.test(String(d.deliverable || ''))).slice(0, 6).map((d) => ({ deliverable: String(d.deliverable || ''), angle: String(d.angle || ''), purpose: String(d.purpose || '') }));
  return { version: v.version, state: (v.approval && v.approval.state) || 'draft', core: String(T.coreMessage || ''), cta: String(T.cta || ''), tone: String(T.tone || ''), angle: String((Y.recommendedAngle && Y.recommendedAngle.angle) || ''),
    positioning: String(T.positioning || ''), pillars: ((T.messagingHouse && T.messagingHouse.pillars) || []).map((p) => String((p && p.pillar) || '')).filter(Boolean).slice(0, 6), blog: String((T.channels && T.channels.blog) || ''), deliverables: blogDel,
    audience: (Y.audienceImplications || []).slice(0, 3).map((a) => a.point).join(' '),
    facts: current.slice(0, 10).map((f) => ({ fact: String(f.fact || ''), attribution: String(f.attribution || ''), title: String(f.title || f.publisher || ''), publisher: String(f.publisher || ''), url: String(f.url || ''), date: String(f.publishedDate || '') })) };
}
// The Strategist researches a campaign that has none yet (Campaign Strategy decides; it may take a few minutes).
export async function researchCampaign(campaign, onStatus) {
  if (PREVIEW || !Brand || !Brand.ensureCampaignStrategy || !campaign) return null;
  await Brand.ensureCampaignStrategy(S.clientId, APP, { campaign, onStatus: onStatus || (() => {}) });
  return campaignResearch(campaign.id);
}

// ---------- topic ideas for the current campaign (lib/topics.js; Erika, Oct 29) ----------
// One quick request (Haiku) per client + campaign + article type, cached so coming back costs nothing. The ideas read the
// campaign and its strategy and piece plan, the verified research, the type's purpose, Brand Command's content pillars and
// personas, the approved company voice (when there is one) and the titles the client already has, so they don't repeat.
const tval = (v) => (typeof v === 'string' ? v : (v && v.text) || '');
export function contentPillars() { const c = S.raw || {}; return [tval((c.writingComponents || {}).contentPillars), tval((c.writingSystem || {}).contentPillars)].filter(Boolean).join('\n').slice(0, 2000); }
export async function approvedTitles(campaignId) {
  if (PREVIEW || !S.clientId) return [];
  try { const AK = await import(PILOT + 'approved-knowledge.js'); return ((await AK.listApproved(S.clientId, { campaignId: campaignId || '' })) || []).map((x) => String(x.title || '')).filter(Boolean).slice(0, 60); } catch (e) { return []; }
}
// The approved company voice (Writing Library → Voice Profile), style only; optional: empty when there is none.
export async function companyVoiceText() {
  if (PREVIEW || !S.clientId) return '';
  try { const WL = await import(PILOT + 'writing-library.js'); const v = await WL.loadCompanyVoice(S.clientId); return String((v && v.writer && v.writer.text) || '').slice(0, 1500); } catch (e) { return ''; }
}
const topicStore = (() => { try { return globalThis.localStorage || null; } catch (e) { return null; } })();
const TOPICS = TP.makeCache(topicStore);
export const topicKey = (campaignId, typeId) => TP.cacheKey(S.clientId, campaignId, typeId);
export function cachedTopicIdeas(campaignId, typeId) { return campaignId ? TOPICS.get(topicKey(campaignId, typeId)) : null; }
const campaignTopicText = (c) => [campaignBrief(c), c && typeof c.contentPillars === 'string' && c.contentPillars.trim() ? 'Content pillars: ' + c.contentPillars.trim() : '', c && (c.startDate || c.launchDate || c.endDate) ? 'Runs: ' + [c.startDate || c.launchDate, c.endDate].filter(Boolean).join(' to ') : ''].filter(Boolean).join('\n');
export async function topicCtx({ campaign, typeId, research, titles = [] }) {
  const T = typeById(typeId) || typeById('blank');
  return { clientName: clientName(), type: { id: T.id, label: T.label, purpose: T.purpose, audience: T.audience, evidence: T.evidence }, campaign: campaign || null, campaignText: campaignTopicText(campaign), research: research || null,
    personas: personas(), personasText: personasText(), pillars: contentPillars(), kb: kb(), voice: await companyVoiceText(), titles: titles.filter(Boolean) };
}
// mode: 'first' (cached when there is one), 'more', 'refresh'. Returns lib/topics.js ideasFor's result.
export async function topicIdeas({ campaign, typeId, research, titles, mode = 'first' }) {
  if (!campaign) return { state: 'no-campaign', ideas: [], note: TP.NO_CAMPAIGN };
  const ctx = await topicCtx({ campaign, typeId, research, titles });
  return TP.ideasFor(ctx, { complete, cache: TOPICS, key: topicKey(campaign.id, typeId), mode });
}

// ---------- the editorial brief (spec §6) ----------
// The Strategist drafts it from the topic (Mode A) or the current campaign and its approved strategy (Mode E). Research
// comes only from the Campaign Strategy (verified, current facts with their sources); nothing is invented.
export const BRIEF_FIELDS = ['workingTitle', 'audience', 'objective', 'searchIntent', 'angle', 'keyQuestions', 'clientContent', 'research', 'suggestedType', 'outline', 'cta', 'compliance'];
export function emptyBrief(o = {}) { return { topic: '', workingTitle: '', audience: '', objective: '', searchIntent: 'informational', angle: '', keyQuestions: [], clientContent: '', research: [], researchNote: '', suggestedType: o.typeId || 'blank', outline: [], cta: '', compliance: [], start: o.start || 'topic', campaignId: '', approved: false, by: 'person', ...o }; }
// author (lib/author.js): the company voice or a person; knowledge: their approved perspectives, facts and topics.
export async function draftBrief({ typeId, topic, campaign, research, start, author = null, knowledge: about = null }) {
  const T = typeById(typeId) || typeById('blank');
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const steer = start === 'campaign' && campaign
    ? 'THIS ARTICLE IS PART OF A CAMPAIGN AND THE CAMPAIGN DICTATES IT: its audience, key message and call to action.\n' + (topic ? 'TOPIC CHOSEN FOR THIS ARTICLE: ' + topic + '\n' : '') + campaignBrief(campaign) + (research ? '\n\nAPPROVED CAMPAIGN STRATEGY (v' + research.version + ', ' + research.state + '): core message: ' + research.core + (research.angle ? '; recommended angle: ' + research.angle : '') + (research.cta ? '; call to action: ' + research.cta : '') + (research.audience ? '; audience: ' + research.audience : '') : '')
    : 'TOPIC FROM THE PERSON: ' + (topic || '(none given: choose a timely, useful topic for the personas from what Brand Command shows; today is ' + today + ')') + (campaign ? '\n\nCAMPAIGN SELECTED (keep the article consistent with it):\n' + campaignBrief(campaign) : '');
  const types = ARTICLE_TYPES.map((t) => t.id + ' (' + t.label + ')').join(', ');
  const who = author && author.name ? author : null; const kText = who ? AU.knowledgeText(who.name, about) : '';
  const from = who ? '\n\nTHIS ARTICLE IS FROM ' + who.name + (who.title ? ', ' + who.title : '') + ', with their byline, written as them. Plan it as their piece: their perspectives and the topics they speak on come first.' + (kText ? '\n' + kText + '\nUse only these facts about them; never invent their experiences or opinions.' : '\nNo approved facts about them yet: state none.') : '\n\nTHIS ARTICLE IS IN THE COMPANY VOICE (no personal byline).';
  const out = await complete({ max_tokens: 2200, system: sys(await knowledge('strategist'), 'You are the Strategist on ' + clientName() + '’s marketing team, writing the editorial brief for a blog article before the Senior Writer writes it. Facts come only from Brand Command, the campaign and the research given. Never invent statistics, quotes, sources or client names.\n\nBRAND COMMAND KNOWLEDGE:\n' + kb()),
    messages: [{ role: 'user', content: steer + (personasText() ? '\n\nTARGET PERSONAS:\n' + personasText() : '') + (research && research.facts.length ? '\n\nVERIFIED RESEARCH (you may plan to use these; do not add others):\n' + research.facts.map((f, i) => '[R' + (i + 1) + '] ' + f.fact + ' (' + f.attribution + ')').join('\n') : '\n\nVERIFIED RESEARCH: none available.') + from
      + '\n\nThe article type chosen: ' + T.label + ' — ' + T.purpose + '\nIts recommended sections: ' + T.sections.map((s) => s.heading).join(' | ') + '\nArticle types available: ' + types + '.'
      + '\n\nWrite the editorial brief. Return ONLY JSON: {"workingTitle": "under 12 words", "audience": "who exactly", "objective": "what the article should achieve", "searchIntent": "informational|commercial|navigational|transactional", "angle": "one sentence: the specific angle", "keyQuestions": ["the 3-6 questions the article answers"], "clientContent": "the Brand Command facts, services or expertise that are relevant (only what Brand Command states)", "suggestedType": "type id", "outline": ["H2 headings in order; start from the recommended sections"], "cta": "the one next step", "compliance": ["requirements from Brand Command compliance rules or the industry that apply"]}' }] });
  const j = readJson(out); if (!j || typeof j !== 'object') throw Object.assign(new Error('unreadable brief'), { userMessage: 'The brief could not be drafted this time. Please try again.' });
  const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : []);
  const comp = [...new Set(arr(j.compliance).concat(T.compliance ? [T.compliance] : []))].slice(0, 8);
  return emptyBrief({ topic: topic || '', workingTitle: String(j.workingTitle || '').trim(), audience: String(j.audience || (campaign && campaign.targetAudience) || '').trim(), objective: String(j.objective || '').trim(),
    searchIntent: ['informational', 'commercial', 'navigational', 'transactional'].includes(j.searchIntent) ? j.searchIntent : T.intent, angle: String(j.angle || '').trim(), keyQuestions: arr(j.keyQuestions).slice(0, 8),
    clientContent: [kText, String(j.clientContent || '').trim()].filter(Boolean).join('\n\n'), author: AU.briefAuthor(author), research: research ? research.facts.slice() : [], researchNote: researchNote(research, campaign),
    // the type the person picked stays; the Strategist suggests one only for a Blank Article
    suggestedType: typeId !== 'blank' ? typeId : typeById(j.suggestedType) && j.suggestedType !== 'blank' ? j.suggestedType : typeId, outline: arr(j.outline).slice(0, 12).length ? arr(j.outline).slice(0, 12) : T.sections.map((s) => s.heading),
    cta: String(j.cta || (research && research.cta) || (campaign && campaign.cta) || '').trim(), compliance: comp, start: start || 'topic', campaignId: campaign ? campaign.id : '', strategyVersion: research ? research.version : 0, by: 'agent', researchDate: research && research.facts.length ? new Date().toISOString().slice(0, 10) : '' });
}
export function researchNote(research, campaign) {
  if (research && research.facts.length) return 'Verified, current facts from the Campaign Strategy v' + research.version + ' (' + research.state + ').';
  if (research) return 'The Campaign Strategy v' + research.version + ' has no verified outside facts that are current. The article uses Brand Command only.';
  if (campaign) return 'This campaign has no Campaign Strategy research yet. The article uses Brand Command only, unless you have CatalystOS research it.';
  return 'No campaign is picked, so there is no verified research. The article uses Brand Command only; outside claims will be flagged for a source.';
}

// ---------- writing (the shared Senior Writer) ----------
export function briefText(b) {
  if (!b) return '';
  const L = (k, v) => (Array.isArray(v) ? (v.length ? k + ':\n' + v.map((x) => '- ' + (typeof x === 'string' ? x : x.fact + ' (' + x.attribution + ')' + (x.url ? ' ' + x.url : ''))).join('\n') : '') : v ? k + ': ' + v : '');
  return ['EDITORIAL BRIEF', L('Working title', b.workingTitle), L('Topic', b.topic), L('Audience', b.audience), L('Objective', b.objective), L('Search intent', b.searchIntent), L('Angle', b.angle), L('Key questions to answer', b.keyQuestions), L('Relevant client content (Brand Command)', b.clientContent), L('Verified research (use only these outside facts, each with its attribution and link)', b.research), L('Outline (H2 headings)', b.outline), L('Call to action', b.cta), L('Compliance requirements', b.compliance)].filter(Boolean).join('\n');
}
const RULES = 'RULES (never break them): The client’s voice sets the tone and register; the article type only shapes the outline. Testimonials, client quotes and results go in only where the article type or brief calls for them, never dropped into the middle of the article. Never invent statistics, percentages, dollar figures, studies, quotes, people, clients, awards or sources. Use outside facts ONLY from the verified research in the brief, with the attribution in the sentence and the source listed under Sources. Brand Command facts need no source. If a point needs a fact you do not have, leave the fact out; if the claim is essential, keep it and put "[Source needed]" right after it. Quotes only from approved Brand Command testimonials. Never add a link that is not in the brief.';
const FORMAT = 'FORMAT: Markdown. First line "# " + the headline. Optional second line: the dek in _underscores_. Then the introduction (1-3 short paragraphs, no heading). Then each section as "## Heading" (use "### " for a subsection), with paragraphs, "- " bullet lists or "1. " numbered lists where they help, and "> Label: text" for a callout. Then "## Conclusion" (one short paragraph), "## Call to Action" (one or two sentences, then a line "Button: 2-5 words"), and "## Sources" listing ONLY the verified research you used as "- Title — https://url". Nothing else.';
// guidance (Rewrite All, lib/author.js rewriteGuidance): the article as it is, to rewrite in the byline's voice.
export async function writeArticle({ article, brief, campaign, onStatus, guidance = '' }) {
  const T = typeById(article.typeId) || typeById('blank');
  const outline = (article.sections || []).length ? article.sections : null;
  const author = article.author && article.author.name ? article.author : null; if (author) refuse(author);
  const task = 'Write a complete blog article for ' + clientName() + '.\n\n' + shapeText(T.id, outline) + '\n\n' + briefText(brief) + (author ? '\n\nByline: ' + author.name + (author.title ? ', ' + author.title : '') + (author.personId ? ' (written as them: their approved knowledge and confirmed writing rules apply).' : ' (write in the company voice unless the brief says otherwise).') : '\n\nNo personal byline: write in the company voice.') + (guidance ? '\n\n' + guidance : '') + '\n\n' + RULES + '\n\n' + FORMAT;
  let r = null;
  if (!PREVIEW && Brand && Brand.write) {
    onStatus && onStatus('Writing…');
    r = await Brand.write(S.clientId, APP, { format: 'Blog / article', outputType: 'blog', deliverable: T.label, task, campaign: campaign || null, audience: (brief && brief.audience) || '', ...(author && author.personId ? { voiceOf: author.personId } : {}), onStatus: (t) => t && onStatus && onStatus(t) });
  } else {
    onStatus && onStatus('Writing…');
    const text = await complete({ max_tokens: 6000, system: sys(await knowledge('writer'), 'You are the Senior Writer for ' + clientName() + '. Brand Command is the only source of facts about the client.\n\nBRAND COMMAND KNOWLEDGE:\n' + kb()), messages: [{ role: 'user', content: task + (campaign ? '\n\nCAMPAIGN:\n' + campaignBrief(campaign) : '') }] });
    r = { text, flags: [], editorial: null, review: null, supportedPct: null };
  }
  return { md: String((r && r.text) || ''), flags: (r && r.flags) || [], editorial: (r && r.editorial) || null, review: (r && r.review) || null, supportedPct: r ? r.supportedPct : null, voiceScore: r ? r.voiceScore : null, routing: (r && r.routing) || null, strategy: (r && r.strategy) || null };
}
// CatalystOS Write / Rewrite on one text box (Write First): the fast Senior Writer path, one element only.
export async function writeField({ article, brief, campaign, label, current, around, maxWords }) {
  if (article && article.author && article.author.name) refuse(article.author);
  const task = 'Write the ' + label + ' of a blog article for ' + clientName() + (article && article.title ? ' titled "' + article.title + '"' : '') + '.' + (brief ? '\n\n' + briefText(brief) : '') + (around ? '\n\nAROUND IT:\n' + String(around).slice(0, 2500) : '') + (current ? '\n\nWHAT IS THERE NOW (source material; write a better version):\n' + String(current).slice(0, 3000) : '') + '\n\n' + RULES + '\nReturn ONLY the text' + (maxWords ? ' (at most ' + maxWords + ' words)' : '') + ', no heading, no quotes around it.';
  let out = '';
  if (!PREVIEW && Brand && (Brand.writeOne || Brand.write)) { const r = await (Brand.writeOne || Brand.write)(S.clientId, APP, { format: 'Blog / article', outputType: 'blog', task, campaign: campaign || null, ...(article && article.author && article.author.personId ? { voiceOf: article.author.personId } : {}), field: { label, current: current || '', maxWords: maxWords || 0 } }); out = String((r && r.text) || ''); }
  else out = await complete({ max_tokens: 1200, system: 'You are the Senior Writer for ' + clientName() + '. Brand Command is the only source of facts.\n\nBRAND COMMAND KNOWLEDGE:\n' + kb(), messages: [{ role: 'user', content: task }] });
  const t = String(out || '').trim().replace(/^#+\s+/, '').replace(/^["“]+|["”]+$/g, '').trim();
  if (!t) throw new Error('No text came back. Please try again.');
  return t;
}

// ---------- review: the shared production review's editorial and compliance screening (no AI) ----------
// founderKnowledge: the byline person's approved Founders & Leadership knowledge (founder-voice.js), so true facts about
// them are not flagged as unsupported (Oct 29).
export function sourceText(article, founderKnowledge = '') {
  const b = (article && article.brief) || {};
  return [kb(), founderKnowledge, b.clientContent, (b.research || []).map((f) => f.fact + ' ' + f.attribution).join('\n'), (article.sources || []).map((s) => s.title).join('\n')].filter(Boolean).join('\n');
}
export async function reviewChecks(article) {
  const [CE, PP] = await Promise.all([import(PILOT + 'production-review/checks-editorial.js'), import(PILOT + 'production-review/profiles.js')]);
  const c = S.raw || {};
  let compliance = null; try { compliance = PP.complianceProfile({ industry: c.industry || '', name: c.name || '', text: kb().slice(0, 4000) }); } catch (e) { compliance = null; }
  let fk = ''; const pid = article && article.author && article.author.personId;
  if (pid && !PREVIEW) { try { const FVm = await import(PILOT + 'founder-voice.js'); const P = await FVm.prepare({ clientId: S.clientId, voiceOf: pid }); fk = (P && P.factsBlock) || ''; } catch (e) { fk = ''; } }
  const r = CE.run(contentObject(article), { sourceText: sourceText(article, fk), compliance, legalText: complianceText(), deliverable_id: article.id });
  const issues = (r.issues || []).filter((i) => i.rule !== 'mechanical').map((i) => ({ severity: i.severity, rule: i.rule, where: (i.location && i.location.component) || '', text: i.description, action: i.proposed_action, needsPerson: !!i.human_approval_required }));
  return { at: Date.now(), issues, performed: r.performed || [], regulated: !!(compliance && compliance.regulated), profile: compliance ? compliance.label : '', disclosures: compliance ? (compliance.disclosures || []).slice(0, 4) : [] };
}

// ---------- the voice feedback loop: approving teaches the Senior Writer ----------
// voiceOf: the byline person's Founders & Leadership id when the article was written as them: their notes learn, not the
// company's (Oct 29).
export function learnApproved(draft, final, voiceOf = '') {
  if (PREVIEW || !Brand || !final) return;
  const teach = Brand.learn || ((c, a, e) => Brand.feedback(c, a, e));
  Promise.resolve().then(() => teach(S.clientId, APP, { kind: 'approved', format: 'Blog / article', draft: draft || final, final, ...(voiceOf ? { voiceOf } : {}) })).catch((e) => console.warn('Writer feedback skipped', e));
}
// Who an article is from (lib/author.js; Erika, Oct 29): the company voice or a person in Brand Command → Founders &
// Leadership (pilot-dash founder-voice.js authorsFor: approved for writing, voice profile, the reason when not ready).
// Loaded once per client; fresh: true reads again (the person may have just been approved in another tab).
let AUTHORS = null, AUTHORS_FOR = '';
export async function loadAuthors({ fresh = false } = {}) {
  if (!S.clientId) return [];
  if (AUTHORS && AUTHORS_FOR === S.clientId && !fresh) return AUTHORS;
  if (PREVIEW) { AUTHORS = demoAuthors(); AUTHORS_FOR = S.clientId; return AUTHORS; }
  try { const FVm = await import(PILOT + 'founder-voice.js'); AUTHORS = await FVm.authorsFor(S.clientId); AUTHORS_FOR = S.clientId; } catch (e) { console.warn('Founders & Leadership', e); if (!AUTHORS) AUTHORS = []; }
  return AUTHORS;
}
export function authorsNow() { return AUTHORS && AUTHORS_FOR === S.clientId ? AUTHORS : null; }
export function __setAuthorsForTests(list, clientId = 'test') { AUTHORS = list; AUTHORS_FOR = clientId; S.clientId = clientId; }
export function __setBrandForTests(b) { Brand = b; }
export function personIdFor(member, authors = AUTHORS) {
  const k = (x) => String(x || '').trim().toLowerCase();
  const hit = (authors || []).find((p) => p && p.approved && k(p.name) === k(member && member.name));
  return hit ? hit.id : '';
}
// Never written as someone who is not approved for writing (the shared writer refuses too: founder-voice.js prepare).
export function canWriteAs(author) {
  const pid = author && author.personId; if (!pid) return '';
  const p = (authorsNow() || []).find((x) => x.id === pid); if (!p) return authorsNow() ? 'Not in Founders & Leadership yet' : '';
  return p.approved ? '' : (p.reason || 'Not approved for writing yet');
}
function refuse(author) { const why = canWriteAs(author); if (why) throw Object.assign(new Error(author.name + ': ' + why), { code: 'author-not-approved', userMessage: 'CatalystOS can’t write as ' + author.name + ' yet: ' + why + '. Approve them in Brand Command → Founders & Leadership, or choose the company voice.' }); }
// A person's approved perspectives, facts and topics for the brief (founder-voice.js prepare: only what was approved for
// writing). { perspectives: [text], facts: [text], topics: [text] } or null.
const tlist = (v) => (Array.isArray(v) ? v.map((x) => String((x && (x.text || x.statement)) || x || '').trim()) : String(v || '').split(/\n|;|,(?=\s*[A-Z])/).map((x) => x.trim())).filter(Boolean);
export async function authorKnowledge(personId) {
  if (!personId || !S.clientId) return null;
  if (PREVIEW) return demoKnowledge(personId);
  try {
    const FVm = await import(PILOT + 'founder-voice.js'); const P = await FVm.prepare({ clientId: S.clientId, voiceOf: personId }); const a = P && P.authors && P.authors[0]; if (!a) return null;
    const k = a.packs || {}, v = (a.person && a.person.voice) || {};
    return { perspectives: (k.perspectives || []).map((x) => x.statement), facts: (k.knowledge || []).map((x) => x.statement), topics: tlist((v.criteria || {}).topics || v.topics) };
  } catch (e) { if (e && e.code === 'author-not-approved') return null; console.warn('Founder knowledge', e); return null; }
}
export function logDownload(format) { try { if (!PREVIEW && Brand && Brand.logActivity) Brand.logActivity(S.clientId, APP, 'asset_exported', { asset_type: 'blog_article', format }); } catch (e) {} }

// ---------- preview client ----------
function demoRaw() {
  return { id: 'demo', name: 'Harbor Point Wealth', website: 'https://example.com', industry: 'Financial Services', industryTaxonomyId: 'finance', industrySubId: '',
    colors: [{ value: '#0B3D5C', role: 'primary' }, { value: '#E0A33A', role: 'secondary' }, { value: '#F4F1EA' }], typography: [{ label: 'Heading', fontFamily: 'Manrope' }, { label: 'Body', fontFamily: 'Inter' }],
    team: [{ name: 'Claire Holloway', title: 'Founder and Managing Partner' }, { name: 'Theo Marsh', title: 'Cofounder and Chief Investment Officer' }, { name: 'Marcus Reed', title: 'Senior Planner' }], brandImages: [], personas: [{ name: 'Pre-retirees' }, { name: 'Business owners' }],
    writingComponents: { contentPillars: 'Retirement income planning; Tax-aware investing; Business exit planning' } };
}
// Founders & Leadership in the preview (fictional): one person approved for writing, one not approved yet.
function demoAuthors() { return [
  { id: 'p-claire', name: 'Claire Holloway', title: 'Founder and Managing Partner', relationship: 'founder', photoUrl: '', approved: true, hasVoice: true, reason: '' },
  { id: 'p-theo', name: 'Theo Marsh', title: 'Cofounder and Chief Investment Officer', relationship: 'cofounder', photoUrl: '', approved: false, hasVoice: true, reason: 'Not approved for writing yet' }]; }
function demoKnowledge(id) { return id !== 'p-claire' ? null : { perspectives: ['A retirement plan should be written down, not kept in your head.'], facts: ['Founded Harbor Point Wealth to help people plan the years after work.'], topics: ['Retirement income', 'Business exit planning'] }; }
function demoKb(raw) { return 'Client: ' + raw.name + '. Fee-only financial planning firm in Boston for people within ten years of retirement and business owners planning an exit. Services: retirement income planning, tax-aware investing, business exit planning. Fictional demo client.'; }
function demoCampaigns() { return [{ id: 'c1', name: 'Retirement Income Season', status: 'Active', goal: 'Book 20 retirement income reviews', targetAudience: 'People within ten years of retirement', keyMessage: 'A written income plan makes retirement decisions calmer.', cta: 'Book a free retirement income review',
  piecePlan: { summary: 'Teach first, then invite a review.', items: [{ kind: 'blog-article', why: 'Answers the questions people ask before booking a review.' }] } }]; }
function demoResearch(id) {
  if (id !== 'c1') return null;
  return { use: { version: 2, approval: { state: 'approved' }, strategy: { coreMessage: 'A written income plan makes retirement decisions calmer.', cta: 'Book a free retirement income review', positioning: 'Calm, written plans for the years after work.', messagingHouse: { pillars: [{ pillar: 'Spending with confidence' }, { pillar: 'Taxes in retirement' }] }, channels: { blog: 'Teach one decision per article.' } }, synthesis: { recommendedAngle: { angle: 'From saving to spending: the shift nobody plans for.' }, audienceImplications: [{ point: 'Pre-retirees worry most about running out of money.' }], usableFacts: [{ fact: 'Sample fact for the local preview only.', attribution: 'Demo Research Institute, 2026', sourceId: 'S1', quote: '' }] }, research: { sources: [{ id: 'S1', status: 'ok', title: 'Demo research report', publisher: 'Demo Research Institute', url: 'https://example.com/research', publishedDate: '2026-09-01' }] } } };
}
