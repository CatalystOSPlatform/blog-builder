// Blog Builder — Download Article → PDF. The article laid out on Letter pages in the client's Brand Command fonts and
// colors (title, dek, "From: …" byline, date, headings, body, images and charts, page numbers), then drawn by the shared
// CatalystOS vector PDF writer (pilot-dash doc-pdf.js, the one the Document Builder and founder profiles use): real
// selectable text in the embedded fonts, working links, tagged headings, lists and figures with their alt text.
// Browser only. Same page layout approach as pilot-dash founder-pdf.js.
import { pdfBlocks, esc } from './export.js';

const W = 816, H = 1056, M = 72, TOP = 64, FOOT = 48; // Letter at 96 px per inch, 0.75 in margins
const fam = (f, fb) => (f ? '"' + String(f).replace(/["<>;{}]/g, '') + '", ' : '') + fb;

async function loadFonts(families, doc) {
  const fams = [...new Set(families.filter((f) => f && !/^(arial|helvetica|georgia|times|system-ui)/i.test(f)))]; if (!fams.length) return;
  const href = 'https://fonts.googleapis.com/css2?' + fams.map((f) => 'family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;600;700;800').join('&') + '&display=swap';
  if (!doc.querySelector('link[data-bbpdf="' + href + '"]')) { const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset.bbpdf = href; doc.head.appendChild(l); await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 5000); }); }
  await Promise.all(fams.flatMap((f) => [400, 700, 800].map((w) => doc.fonts.load(w + ' 14px "' + f + '"').catch(() => null))));
}
function css(b) {
  const hf = fam(b.head, '"Manrope", Arial, sans-serif'), bf = fam(b.body, '"Inter", Arial, sans-serif'), ac = /^#[0-9a-f]{6}$/i.test(b.accent || '') ? b.accent : '#0E2266';
  return '.bbp-page{position:relative;width:' + W + 'px;height:' + H + 'px;background:#FFFFFF;color:#14182B;font-family:' + bf + ';font-size:15px;line-height:1.55;box-sizing:border-box;overflow:hidden}'
    + '.bbp-page *{box-sizing:border-box}'
    + '.bbp-body{position:absolute;left:' + M + 'px;right:' + M + 'px;top:' + TOP + 'px;bottom:' + (FOOT + 28) + 'px}'
    + '.bbp-foot{position:absolute;left:' + M + 'px;right:' + M + 'px;bottom:32px;display:flex;justify-content:space-between;gap:16px;font-size:11px;color:#4A5168;border-top:1px solid #D5D9E3;padding-top:8px}'
    + '.bbp-foot span:first-child{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
    + '.bbp-page h1{font-family:' + hf + ';font-weight:800;font-size:32px;line-height:1.15;color:' + ac + ';margin:0 0 10px}'
    + '.bbp-page h2{font-family:' + hf + ';font-weight:800;font-size:22px;line-height:1.25;color:' + ac + ';margin:22px 0 8px}'
    + '.bbp-page h3{font-family:' + hf + ';font-weight:700;font-size:17px;line-height:1.3;color:' + ac + ';margin:16px 0 6px}'
    + '.bbp-page p{margin:0 0 10px}.bbp-page .dek{font-size:18px;color:#3A4159;margin-bottom:12px}.bbp-page .by{font-size:13px;color:#4A5168;margin:0 0 2px}'
    + '.bbp-page .by + .by{margin-bottom:18px}'
    + '.bbp-page a{color:' + ac + ';text-decoration:underline}'
    + '.bbp-page ul,.bbp-page ol{margin:0 0 4px;padding-left:24px}.bbp-page li{margin:0}'
    + '.bbp-page .callout{border-left:4px solid ' + ac + ';background:#F4F5F8;padding:10px 14px}'
    + '.bbp-page .cta{border:2px solid ' + ac + ';border-radius:10px;padding:10px 14px 2px;margin:14px 0}'
    + '.bbp-page .fig{margin:14px auto 14px auto}.bbp-page .fig-left{margin-left:0}.bbp-page .fig-right{margin-right:0}'
    + '.bbp-page .fig img,.bbp-page .fig svg{display:block;width:100%;height:auto;max-height:560px;object-fit:contain}'
    + '.bbp-page figcaption{font-size:12px;color:#4A5168;margin-top:6px}';
}
// Lays the blocks out on Letter pages (off screen) → { pages, cleanup }
export async function layoutPages({ blocks, brand, footer, doc = document }) {
  const host = doc.createElement('div'); host.inert = true; host.setAttribute('inert', ''); host.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + W + 'px;pointer-events:none;z-index:-1';
  const st = doc.createElement('style'); st.textContent = css(brand); host.appendChild(st); doc.body.appendChild(host);
  const pages = []; let body = null;
  const newPage = () => { const pg = doc.createElement('div'); pg.className = 'bbp-page'; pg.setAttribute('lang', 'en-US'); pg.innerHTML = '<div class="bbp-body"></div><div class="bbp-foot" data-artifact="pagination"><span>' + esc(footer) + '</span><span class="pn"></span></div>'; host.appendChild(pg); pages.push(pg); body = pg.querySelector('.bbp-body'); };
  newPage();
  const fits = () => body.scrollHeight <= body.clientHeight + 1;
  const loaded = (els) => Promise.all(els.flatMap((e) => (e.querySelectorAll ? [...e.querySelectorAll('img')] : [])).map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; setTimeout(r, 6000); }))));
  for (let i = 0; i < blocks.length; i++) {
    const group = [blocks[i]]; while (group[group.length - 1].keep && i + 1 < blocks.length) group.push(blocks[++i]);
    const els = group.map((b) => { const t = doc.createElement('template'); t.innerHTML = b.html.trim(); return t.content.firstElementChild || doc.createTextNode(''); });
    els.forEach((e) => body.appendChild(e)); await loaded(els);
    if (!fits() && body.children.length > els.length) { els.forEach((e) => e.remove()); newPage(); els.forEach((e) => body.appendChild(e)); }
  }
  pages.forEach((pg, i) => { pg.querySelector('.pn').textContent = 'Page ' + (i + 1) + ' of ' + pages.length; });
  return { pages, cleanup: () => host.remove() };
}
// → { blob, report, pages }
export async function articlePdf(a, { brand = {}, clientName = '', figSrc, pdfFromPages, fontFiles = {}, doc = document } = {}) {
  await loadFonts([brand.head, brand.body, 'Manrope', 'Inter'], doc);
  const blocks = pdfBlocks(a, { clientName: clientName || brand.name, figSrc });
  const title = String(a.title || '').replace(/\s*\[Source needed\]/gi, '').trim() || 'Article';
  const { pages, cleanup } = await layoutPages({ blocks, brand, footer: title + (brand.name ? ' · ' + brand.name : ''), doc });
  try {
    const out = await pdfFromPages(pages, { title, author: (a.author && a.author.name) || clientName || brand.name || '', subject: String(a.subtitle || '').trim() || title, lang: 'en-US', pageSize: [612, 792], ptPerPx: 0.75, fontFiles });
    return { ...out, pages: pages.length };
  } finally { cleanup(); }
}
