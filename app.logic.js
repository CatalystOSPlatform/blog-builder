// Blog Builder — page logic. Data, saving, research and writing live in lib/data.js; the article types in
// lib/article-types.js; the article (editor shape, the saved article model, outputs) in lib/article.js.
const lib = (p) => import(new URL(p, document.baseURI).href);
const PILOT = 'https://pilot-dash-ten.vercel.app/';
// Write First (Erika, Oct 23): opened directly (You Run It) nothing is written until the person asks and nothing is saved
// until Save (or Save and Leave); hands-off runs (?cos_auto=1, CatalystOS Runs It) proceed and save as they work.
const COS_AUTO = (() => { try { return new URLSearchParams(location.search).get('cos_auto') === '1'; } catch (e) { return false; } })();
const clone = (x) => JSON.parse(JSON.stringify(x));
const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
const rowsFor = (t, min = 3, per = 78) => Math.max(min, String(t || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / per)), 0) + 1);
const SEV = { critical: '#B42318', major: '#B54708', minor: '#1D4ED8', advisory: '#4B5563' };

class Component extends DCLogic {
  state = { boot: 'loading', bootMsg: 'Connecting to Brand Command…', info: {}, camps: [], curCamp: '', models: [], sfRefs: null,
    view: 'home', typeId: 'blank', way: 'topic', topic: '', aud: '', brief: null, briefFrom: 'start', art: null, busy: false, stage: '', err: '', saved: '',
    research: null, researchFor: '', rp: { brief: false, review: true, seo: false, pub: false }, dlOpen: false, saveBusy: false };

  componentDidMount() {
    this.shell(); this.start(); this.guardRegister(0); this.sfRegister(0); this.strategyRegister(); this.wfRegister(); this.cosCreateMount(); this.followCampaign();
    this._onKey = (e) => { if (e.key === 'Escape' && this.state.dlOpen) this.setState({ dlOpen: false }); }; document.addEventListener('keydown', this._onKey);
    this._onDoc = (e) => { if (this.state.dlOpen && !(e.target.closest && e.target.closest('.bb-dl'))) this.setState({ dlOpen: false }); }; document.addEventListener('click', this._onDoc);
  }
  componentWillUnmount() { document.removeEventListener('keydown', this._onKey); document.removeEventListener('click', this._onDoc); }
  // The one status popup (cos-working.js, loaded by catalyst-shell.js; Erika, Oct 28): while busy, the job shows in the
  // CatalystOS popup at the bottom right, wherever the person has scrolled. No progress line at the top of the page.
  syncStatus() {
    const st = this.state, t = st.busy ? (st.stage || 'Working') : '', S = window.cosStatus; if (!S) return;
    if (t) { S('blog-builder', t, { estimate: /article/i.test(t) ? 120 : /Research/.test(t) ? 180 : 45 }); this._cwOn = true; }
    else if (this._cwOn) { this._cwOn = false; S('blog-builder', null, st.err ? { fail: 'Couldn\u2019t finish. Try again.' } : {}); }
  }
  componentDidUpdate() { this.syncStatus(); this.twSync(); this.showOpenCampaign(); this.brandFonts(); try { this.mountAuthor(); } catch (e) {} }
  // Write as (pilot-dash author-picker.js, Founder Intelligence Phase 2): the company voice (no byline) or a person approved for
  // writing in Brand Command → Founders & Leadership, who gets the byline and is written as.
  mountAuthor() {
    const host = document.querySelector('[data-cos-author-host="blog"]'); const st = this.state, a = st.art, cid = (st.info || {}).clientId; if (!host || !a || !cid) return;
    const pid = (a.author && a.author.personId) || ''; const key = cid + '|' + a.id + '|' + pid; if (host.dataset.key === key && host.firstChild) return; host.dataset.key = key;
    const go = () => { if (!window.CosAuthorPicker) return; window.CosAuthorPicker.mount(host, { clientId: cid, campaignId: a.campaignId || '', label: 'Write as', value: pid || 'company', onChange: (v) => { host.dataset.key = cid + '|' + a.id + '|' + (v && v.kind === 'person' ? v.id : ''); this.edit((x) => { x.author = v && v.kind === 'person' ? { name: v.name, title: v.title || '', personId: v.id } : { name: '', title: '' }; }); } }); };
    if (window.CosAuthorPicker) go(); else { const sc = document.createElement('script'); sc.src = PILOT + 'author-picker.js'; sc.onload = go; document.head.appendChild(sc); }
  }

  async start() {
    try {
      this.D = await lib('./lib/data.js'); this.T = await lib('./lib/article-types.js'); this.A = await lib('./lib/article.js');
      const info = await this.D.init();
      if (info.mode === 'signed-out') return this.setState({ boot: 'signed-out', bootMsg: 'Open the Blog Builder from your CatalystOS dashboard to sign in.' });
      if (info.mode === 'no-client') return this.setState({ boot: 'no-client', bootMsg: 'Choose a client and turn on Brand Command access to start. Reload the page to choose again.' });
      await this.useInfo(info);
    } catch (e) { console.error(e); this.setState({ boot: 'error', bootMsg: 'Could not start: ' + ((e && e.message) || e) }); }
  }
  async useInfo(info) {
    const [models, camps, curCamp] = await Promise.all([this.D.listArticles().catch(() => []), this.D.campaigns().catch(() => []), this.D.currentCampaign().catch(() => '')]);
    const q = new URLSearchParams(location.search); const want = q.get('article');
    let open = want ? models.find((m) => m.articleId === want) : null;
    if (want && !open) { try { open = await this.D.getArticle(want); } catch (e) {} }
    const st = { boot: 'ready', info, models, camps, curCamp, err: open || !want ? '' : 'That article could not be found for this client.' };
    // Deep links skip the home: ?article= (Saved Files) opens the editor; ?type= opens that type's start page.
    if (open) { const art = this.live(this.A.fromModel(open)); Object.assign(st, { view: 'editor', art, typeId: art.typeId, brief: art.brief }); this.markSaved(art); }
    else if (q.get('type') && this.T.typeById(q.get('type'))) Object.assign(st, { view: 'start', typeId: q.get('type') });
    this.setState(st);
    this.shell(info); this.sfRefsLoad();
  }
  // The shared four-bar header (catalyst-shell.js): top bar, navy app bar with the client picker and the run-mode switch,
  // the light purple bar with Saved Files ('blogbuilder') and the Campaign picker. The task bar below is the app's own.
  shell(info) {
    const S = window.CatalystShell; if (!S) return;
    const o = { app: 'Blog Builder', mount: document.querySelector('[data-cos-shell-mount]') || null, saved: 'blogbuilder', onClientChange: (id) => this.switchClientTo(id) };
    if (info && this.D) { Object.assign(o, { clientId: info.clientId || '', clientName: this.D.clientName(), clients: info.clients || [], userEmail: (info.user && info.user.email) || '', onSignOut: () => this.D.signOut() }); if (info.agency) o.agency = info.agency; const org = this.D.orgId(); if (org) o.orgId = org; }
    try { (this._shellOn ? S.update : S.init).call(S, o); this._shellOn = true; } catch (e) { console.warn('CatalystOS header', e); }
  }
  switchClientTo(id) {
    if (!id) return;
    this.setState({ boot: 'loading', bootMsg: 'Opening this client’s Brand Command…' });
    const u = new URL(location.href); ['article', 'type', 'campaign', 'cos_auto', 'job', 'kind', 'title', 'brief', 'mode'].forEach((k) => u.searchParams.delete(k));
    u.searchParams.set('client', id); const org = this.D && this.D.orgId(); if (org) u.searchParams.set('org', org); location.href = u.href;
  }
  // The header Campaign picker dictates the campaign (Erika, Oct 23). Picking another campaign while an article of another
  // campaign is open leaves it (the picker's leave guard asked first) and goes home; the start page follows the pick.
  followCampaign() {
    window.addEventListener('cos-campaign-picked', (e) => {
      const d = e.detail || {}; if (!d.clientId || d.clientId !== (this.state.info || {}).clientId) return;
      const id = d.campaignId || 'none', st = this.state; const leave = st.view === 'editor' && st.art && st.art.campaignId && st.art.campaignId !== id;
      const go = (camps) => this.setState((x) => ({ curCamp: id, ...(camps ? { camps } : {}), ...(leave ? { view: 'home', art: null, brief: null } : {}), way: id === 'none' && x.way === 'campaign' ? 'topic' : x.way }), () => this.loadResearch());
      if (id === 'none' || (st.camps || []).some((c) => c.id === id)) go(); else this.D.campaigns().then(go).catch(() => go());
    });
  }
  showOpenCampaign() { const st = this.state, a = st.view === 'editor' ? st.art : null; const id = a && a.campaignId, cid = (st.info || {}).clientId; if (!id || !cid || this._shownCamp === a.id + id) return; this._shownCamp = a.id + id; if (window.CosCampaignPicker && window.CosCampaignPicker.show) window.CosCampaignPicker.show(cid, id); }
  campaign(id) { return (this.state.camps || []).find((c) => c.id === id) || null; }
  // The campaign new work starts in: the header picker's (No Campaign = none), else the active one.
  curCampaign() { const st = this.state; if (st.curCamp === 'none') return null; return this.campaign(st.curCamp) || (st.camps || []).find((c) => this.D.isActiveCampaign(c)) || null; }
  async loadResearch() {
    const c = this.curCampaign(); const key = c ? c.id : ''; if (this.state.researchFor === key && this.state.research !== undefined && this._resKey === key) return;
    this._resKey = key; this.setState({ researchFor: key, research: null });
    if (!c) return; try { const r = await this.D.campaignResearch(c.id); if (this._resKey === key) this.setState({ research: r }); } catch (e) {}
  }
  brandFonts() {
    const b = this.D && this.state.boot === 'ready' ? this.D.articleBrand() : null; const href = b && b.fontsHref; if (!href || this._fontsHref === href) return; this._fontsHref = href;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-bb-brand-fonts', ''); document.head.appendChild(l);
  }

  // ---------- Saved Files ----------
  sfRefsLoad() { if (!this.D || this.D.PREVIEW) return this.setState({ sfRefs: 'fail' }); this.D.listSavedRefs().then((s) => this.setState({ sfRefs: s || 'fail' })).catch(() => this.setState({ sfRefs: 'fail' })); }
  sfRegister(n) { if (window.CosSavedBar && window.CosSavedBar.setActions) { window.CosSavedBar.setActions(this.sfActions()); return; } if (n < 80) setTimeout(() => this.sfRegister(n + 1), 250); }
  async sfModel(ref) { for (let i = 0; i < 120 && this.state.boot !== 'ready'; i++) await new Promise((r) => setTimeout(r, 250)); let m = (this.state.models || []).find((x) => x.articleId === ref); if (!m) { try { m = await this.D.getArticle(ref); } catch (e) {} } return m ? clone(m) : null; }
  sfActions() {
    const self = this;
    return {
      async approve(ref, on) { const m = await self.sfModel(ref); if (!m) return; const a = self.A.fromModel(m); a.sections.forEach((s) => { s.approved = !!on; }); a.approvals = (a.approvals || []).concat([{ at: Date.now(), by: self.D.userEmail(), on: !!on, from: 'Saved Files' }]); await self.persist(a); },
      async campaigns(ref, ids) { const m = await self.sfModel(ref); if (!m) return; const a = self.A.fromModel(m); const id = (ids || []).filter(Boolean).find((x) => x !== a.campaignId) || ((ids || []).includes(a.campaignId) ? a.campaignId : ''); const c = self.campaign(id); a.campaignId = id || ''; a.campaignName = c ? c.name : ''; await self.persist(a); },
      async duplicate(ref) { const m = await self.sfModel(ref); if (!m) return; const a = self.live(self.A.fromModel(m)); a.id = self.T.newId('a'); a.title = (a.title || 'Untitled article') + ' copy'; a.sections.forEach((s) => { s.approved = false; }); a.approvals = []; await self.persist(a); return a.id; },
      async remove(ref) { await self.D.deleteArticle(ref).catch(() => {}); self.setState((st) => ({ models: st.models.filter((x) => x.articleId !== ref), ...(st.art && st.art.id === ref ? { view: 'home', art: null } : {}) })); },
    };
  }
  // Save (task bar, Save and Leave, hands-off runs): the article model is saved and listed in Saved Files with its campaign.
  async persist(a) {
    const model = this.A.toModel({ ...a, updatedAt: Date.now() }, { clientId: (this.state.info || {}).clientId || '' });
    const saved = await this.D.saveArticle(model);
    this.setState((st) => ({ models: [saved].concat((st.models || []).filter((x) => x.articleId !== saved.articleId)) }));
    this.D.recordSave(saved, { approved: this.A.isApproved(a), text: this.A.articleText(a) }).then(() => { const r = this.state.sfRefs; if (r instanceof Set) { const n = new Set(r); n.add(saved.articleId); this.setState({ sfRefs: n }); } });
    return saved;
  }
  async saveNow(strict) {
    const a = this.state.art; if (!a) return;
    this.setState({ saveBusy: true, err: '' });
    try { await this.persist(a); this.markSaved(this.state.art); this.setState({ saveBusy: false, saved: '✓ Saved' }); }
    catch (e) { this.setState({ saveBusy: false, err: 'Could not save: ' + ((e && e.message) || e) }); if (strict === true) throw e; }
  }
  markSaved(a) { this._base = a ? JSON.stringify(a) : null; }
  isDirty() { const a = this.state.art; if (!a || COS_AUTO) return false; return JSON.stringify(a) !== this._base; }
  guardRegister(n) { if (!window.CosLeaveGuard) { if (n < 120) setTimeout(() => this.guardRegister(n + 1), 500); return; } window.CosLeaveGuard.register({ label: 'article', isDirty: () => this.isDirty(), save: () => this.saveNow(true) }); }
  leaveThen(go) { if (window.CosLeaveGuard && window.CosLeaveGuard.confirmLeave && this.isDirty()) window.CosLeaveGuard.confirmLeave(go); else go(); }

  // ---------- Article Types (the shared types page: cos-types-window.js) ----------
  twMods() {
    if (!this._twM) this._twM = Promise.all([lib(PILOT + 'industry-choice.js'), lib(PILOT + 'industry-playbooks/index.js')]).then(async ([IC, I]) => { const TX = await IC.loadTX(); this._tw = { IC, I, TX }; this.setState({ twReady: Date.now(), twErr: '' }); })
      .catch((e) => { console.warn('Article types industry', e); this._twM = null; this.setState({ twErr: 'The industry could not load from Brand Command right now. Every article type is still listed below.' }); });
    return this._twM;
  }
  twInd() {
    const M = this._tw, st = this.state, cid = (st.info || {}).clientId;
    if (!cid) return { state: 'no-client', line: 'Pick a client in the header to see their industry from Brand Command.' };
    if (!M || st.boot !== 'ready') { if (st.boot === 'ready' && this.D) this.twMods(); return { state: 'loading', line: st.twErr ? '' : 'Reading this client’s Brand Command…' }; }
    try { return M.IC.readOnly({ cid, client: this.D.clientRaw() || { id: cid }, I: M.I, TX: M.TX, noun: 'articles', org: this.D.orgId() }); } catch (e) { return { state: 'none', line: '' }; }
  }
  // A small, honest picture of the type's layout (headline, image, its section pattern), in the category's colors.
  twThumb(t) {
    const C = this.T.categoryById(t.category) || { ink: '#081A53', tint: '#F1F2F6' }; const ink = C.ink;
    const bar = (w, h, c, m) => '<span style="display:block;width:' + w + ';height:' + h + 'px;background:' + c + ';border-radius:2px;margin:' + (m || '0 0 5px') + '"></span>';
    const txt = (n) => Array.from({ length: n }, (_, i) => bar(i === n - 1 ? '62%' : '100%', 3, '#C9CEDC')).join('');
    const kinds = t.sections.map((s) => s.kind || '');
    const body = t.id === 'faq' ? [1, 2, 3].map(() => bar('70%', 4, ink, '6px 0 4px') + txt(1)).join('')
      : t.id === 'how-to' ? [1, 2, 3].map((n) => '<span style="display:flex;gap:5px;align-items:center;margin:0 0 5px"><span style="width:11px;height:11px;border-radius:50%;background:' + ink + ';color:#FFF;font:700 7px/11px Inter;text-align:center">' + n + '</span>' + bar('80%', 3, '#C9CEDC', '0') + '</span>').join('')
      : t.id === 'comparison' ? '<span style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px">' + Array.from({ length: 9 }, (_, i) => '<span style="height:8px;background:' + (i < 3 ? ink : '#E3E6EF') + ';border-radius:1px"></span>').join('') + '</span>'
      : t.id === 'list-article' ? [1, 2, 3, 4].map((n) => '<span style="display:flex;gap:5px;align-items:center;margin:0 0 4px"><span style="font:800 9px Manrope;color:' + ink + '">' + n + '</span>' + bar('82%', 3, '#C9CEDC', '0') + '</span>').join('')
      : t.id === 'expert-interview' ? '<span style="display:flex;gap:6px;align-items:center;margin:0 0 6px"><span style="width:18px;height:18px;border-radius:50%;background:' + C.tint + ';border:1.5px solid ' + ink + '"></span>' + bar('60%', 4, ink, '0') + '</span>' + txt(2) + bar('50%', 4, ink, '4px 0 4px') + txt(1)
      : kinds.includes('quote') || t.id === 'thought-leadership' ? txt(2) + '<span style="display:block;border-left:3px solid ' + ink + ';padding-left:5px;margin:4px 0 6px">' + bar('85%', 4, ink, '0 0 3px') + bar('55%', 4, ink, '0') + '</span>' + txt(1)
      : t.id === 'research-article' || t.id === 'industry-analysis' ? '<span style="display:flex;gap:4px;align-items:flex-end;height:26px;margin:0 0 6px">' + [12, 20, 15, 26, 18].map((h) => '<span style="flex:1;height:' + h + 'px;background:' + ink + ';opacity:.8;border-radius:1px"></span>').join('') + '</span>' + txt(2)
      : txt(4);
    return '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="position:relative;display:flex;flex-direction:column;width:150px;height:150px;padding:10px 12px;box-sizing:border-box;background:#FFFFFF;border-radius:6px;box-shadow:0 4px 14px rgba(8,26,83,.16);overflow:hidden">'
      + '<span style="display:block;height:30px;background:' + C.tint + ';border-radius:3px;margin:0 0 6px;border-bottom:2px solid ' + ink + '"></span>' + bar('90%', 6, '#14182B') + bar('60%', 6, '#14182B', '0 0 7px') + body + '</span></span>';
  }
  twCfg() {
    const st = this.state, T = this.T, ch = this.twInd();
    const card = (t) => { const C = T.categoryById(t.category) || {}; return { id: t.id, name: t.label, group: C.label || '', eyebrow: C.label || '', desc: t.purpose, meta: t.words[0] + '–' + t.words[1] + ' words · ' + t.sections.length + ' sections', ink: C.ink, tint: C.tint, thumb: () => this.twThumb(t), start: { label: 'Use template →', aria: 'Use template: ' + t.label, onClick: () => this.pickType(t.id) } }; };
    const blankThumb = '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><span style="width:150px;height:150px;background:#FFFFFF;border:1.5px dashed #8A90A8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#4A5168;font:300 30px/1 Inter,sans-serif;box-shadow:0 4px 12px rgba(8,26,83,.10)">+</span></span>';
    const blank = { id: 'blank', name: 'Blank Article', eyebrow: 'Starter Template', ink: '#081A53', tint: '#F1F2F6', desc: 'A headline and an empty body. Write it yourself, or let CatalystOS draft the brief and write it.', meta: 'Add the sections you need', thumb: blankThumb, start: { label: 'Use template →', aria: 'Use template: Blank Article', onClick: () => this.pickType('blank') } };
    const recs = T.recommendFor(ch.industryId || '');
    const ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 4h16v16H4z"></path><path d="M8 8h8M8 12h8M8 16h5"></path></svg>';
    const groups = T.CATEGORIES.map((c) => { const cs = T.typesIn(c.id).map(card); return { id: c.id, name: c.label, goal: c.about, count: cs.length + (cs.length === 1 ? ' article type' : ' article types'), icon: ICON, tint: c.tint, ink: c.ink, cards: cs }; });
    return {
      heading: 'What Article Are You Writing?', search: null,
      industry: { line: ch.line || '', href: ch.href || '', linkText: ch.linkText || '', err: st.twErr || '' },
      sections: [
        { id: 'rec', kind: 'cards', industry: true, cards: [blank].concat(recs.map(card)) },
        { id: 'all', kind: 'groups', title: 'All Article Types', button: 'All Types', note: T.ARTICLE_TYPES.length + ' article types in ' + groups.length + ' categories. Each starts from a topic or the current campaign; you can add, remove and reorder its sections.', groups },
      ],
    };
  }
  twSig() { const st = this.state, ch = this.twInd(); return JSON.stringify([(st.info || {}).clientId, st.boot, st.view, ch.state, ch.line, ch.href, st.twErr, st.twReady]); }
  twSync() { const W = window.CosTypesWindow; if (!W || !this.T) return; const open = W.current(); if (!this._twPg && !open) return; const sig = this.twSig(); if (sig === this._twSigV) return; this._twSigV = sig; const cfg = this.twCfg(); if (this._twPg) this._twPg.update(cfg); if (open) open.update(cfg); }
  twRef = (el) => { if (el === this._twEl) return; if (this._twPg) { try { this._twPg.destroy(); } catch (e) {} this._twPg = null; } this._twEl = el; if (el && window.CosTypesWindow && this.T) { this._twPg = window.CosTypesWindow.mount(el, this.twCfg()); this._twSigV = this.twSig(); } };
  twOpen = (e) => { const W = window.CosTypesWindow; if (!W || !this.T || this.state.busy) return; W.open(this.twCfg(), { title: 'Article Types', trigger: (e && e.currentTarget) || null }); this._twSigV = this.twSig(); };
  // Picking a type starts it (Write First: nothing is written, nothing saved); with unsaved work open, the leave guard asks.
  pickType(id) {
    if (this.state.busy) return; try { if (window.CosTypesWindow) window.CosTypesWindow.close(); } catch (e) {}
    this.leaveThen(() => { this.setState({ view: 'start', typeId: id, art: null, brief: null, err: '', topic: '', aud: '', way: 'topic', dlOpen: false }, () => { this.loadResearch(); this.focus('#bb-start-h'); }); this.markSaved(null); });
  }
  focus(sel) { setTimeout(() => { try { const el = document.querySelector(sel); if (el) el.focus(); window.scrollTo(0, 0); } catch (e) {} }, 60); }
  newArticle = () => this.leaveThen(() => { this.markSaved(null); this.setState({ view: 'home', art: null, brief: null, err: '', dlOpen: false }); });

  // ---------- starting: I'll Make This Myself (outline, no AI) or Let CatalystOS Create This (brief → write) ----------
  startCtx() { const st = this.state, c = st.way === 'campaign' ? this.curCampaign() : this.curCampaign(); return { typeId: st.typeId, topic: st.topic.trim(), campaign: c, start: st.way === 'campaign' && c ? 'campaign' : 'topic' }; }
  defaultAuthor() { const team = this.D.articleBrand().team; const m = team.find((x) => /founder|principal|ceo|president|managing/i.test(x.title)) || null; return m ? { name: m.name, title: m.title, ...(m.id ? { teamId: m.id } : {}) } : { name: '', title: '' }; }
  // An article as it opens: its byline linked to Brand Command › Team Member Profiles (current name and title, lib/data.js).
  live(a) { if (a && a.author && this.D.linkAuthor) a.author = this.D.linkAuthor(a.author); return a; }
  makeMyself = () => {
    const x = this.startCtx(), D = this.D;
    const brief = D.emptyBrief({ typeId: x.typeId, topic: x.topic, audience: this.state.aud.trim(), start: x.start === 'campaign' ? 'campaign' : x.typeId === 'blank' && !x.topic ? 'blank' : 'topic', campaignId: x.campaign ? x.campaign.id : '', outline: this.T.outlineFor(x.typeId).map((s) => s.heading), cta: x.campaign ? x.campaign.cta || '' : '', researchNote: D.researchNote(this.state.research, x.campaign), research: (this.state.research && this.state.research.facts) || [] });
    const art = this.A.blankArticle({ typeId: x.typeId, sections: this.T.outlineFor(x.typeId), brief, campaignId: x.campaign ? x.campaign.id : '', campaignName: x.campaign ? x.campaign.name : '', start: brief.start, author: this.defaultAuthor() });
    art.title = x.topic && x.topic.length < 90 ? x.topic : '';
    this.markSaved(art); this.setState({ view: 'editor', art, brief, err: '' }); this.focus('[data-bw="title"]');
  };
  createBrief = async () => { const x = this.startCtx(); await this.draftBriefNow(x); };
  async draftBriefNow(x) {
    this.setState({ busy: true, stage: 'Drafting your brief', err: '' });
    try {
      const research = x.campaign ? (this.state.researchFor === x.campaign.id && this.state.research) || (await this.D.campaignResearch(x.campaign.id)) : null;
      const brief = await this.D.draftBrief({ typeId: x.typeId, topic: x.topic, campaign: x.campaign, research, start: x.start });
      if (this.state.aud.trim()) brief.audience = this.state.aud.trim();
      if (COS_AUTO) brief.approved = true; // Autopilot proceeds
      this.setState({ brief, view: 'brief', briefFrom: 'start', busy: false, stage: '' }); this.focus('#bb-brief-h');
      return brief;
    } catch (e) { this.setState({ busy: false, stage: '', err: (e && e.userMessage) || ('The brief could not be drafted: ' + ((e && e.message) || e)) }); throw e; }
  }
  askResearch = async () => {
    const c = this.campaign(this.state.brief && this.state.brief.campaignId) || this.curCampaign(); if (!c) return;
    this.setState({ busy: true, stage: 'Researching this campaign', err: '' });
    try { const r = await this.D.researchCampaign(c, () => {}); /* progress shows in the CatalystOS popup (time only) */ this.setState((st) => ({ busy: false, stage: '', research: r, researchFor: c.id, brief: st.brief ? { ...st.brief, research: r ? r.facts : [], researchNote: this.D.researchNote(r, c), strategyVersion: r ? r.version : 0, researchDate: r && r.facts.length ? new Date().toISOString().slice(0, 10) : '' } : st.brief })); }
    catch (e) { this.setState({ busy: false, stage: '', err: 'The research could not run: ' + ((e && e.message) || e) }); }
  };
  setBrief(k, v) { this.setState((st) => ({ brief: { ...st.brief, [k]: v, approved: false, by: 'person' } })); }
  toggleBrief = () => this.setState((st) => ({ brief: { ...st.brief, approved: !st.brief.approved, approvedAt: !st.brief.approved ? Date.now() : null, approvedBy: !st.brief.approved ? this.D.userEmail() : '' } }));
  // Write the article from the brief: the brief's outline becomes the sections (the type's guidance kept where headings
  // match), then the Senior Writer writes the whole piece in the type's shape.
  writeFromBrief = async () => {
    const st = this.state, b = st.brief; if (!b) return;
    const typeId = b.suggestedType && this.T.typeById(b.suggestedType) ? b.suggestedType : st.typeId;
    const base = this.T.outlineFor(typeId); const used = new Set();
    const sections = (b.outline || []).map((h) => { const o = base.find((x) => !used.has(x.id) && x.heading.toLowerCase() === String(h).toLowerCase()); if (o) { used.add(o.id); return o; } return { id: this.T.newId(), key: '', heading: h, level: 2, body: '', what: '', required: false, kind: '', approved: false }; });
    const c = this.campaign(b.campaignId);
    const prev = st.art;
    const art = prev ? { ...clone(prev), typeId, brief: b, sections: sections.length ? sections : base } : this.A.blankArticle({ typeId, sections: sections.length ? sections : base, brief: b, campaignId: c ? c.id : '', campaignName: c ? c.name : '', start: b.start, author: this.defaultAuthor() });
    await this.writeArticle(art);
  };
  async writeArticle(art0) {
    const art = clone(art0); const c = this.campaign(art.campaignId);
    this.setState({ busy: true, stage: 'Writing your article', err: '', view: this.state.view === 'brief' ? 'brief' : this.state.view });
    try {
      const r = await this.D.writeArticle({ article: art, brief: art.brief, campaign: c, onStatus: () => {} });
      const d = this.A.parseDraft(r.md, art.sections);
      if (!d.sections.length && !d.intro) throw new Error('The writer returned no article text.');
      const out = { ...art, title: d.title || art.title || (art.brief && art.brief.workingTitle) || '', subtitle: d.subtitle || art.subtitle, intro: d.intro, sections: d.sections.length ? d.sections : art.sections, conclusion: d.conclusion,
        cta: { text: d.cta.text || (art.cta && art.cta.text) || '', label: d.cta.label || (art.cta && art.cta.label) || '', url: (art.cta && art.cta.url) || '' },
        sources: this.mergeSources(d.sources, art.brief), review: { ...(art.review || {}), writer: { flags: (r.flags || []).filter((f) => f && !f.supported && !f.removed).slice(0, 12).map((f) => ({ claim: String(f.claim || ''), evidence: String(f.evidence || '') })), supportedPct: r.supportedPct, editorial: r.editorial ? { counts: r.editorial.counts || null } : null, voiceScore: r.voiceScore, at: Date.now() } } };
      if (!out.seo || !out.seo.title) out.seo = { ...(out.seo || {}), ...this.A.seoDefaults(out, (s) => this.slug(s)) };
      this._draft = this.A.articleText(out);
      this.setState({ art: out, view: 'editor', busy: false, stage: '' });
      if (COS_AUTO) await this.persist(out);
      this.runCheck();
      return out;
    } catch (e) { this.setState({ busy: false, stage: '', err: (window.CosAiRefusal && window.CosAiRefusal.since(0)) || ('The article could not be written: ' + ((e && e.message) || e)) }); throw e; }
  }
  // Sources: only the verified research the writer cited (matched by link), never a link the writer made up.
  mergeSources(list, brief) {
    const ok = ((brief && brief.research) || []).filter((f) => f.url); const out = [];
    (list || []).forEach((s) => { const hit = ok.find((f) => f.url === s.url); if (hit && !out.some((x) => x.url === hit.url)) out.push({ title: hit.title || s.title, url: hit.url, publisher: hit.publisher || '' }); });
    return out;
  }
  slug(s) { try { return window.CosArticleModel ? window.CosArticleModel.slugify(s) : String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); } catch (e) { return ''; } }

  // ---------- editing ----------
  edit(fn, { unapprove = null } = {}) {
    this.setState((st) => { if (!st.art) return null; const a = clone(st.art); fn(a); if (unapprove) a.sections.forEach((s) => { if (unapprove === 'all' || unapprove === s.id) s.approved = false; }); return { art: a, saved: '' }; });
  }
  setField(path, v) {
    this.edit((a) => {
      if (path === 'ctaText') a.cta.text = v; else if (path === 'ctaLabel') a.cta.label = v; else if (path === 'ctaUrl') a.cta.url = v;
      else if (path.startsWith('seo.')) a.seo[path.slice(4)] = v; else a[path] = v;
    });
  }
  setSec(id, k, v) { this.edit((a) => { const s = a.sections.find((x) => x.id === id); if (s) { s[k] = v; s.by = 'person'; } }, { unapprove: id }); }
  moveSec(i, d) { this.edit((a) => { const j = i + d; if (j < 0 || j >= a.sections.length) return; const [s] = a.sections.splice(i, 1); a.sections.splice(j, 0, s); }); }
  async removeSec(i) {
    const a = this.state.art; const s = a && a.sections[i]; if (!s) return;
    if ((s.body || '').trim() && !(await window.CosDialog.confirm('Remove the section “' + (s.heading || 'Untitled') + '” and its text?', { title: 'Remove Section?', ok: 'Remove', danger: true }))) return;
    this.edit((x) => { x.sections.splice(i, 1); });
  }
  addSection = () => { this.edit((a) => { a.sections.push({ id: this.T.newId(), key: '', heading: '', level: 2, body: '', what: '', required: false, kind: '', approved: false, by: 'person' }); }); setTimeout(() => { const all = document.querySelectorAll('[data-bb-sec] textarea[aria-label^="Heading"]'); const el = all[all.length - 1]; if (el) el.focus(); }, 80); };
  setAlt = (e) => { const v = e.target.value; this.edit((a) => { if (a.image) { a.image.alt = v; a.image.altReview = false; } a.seo.imageAltText = v; }); };
  setAuthor = (e) => { const v = e.target.value; const m = this.D.articleBrand().team.find((x) => x.name === v); this.edit((a) => { a.author = m ? { name: m.name, title: m.title, ...(m.id ? { teamId: m.id } : {}), ...(a.author && a.author.personId ? { personId: a.author.personId } : {}) } : { name: '', title: '' }; }); };
  replaceImage = async () => {
    const BP = window.CosBrandPhotos, a = this.state.art; if (!BP || !a) return;
    const pool = this.D.articleBrand().photoPool || [];
    const ctx = BP.context({ topic: a.title || (a.brief && a.brief.topic) || '' });
    const fill = await BP.swapDialog({ pool, slot: { id: 'featured', role: 'hero', w: 16, h: 9, src: a.image ? a.image.src : '' }, ctx, current: a.image ? a.image.src : '' });
    if (fill && fill.src) this.edit((x) => { x.image = { src: fill.src, alt: fill.alt || '', altReview: !!fill.altReview || !fill.alt }; x.seo.imageAltText = fill.alt || ''; });
  };
  removeImage = () => this.edit((a) => { a.image = null; a.seo.imageAltText = ''; });
  addSource = () => this.edit((a) => { a.sources.push({ title: '', url: '', publisher: '' }); });
  fillSeo = () => this.edit((a) => { a.seo = { ...a.seo, ...this.A.seoDefaults(a, (s) => this.slug(s)) }; });
  async removeArticleNow() {
    const a = this.state.art; if (!a) return;
    if (!(await window.CosDialog.confirm('Delete “' + (a.title || 'Untitled article') + '”? This removes it from Saved Files too.', { title: 'Delete Article?', ok: 'Delete', danger: true }))) return;
    const known = (this.state.models || []).some((m) => m.articleId === a.id);
    if (known) { await this.D.deleteArticle(a.id).catch(() => {}); this.D.removeSave(a.id); }
    this.markSaved(null); this.setState((st) => ({ models: st.models.filter((m) => m.articleId !== a.id), art: null, view: 'home', brief: null }));
  }
  removeArticle = () => this.removeArticleNow();
  // Approve All (task bar): every section approved (or none). Each change is recorded; approving teaches the Senior Writer.
  toggleAll = () => {
    const a = this.state.art; if (!a) return; const on = !this.A.isApproved(a);
    this.edit((x) => { x.sections.forEach((s) => { s.approved = on; }); x.approvals = (x.approvals || []).concat([{ at: Date.now(), by: this.D.userEmail(), on }]); });
    if (on) this.D.learnApproved(this._draft || '', this.A.articleText(a));
  };
  toggleSec(id) { this.edit((x) => { const s = x.sections.find((y) => y.id === id); if (s) s.approved = !s.approved; const on = x.sections.every((y) => y.approved); x.approvals = (x.approvals || []).concat([{ at: Date.now(), by: this.D.userEmail(), on: !!(s && s.approved), section: id }]); if (on && s && s.approved) this.D.learnApproved(this._draft || '', this.A.articleText(x)); }); }
  runCheck = async () => {
    const a = this.state.art; if (!a) return;
    try { const r = await this.D.reviewChecks(a); this.edit((x) => { x.review = { ...(x.review || {}), check: r, regulated: r.regulated }; }); }
    catch (e) { this.edit((x) => { x.review = { ...(x.review || {}), check: { at: Date.now(), issues: [], error: 'The production check could not run: ' + ((e && e.message) || e) } }; }); }
  };

  // ---------- Download (one navy button, a small chooser) ----------
  download(kind) {
    const a = this.state.art; if (!a) return; this.setState({ dlOpen: false });
    const b = this.D.articleBrand(); const brand = { head: b.head, body: b.body, accent: b.accent, ink: b.ink, fontsHref: b.fontsHref };
    const name = (a.seo && a.seo.slug) || this.slug(a.title) || 'article';
    const map = { html: [this.A.articleHtml(a, brand), 'text/html', '.html'], word: [this.A.articleWord(a, brand), 'application/msword', '.doc'], md: [this.A.articleMarkdown(a), 'text/markdown', '.md'], txt: [this.A.articleText(a), 'text/plain', '.txt'] };
    const [body, type, ext] = map[kind] || map.html;
    const url = URL.createObjectURL(new Blob([body], { type: type + ';charset=utf-8' })); const el = document.createElement('a'); el.href = url; el.download = name + ext; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    this.D.logDownload(kind);
  }

  // ---------- Strategy (opt-in popup: only what is recorded) ----------
  strategyRegister() { (window.CosStrategyReady = window.CosStrategyReady || []).push((S) => S.button('#bb-strategy', () => this.strategyWhy())); }
  strategyWhy() {
    const S = window.CosStrategy; if (!S) return null; const a = this.state.art, b = (a && a.brief) || this.state.brief;
    const camp = a && a.campaignId ? S.campaign('blogbuilder', { campaignId: a.campaignId, noun: 'article' }) : S.campaign('blogbuilder');
    if (!b) return camp;
    const items = [['Angle', b.angle], ['Objective', b.objective], ['Audience', b.audience], ['Search intent', b.searchIntent], ['Research', b.researchNote]].filter(([, v]) => v).map(([name, why]) => ({ name, why }));
    return S.merge ? S.merge(camp, items.length ? { title: 'How this article was planned', items } : null) : (items.length ? { title: 'How this article was planned', items } : camp);
  }

  // ---------- Write First: CatalystOS Write / Rewrite on one text box ----------
  wfRegister() {
    if (COS_AUTO) return;
    (window.CosWriteFieldReady = window.CosWriteFieldReady || []).push((W) => W.watch(() => [...document.querySelectorAll('[data-bw]')].map((el) => {
      const path = el.getAttribute('data-bw'); const label = el.getAttribute('aria-label') || path;
      return { el, label, maxWords: /title|heading/i.test(path) ? 14 : /subtitle/.test(path) ? 30 : /cta/.test(path) ? 45 : 260,
        write: async (ctx) => { const st = this.state; const a = st.art; const t = await this.D.writeField({ article: a, brief: st.brief, campaign: this.campaign((a && a.campaignId) || (st.brief && st.brief.campaignId)), label, current: ctx && ctx.current, around: a ? this.A.articleText(a).slice(0, 2500) : '', maxWords: /title|heading/i.test(path) ? 14 : 260 }); this.applyPath(path, t); },
        hasText: () => !!String(el.value || '').trim() };
    })));
  }
  applyPath(path, t) {
    if (path.startsWith('brief.')) return this.setBrief(path.slice(6), t);
    const m = /^sec\.([^.]+)\.(heading|body)$/.exec(path); if (m) return this.setSec(m[1], m[2], t);
    if (path === 'cta.text') return this.setField('ctaText', t);
    return this.setField(path, t);
  }

  // ---------- Let CatalystOS Create This (floating) and hands-off runs (Run Campaign: kind blog-article) ----------
  cosCreateMount() {
    const go = () => {
      if (!window.CatalystCreate) { if ((this._ccTry = (this._ccTry || 0) + 1) < 60) setTimeout(go, 250); return; }
      window.CatalystCreate.mount({
        enabled: () => this.state.boot === 'ready' && !!this.A && (this.state.view === 'editor' || this.state.view === 'brief') && !this.state.busy,
        noun: () => 'article', modes: ['writing'],
        context: () => { const st = this.state, t = this.T && this.T.typeById((st.art && st.art.typeId) || st.typeId); const c = this.campaign((st.art && st.art.campaignId) || (st.brief && st.brief.campaignId)); return { kind: t ? t.label : 'Article', campaign: c ? c.name : '' }; },
        snapshot: () => JSON.stringify({ art: this.state.art, brief: this.state.brief, view: this.state.view }),
        restore: (snap) => { try { const x = JSON.parse(snap); this.setState({ art: this.live(x.art), brief: x.brief, view: x.view, busy: false, stage: '' }); } catch (e) {} },
        confirmRun: () => { const a = this.state.art; if (!a) return null; return { personText: a.sections.some((s) => s.by === 'person' && String(s.body || '').trim()) || !!String(a.intro || '').trim() && !this._draft, approved: a.sections.filter((s) => s.approved).length }; },
        keepApproved: false,
        run: async () => {
          const st = this.state;
          if (!st.brief) await this.draftBriefNow(this.startCtx());
          const b = this.state.brief; if (!b.approved) this.setState({ brief: { ...b, approved: true, approvedAt: Date.now(), approvedBy: COS_AUTO ? 'CatalystOS' : this.D.userEmail() } });
          await new Promise((r) => setTimeout(r, 0));
          await this.writeFromBrief();
          const a = this.state.art; const n = this.A.sourceFlags(a, this.D.sourceText(a)).length;
          return { notes: n ? ['Check: ' + n + ' claim' + (n === 1 ? '' : 's') + ' need a source (Review panel).'] : [] };
        },
        autoKinds: ['blog-article'],
        autoReady: () => this.state.boot === 'ready' && !!this.A && !!this.T,
        autoPrepare: async (p) => {
          if (p.campaign && !this.campaign(p.campaign)) { try { this.setState({ camps: await this.D.campaigns() }); } catch (e) {} }
          const typeId = this.T.typeById(p.type || p.articleType) ? (p.type || p.articleType) : this.guessType(String(p.title || '') + ' ' + String(p.brief || ''));
          await new Promise((r) => this.setState({ view: 'start', typeId, topic: String(p.title || p.brief || '').trim().slice(0, 600), way: p.campaign ? 'campaign' : 'topic', curCamp: p.campaign || this.state.curCamp, art: null, brief: null }, r));
        },
        autoSave: async (p) => {
          const a = this.state.art; if (!a) throw new Error('Nothing was written.');
          if (p.campaign && a.campaignId !== p.campaign) { const c = this.campaign(p.campaign); a.campaignId = p.campaign; a.campaignName = c ? c.name : ''; }
          const saved = await this.persist(a); this.markSaved(a);
          return { app: 'blogbuilder', ref: saved.articleId, title: saved.title || 'Untitled article', thumb: '', openUrl: this.D.openUrlFor(saved.articleId) };
        },
      });
    };
    go();
  }
  guessType(t) { const s = String(t || '').toLowerCase(); const R = [[/how to|step[- ]by[- ]step|guide to/, 'how-to'], [/\bfaq|questions\b/, 'faq'], [/\bvs\.?\b|versus|compar/, 'comparison'], [/case stud|client story|success/, 'case-study'], [/announc|launch|introduc/, 'product-announcement'], [/recap|webinar|conference|event/, 'event-recap'], [/interview|q&a|conversation with/, 'expert-interview'], [/\b\d+\s+(ways|tips|ideas|reasons|mistakes)\b/, 'list-article'], [/research|survey|study|data/, 'research-article'], [/trend|outlook|market|analysis/, 'industry-analysis'], [/news|joins|welcomes|award|milestone/, 'company-news']]; const hit = R.find(([re]) => re.test(s)); return hit ? hit[1] : 'thought-leadership'; }

  // ---------- render ----------
  renderVals() {
    const st = this.state, ready = st.boot === 'ready', D = this.D, T = this.T, A = this.A;
    const base = { notReady: !ready, isLoading: st.boot === 'loading', bootTitle: st.boot === 'loading' ? 'Loading' : st.boot === 'error' ? 'Something went wrong' : 'Blog Builder', bootMsg: st.bootMsg, hasErr: !!st.err, err: st.err, savedText: st.saved };
    if (!ready || !T || !A) return { ...base, ready: false, isEditor: false, isHome: false, isStart: false, isBrief: false };
    const view = st.view, art = st.art, twOk = !!window.CosTypesWindow;
    const type = T.typeById((art && art.typeId) || st.typeId) || T.BLANK, cat = T.categoryById(type.category);
    const c = this.curCampaign();
    const vals = { ...base, ready: true, isHome: view === 'home', isStart: view === 'start', isBrief: view === 'brief' && !!st.brief, isEditor: view === 'editor' && !!art,
      shellCls: 'bb-shell' + (view === 'home' ? ' bb-home' : view === 'editor' ? ' bb-edit' : ''), showTk: view !== 'home', twOn: view === 'home' && twOk, twMissing: !twOk, twRef: this.twRef, twOpen: this.twOpen,
      newArticle: this.newArticle, busy: !!st.busy, busyNow: !!st.busy, busyTitle: st.stage || 'Working…', typeName: type.label, typeEyebrow: cat ? cat.label : 'Starter Template', typePurpose: type.purpose };
    // ---- home: saved articles Saved Files does not list yet (never lose one) ----
    const models = st.models || [], sf = st.sfRefs;
    const notListed = sf === 'fail' ? models : sf instanceof Set ? models.filter((m) => !sf.has(String(m.articleId))) : [];
    vals.hasRows = view === 'home' && notListed.length > 0; vals.listLabel = sf === 'fail' ? 'Saved Articles (' + notListed.length + ')' : 'Articles Not Yet in Saved Files (' + notListed.length + ')';
    vals.listNote = sf === 'fail' ? 'Saved Files could not be reached, so this client’s articles are listed here.' : 'Open one and save it once to add it to Saved Files.';
    vals.rows = notListed.slice(0, 24).map((m) => ({ name: m.title || 'Untitled article', meta: ((T.typeById(m.templateId) || {}).label || 'Article') + ' · ' + new Date((m.builder || {}).updatedAt || Date.now()).toLocaleDateString(), open: () => this.leaveThen(() => { const a = this.live(A.fromModel(m)); this.markSaved(a); this.setState({ view: 'editor', art: a, brief: a.brief, typeId: a.typeId, err: '' }); }) }));
    // ---- start ----
    vals.matOff = true; vals.wayTopic = st.way !== 'campaign'; vals.wayCamp = st.way === 'campaign' && !!c; vals.noCamp = !c;
    vals.pickTopic = () => this.setState({ way: 'topic' }); vals.pickCamp = () => { if (c) this.setState({ way: 'campaign' }); };
    vals.topicVal = st.topic; vals.setTopic = (e) => this.setState({ topic: e.target.value }); vals.audVal = st.aud; vals.setAud = (e) => this.setState({ aud: e.target.value });
    vals.campLabel = c ? c.name : 'No campaign';
    vals.campLines = c ? [['Goal', c.goal || c.objective], ['Audience', c.targetAudience], ['Key message', c.keyMessage], ['Call to action', c.cta]].filter(([, v]) => v).map(([k, v]) => ({ k, v })) : [];
    const R = st.researchFor === (c ? c.id : '') ? st.research : null;
    vals.stratLine = c ? (R ? 'Campaign Strategy v' + R.version + ' (' + (R.state === 'approved' ? 'approved' : 'draft') + ')' + (R.core ? ': ' + R.core : '') + ' · ' + R.facts.length + ' verified fact' + (R.facts.length === 1 ? '' : 's') + ' for the Writer. The article is linked to this campaign.' : 'No Campaign Strategy research yet. The brief uses the campaign and Brand Command; you can ask the Strategist to research it.') : '';
    vals.makeMyself = this.makeMyself; vals.createBrief = () => this.createBrief().catch(() => {});
    // ---- brief ----
    const b = st.brief || D.emptyBrief({});
    vals.b = { ...b, keyQuestions: (b.keyQuestions || []).join('\n'), outline: (b.outline || []).join('\n'), compliance: (b.compliance || []).join('\n') };
    const listK = { keyQuestions: 1, outline: 1, compliance: 1 };
    vals.bset = Object.fromEntries(['workingTitle', 'audience', 'objective', 'searchIntent', 'angle', 'keyQuestions', 'clientContent', 'suggestedType', 'outline', 'cta', 'compliance'].map((k) => [k, (e) => this.setBrief(k, listK[k] ? lines(e.target.value) : e.target.value)]));
    vals.typeOpts = T.ARTICLE_TYPES.map((t) => ({ id: t.id, label: t.label })).concat([{ id: 'blank', label: 'Blank Article' }]);
    vals.researchRows = (b.research || []).map((f) => ({ fact: f.fact, attribution: f.attribution || f.publisher || 'source', url: f.url, hasUrl: /^https?:/.test(f.url || '') }));
    vals.hasResearch = vals.researchRows.length > 0;
    vals.canResearch = !D.PREVIEW && !vals.hasResearch && !!(b.campaignId || c);
    vals.askResearch = this.askResearch;
    vals.briefIntro = b.by === 'agent' ? 'The Strategist drafted this brief from ' + (b.start === 'campaign' ? 'the campaign and its strategy' : 'your topic') + ' and Brand Command. Edit anything, approve it, then the Senior Writer writes the article in the ' + type.label + ' shape.' : 'Edit the brief, approve it, then the Senior Writer writes the article.';
    vals.briefOn = !!b.approved; vals.briefOnLabel = b.approved ? 'Approved' : 'Approve'; vals.toggleBrief = this.toggleBrief;
    vals.writeOff = !b.approved || !!st.busy; vals.writeLabel = art && (art.sections || []).some((s) => s.body) ? 'Rewrite the Article' : 'Write the Article';
    vals.writeTitle = b.approved ? 'The Senior Writer writes the whole article from this brief. Claims that need a source are flagged, never invented.' : 'Approve the brief to write the article.';
    vals.writeFromBrief = () => this.writeFromBrief().catch(() => {}); vals.hasArt = !!art; vals.backToArticle = () => this.setState({ view: 'editor' });
    if (!vals.isEditor) return vals;
    // ---- editor ----
    const brand = D.articleBrand(); const ff = (f, fb) => "'" + String(f).replace(/'/g, '') + "'," + fb;
    vals.paperStyle = '--bb-accent:' + brand.accent + ';';
    vals.h1Style = 'font:800 clamp(28px,3.4vw,40px)/1.18 ' + ff(brand.head, 'Manrope,sans-serif') + ';color:' + brand.accent + ';';
    vals.dekStyle = 'font:500 19px/1.45 ' + ff(brand.body, 'Inter,sans-serif') + ';color:#3A4159;';
    vals.bodyStyle = 'font:400 17px/1.65 ' + ff(brand.body, 'Inter,sans-serif') + ';color:#14182B;';
    vals.ctaBox = 'border:2px solid ' + brand.accent + ';border-radius:12px;padding:12px 16px;';
    vals.a = { title: art.title, subtitle: art.subtitle, intro: art.intro, conclusion: art.conclusion, ctaText: art.cta.text, ctaLabel: art.cta.label, ctaUrl: art.cta.url };
    vals.aset = Object.fromEntries(['title', 'subtitle', 'intro', 'conclusion', 'ctaText', 'ctaLabel', 'ctaUrl'].map((k) => [k, (e) => this.setField(k, e.target.value)]));
    vals.titleRows = Math.max(1, Math.ceil((art.title || '').length / 38)); vals.introRows = rowsFor(art.intro, 3); vals.conRows = rowsFor(art.conclusion, 2);
    const flags = A.sourceFlags(art, D.sourceText(art));
    const n = art.sections.length;
    vals.secRows = art.sections.map((s, i) => { const f = flags.filter((x) => x.where === (s.heading || 'Section')); const lv = s.level === 3 ? 3 : 2;
      return { id: s.id, n: 'Section ' + (i + 1) + ' · ' + (lv === 3 ? 'Subsection (H3)' : 'H2') + (s.required ? ' · Required' : ''), aria: 'Section ' + (i + 1) + ': ' + (s.heading || 'untitled'), heading: s.heading, body: s.body,
        hPath: 'sec.' + s.id + '.heading', bPath: 'sec.' + s.id + '.body', hAria: 'Heading of section ' + (i + 1), bAria: 'Text of section ' + (i + 1) + (s.heading ? ': ' + s.heading : ''),
        hStyle: 'font:800 ' + (lv === 3 ? '21px' : '26px') + '/1.25 ' + ff(brand.head, 'Manrope,sans-serif') + ';color:' + brand.accent + ';', rows: rowsFor(s.body, 3), ph: s.what ? 'Write: ' + s.what : 'Write this section',
        on: !!s.approved, apLabel: s.approved ? 'Approved' : 'Approve', apAria: (s.approved ? 'Approved' : 'Approve') + ' section ' + (i + 1), toggle: () => this.toggleSec(s.id),
        lvlLabel: lv === 3 ? 'Make H2' : 'Make H3', lvlAria: (lv === 3 ? 'Make section ' + (i + 1) + ' a main section (H2)' : 'Make section ' + (i + 1) + ' a subsection (H3)'), lvl: () => this.setSec(s.id, 'level', lv === 3 ? 2 : 3),
        first: i === 0, last: i === n - 1, up: () => this.moveSec(i, -1), down: () => this.moveSec(i, 1), upAria: 'Move section ' + (i + 1) + ' up', downAria: 'Move section ' + (i + 1) + ' down', remove: () => this.removeSec(i), rmAria: 'Remove section ' + (i + 1),
        setHeading: (e) => this.setSec(s.id, 'heading', e.target.value), setBody: (e) => this.setSec(s.id, 'body', e.target.value),
        hasFlags: f.length > 0, flagText: (f.length === 1 ? '1 claim here needs' : f.length + ' claims here need') + ' a source: ' + f.map((x) => '“' + x.text.slice(0, 90) + (x.text.length > 90 ? '…' : '') + '”').join(' ') }; });
    vals.addSection = this.addSection;
    vals.srcRows = (art.sources || []).map((s, i) => ({ n: i + 1, lbl: 'Source ' + (i + 1) + ' title', title: s.title, url: s.url, setTitle: (e) => { const v = e.target.value; this.edit((a) => { a.sources[i].title = v; }); }, setUrl: (e) => { const v = e.target.value; this.edit((a) => { a.sources[i].url = v; }); }, remove: () => this.edit((a) => { a.sources.splice(i, 1); }), rmAria: 'Remove source ' + (i + 1) }));
    vals.noSources = !vals.srcRows.length; vals.addSource = this.addSource;
    // image
    const pool = brand.photoPool || [];
    vals.hasImg = !!(art.image && art.image.src); vals.noImg = !vals.hasImg; vals.imgSrc = vals.hasImg ? art.image.src : ''; vals.imgAlt = (art.image && art.image.alt) || ''; vals.altReview = !!(art.image && art.image.altReview);
    vals.noPhotos = !pool.length || !window.CosBrandPhotos; vals.imgEmpty = pool.length ? 'No featured image yet. Use Replace Image to pick one from Brand Command.' : 'No featured image. Add photos in Brand Command › Images to use one here.';
    vals.imgTitle = pool.length ? 'Pick a featured image from Brand Command photos' : 'Add photos in Brand Command › Images first';
    vals.replaceImage = this.replaceImage; vals.removeImage = this.removeImage; vals.setAlt = this.setAlt;
    vals.authorVal = (art.author && art.author.name) || ''; vals.authorOpts = brand.team.map((m) => ({ name: m.name, label: m.name + (m.title ? ', ' + m.title : '') })); vals.setAuthor = this.setAuthor;
    // header card
    const ap = A.isApproved(art), nAp = art.sections.filter((s) => s.approved).length;
    vals.pill = ap ? '✓ Approved' : 'Needs review'; vals.pillStyle = 'font:800 12px Manrope,sans-serif;border-radius:999px;padding:4px 10px;' + (ap ? 'color:#1A6B2E;background:#E3F6EA;border:1px solid rgba(26,107,46,.35);' : 'color:#FFFFFF;background:#B42318;');
    const words = A.articleText(art).split(/\s+/).filter(Boolean).length;
    vals.artMeta = [words + ' words (' + type.words[0] + '–' + type.words[1] + ' for this type)', art.campaignName ? 'Campaign: ' + art.campaignName : 'No campaign', nAp + ' of ' + n + ' sections approved'].join(' · ');
    vals.allOn = ap; vals.allLabel = 'Approve All'; vals.toggleAll = this.toggleAll;
    vals.saveNow = () => this.saveNow(false); vals.saveOff = !!st.saveBusy;
    vals.removeArticle = this.removeArticle;
    vals.dlOpen = !!st.dlOpen; vals.toggleDl = () => { this.setState({ dlOpen: !st.dlOpen }); if (!st.dlOpen) setTimeout(() => { const f = document.querySelector('#bb-dl-menu button'); if (f) f.focus(); }, 30); };
    vals.dlKey = (e) => { const items = [...document.querySelectorAll('#bb-dl-menu button')]; const i = items.indexOf(document.activeElement); if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); items[(i + 1) % items.length].focus(); } if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); } if (e.key === 'Escape') { this.setState({ dlOpen: false }); const t = document.querySelector('[data-cos-download]'); if (t) t.focus(); } };
    vals.dlOpts = [['html', 'Web Page (HTML)', 'In the client’s fonts and colors'], ['word', 'Word (.doc)', 'Opens in Microsoft Word'], ['md', 'Markdown (.md)', 'For most blog platforms'], ['txt', 'Plain Text (.txt)', 'Words only']].map(([k, label, note]) => ({ label, note, go: () => this.download(k) }));
    // right panel
    const rp = st.rp; vals.rp = rp; vals.rpT = Object.fromEntries(Object.keys(rp).map((k) => [k, () => this.setState({ rp: { ...rp, [k]: !rp[k] } })]));
    const ab = art.brief || {};
    vals.briefSt = ab.approved ? 'Approved' : ab.by === 'agent' ? 'Draft' : 'Yours';
    vals.briefRows = [['Topic', ab.topic], ['Audience', ab.audience], ['Objective', ab.objective], ['Angle', ab.angle], ['Search intent', ab.searchIntent], ['Call to action', ab.cta], ['Research', ab.researchNote]].filter(([, v]) => v).map(([k, v]) => ({ k, v }));
    if (!vals.briefRows.length) vals.briefRows = [{ k: 'Brief', v: 'No brief yet. Edit the Brief to plan the article before CatalystOS writes it.' }];
    vals.editBrief = () => this.setState((s2) => ({ view: 'brief', brief: s2.art.brief || D.emptyBrief({ typeId: s2.art.typeId, outline: s2.art.sections.map((x) => x.heading).filter(Boolean), campaignId: s2.art.campaignId, researchNote: D.researchNote(s2.research, this.campaign(s2.art.campaignId)) }), briefFrom: 'editor' }));
    vals.flagRows = flags.slice(0, 20); vals.hasFlags = flags.length > 0; vals.flagCount = flags.length;
    const w = (art.review && art.review.writer) || null;
    vals.hasWriterNote = !!w; vals.writerNote = w ? 'Senior Writer claim check: ' + (w.supportedPct == null ? 'no outside claims to check.' : w.supportedPct + '% of checked claims supported.') + (w.flags && w.flags.length ? ' ' + w.flags.length + ' unsupported claim' + (w.flags.length === 1 ? ' was' : 's were') + ' removed or flagged.' : '') : '';
    const chk = art.review && art.review.check;
    vals.issueRows = chk && chk.issues ? chk.issues.slice(0, 12).map((i) => ({ sev: i.severity, sevStyle: 'background:' + (SEV[i.severity] || '#4B5563') + ';', where: i.where ? i.where + ':' : '', text: i.text, action: i.action })) : [];
    vals.hasIssues = vals.issueRows.length > 0;
    vals.checkNote = !chk ? 'Not run yet: placeholders, unsupported figures, links, headings, quotes and compliance screening for ' + (brand.industry || 'the client’s industry') + '.' : chk.error ? chk.error : (chk.issues.length ? chk.issues.length + ' finding' + (chk.issues.length === 1 ? '' : 's') : 'No findings') + ' · checked ' + new Date(chk.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + (chk.profile ? ' · ' + chk.profile + ' rules' : '') + '. Screening only: CatalystOS never certifies compliance.';
    vals.checkLabel = chk ? 'Check Again' : 'Run the Production Check'; vals.runCheck = this.runCheck;
    vals.reviewSt = ap ? 'Approved' : 'Needs review';
    vals.reviewIntro = ap ? 'Every section is approved. Editing a section sends it back to review.' : 'Approve each section in the article (or Approve All). Editing a section sends it back to review.';
    const last = (art.approvals || []).slice(-1)[0];
    vals.approvalNote = last ? (last.on ? 'Last approval' : 'Last change') + ': ' + new Date(last.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + (last.by ? ' by ' + last.by : '') + '.' : 'No approvals recorded yet.';
    const seo = art.seo || {}; vals.seo = seo;
    vals.sset = Object.fromEntries(['title', 'metaDescription', 'slug', 'excerpt'].map((k) => [k, (e) => this.setField('seo.' + k, e.target.value)]));
    vals.seoTitleCount = (seo.title || '').length + ' of 60 characters'; vals.seoMetaCount = (seo.metaDescription || '').length + ' of 155 characters';
    vals.slugNote = seo.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(seo.slug) ? 'Use only lowercase letters, numbers and single hyphens.' : 'Lowercase words joined by hyphens.';
    vals.seoSt = seo.title && seo.metaDescription && seo.slug ? 'Set' : 'To do'; vals.fillSeo = this.fillSeo;
    return vals;
  }
}
