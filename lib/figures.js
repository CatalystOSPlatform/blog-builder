// Blog Builder — images and charts placed in the article (Erika, Oct 30: "Add the ability to add an image into the blog
// from Brand Command, or a chart/graph, or upload"). Pure functions (browser and Node tests).
//
// A figure: { id, kind: 'image'|'chart', origin: 'brand'|'upload'|'chart', src, alt, decorative, caption, credit,
//   size: 'full'|'medium'|'small', align: 'center'|'left'|'right', at: { where, after }, photoId?, name?, savedToBrand?,
//   chart?: { type: 'bar'|'line'|'pie', title, unit, category, labels: [..], series: [{ name, values: [numbers] }], source } }
// at.where is 'intro', a section id or 'conclusion'; at.after is how many blocks of that text (paragraphs, lists,
// callouts: a blank line separates them) come before the figure: 0 = before the first, a large number = at the end.
// The article keeps them in `figures` (saved under the article model's builder.figures, and as image blocks in place).
// Chart numbers are only what the person typed: nothing is filled in, rounded or made up.

const str = (v) => (v == null ? '' : String(v));
export const END = 9999;
export const SIZES = [['full', 'Full Width'], ['medium', 'Medium'], ['small', 'Small']];
export const ALIGNS = [['center', 'Center'], ['left', 'Left'], ['right', 'Right']];
export const SIZE_PCT = { full: 100, medium: 66, small: 40 };
export const CHART_TYPES = [['bar', 'Bar Chart', 'Bar Chart'], ['line', 'Line Chart', 'Line Chart'], ['pie', 'Pie Chart', 'Pie Chart']];
export const UPLOAD_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
export const UPLOAD_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.svg,image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
export const UPLOAD_MAX = 8 * 1024 * 1024; // 8 MB
export const UPLOAD_MAX_TEXT = '8 MB';

let n = 0;
export const figId = () => 'fig-' + Date.now().toString(36) + '-' + (++n).toString(36) + Math.random().toString(36).slice(2, 5);

export function newFigure(f = {}) {
  return { id: f.id || figId(), kind: f.kind === 'chart' ? 'chart' : 'image', origin: f.origin || (f.kind === 'chart' ? 'chart' : 'brand'), src: str(f.src), alt: str(f.alt), decorative: !!f.decorative,
    caption: str(f.caption), credit: str(f.credit), size: SIZE_PCT[f.size] ? f.size : 'full', align: ['left', 'right'].includes(f.align) ? f.align : 'center',
    at: { where: str((f.at && f.at.where) || 'intro'), after: Number.isFinite(+(f.at && f.at.after)) ? Math.max(0, Math.floor(+(f.at && f.at.after))) : END },
    ...(f.photoId ? { photoId: str(f.photoId) } : {}), ...(f.name ? { name: str(f.name) } : {}), ...(f.savedToBrand ? { savedToBrand: true } : {}), ...(f.altReview ? { altReview: true } : {}), ...(f.auto ? { auto: true } : {}),
    ...(f.kind === 'chart' ? { chart: cleanChart(f.chart) } : {}) };
}
export const figuresOf = (a) => (Array.isArray(a && a.figures) ? a.figures : []);

// ---------- where figures sit ----------
// The blocks of one text (as bodyToBlocks splits it): blank lines separate them.
export const blockCount = (text) => str(text).replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length;
// The place for "insert at the cursor": after the block the cursor is in.
export function afterForCaret(text, caret) { const t = str(text); const c = Math.max(0, Math.min(t.length, +caret || 0)); return blockCount(t.slice(0, c)); }
// The texts in reading order: [{ where, text, label }]
export function places(a) {
  return [{ where: 'intro', text: str(a && a.intro), label: 'the introduction' }]
    .concat(((a && a.sections) || []).map((s, i) => ({ where: s.id, text: str(s.body), label: 'section ' + (i + 1) + (s.heading ? ' (' + s.heading + ')' : '') })))
    .concat([{ where: 'conclusion', text: str(a && a.conclusion), label: 'the conclusion' }]);
}
// Every slot a figure can take, in reading order: [{ where, after }]
export function slots(a) { const out = []; places(a).forEach((p) => { const k = blockCount(p.text); for (let i = 0; i <= k; i++) out.push({ where: p.where, after: i }); }); return out; }
const clampAt = (a, at) => { const p = places(a).find((x) => x.where === at.where); if (!p) return { where: 'conclusion', after: blockCount(a && a.conclusion) }; return { where: p.where, after: Math.min(blockCount(p.text), Math.max(0, at.after)) }; };
const slotIndex = (a, at) => { const c = clampAt(a, at); return slots(a).findIndex((s) => s.where === c.where && s.after === c.after); };
// Figures in reading order, each with its clamped place.
export function ordered(a) {
  const F = figuresOf(a).map((f, i) => ({ f, i, s: slotIndex(a, f.at) }));
  return F.sort((x, y) => x.s - y.s || x.i - y.i).map((x) => ({ ...x.f, at: clampAt(a, x.f.at) }));
}
// The figures of one text, grouped by how many blocks come before them: Map(after → [figure]).
export function figuresIn(a, where) {
  const m = new Map(); ordered(a).filter((f) => f.at.where === where).forEach((f) => { if (!m.has(f.at.after)) m.set(f.at.after, []); m.get(f.at.after).push(f); }); return m;
}
// Blocks and figures interleaved (the reading order every download uses): [{ block } | { figure }]
export function interleave(a, where, blocks) {
  const m = figuresIn(a, where); const out = [];
  (m.get(0) || []).forEach((f) => out.push({ figure: f }));
  (blocks || []).forEach((b, i) => { out.push({ block: b }); (m.get(i + 1) || []).forEach((f) => out.push({ figure: f })); });
  [...m.keys()].filter((k) => k > (blocks || []).length).sort((x, y) => x - y).forEach((k) => m.get(k).forEach((f) => out.push({ figure: f })));
  return out;
}
export function placeLabel(a, at) {
  const p = places(a).find((x) => x.where === at.where); if (!p) return 'At the end of the article';
  const k = blockCount(p.text), af = Math.min(k, at.after);
  if (!k) return 'In ' + p.label;
  if (af >= k) return 'At the end of ' + p.label;
  if (af === 0) return 'At the start of ' + p.label;
  return 'After paragraph ' + af + ' of ' + k + ' in ' + p.label;
}
// Move one figure up or down one place (past the figure beside it, else to the next paragraph boundary). → figures
export function move(a, id, dir) {
  const list = figuresOf(a).map((f) => ({ ...f, at: clampAt(a, f.at) })); const S = slots(a);
  const ord = ordered({ ...a, figures: list }); const k = ord.findIndex((f) => f.id === id); if (k < 0) return list;
  const me = ord[k], si = slotIndex(a, me.at), nb = ord[k + dir];
  if (nb && slotIndex(a, nb.at) === si) { // swap with the figure in the same place
    const i = list.findIndex((f) => f.id === me.id), j = list.findIndex((f) => f.id === nb.id); const t = list[i]; list[i] = list[j]; list[j] = t; return list; }
  const to = S[si + dir]; if (!to) return list;
  const i = list.findIndex((f) => f.id === id); const f = { ...list[i], at: { ...to } }; list.splice(i, 1);
  // it goes first in its new place when moving down, last when moving up
  const same = list.map((x, j) => ({ x, j })).filter(({ x }) => x.at.where === to.where && x.at.after === to.after);
  const at = !same.length ? list.length : dir > 0 ? same[0].j : same[same.length - 1].j + 1; list.splice(at, 0, f); return list;
}
export const canMove = (a, id, dir) => { const before = JSON.stringify(figuresOf(a).map((f) => [f.id, clampAt(a, f.at)])); return JSON.stringify(move(a, id, dir).map((f) => [f.id, f.at])) !== before; };
// A section is removed: its figures move to the end of the text before it (never lost).
export function reanchor(a, removedId) {
  const P = places(a); const i = P.findIndex((p) => p.where === removedId); const prev = P[Math.max(0, i - 1)];
  return figuresOf(a).map((f) => (f.at.where === removedId ? { ...f, at: { where: prev.where, after: END } } : f));
}
// Figures whose place is gone (a section removed elsewhere): at the end of the conclusion.
export const orphanFix = (a) => figuresOf(a).map((f) => (places(a).some((p) => p.where === f.at.where) ? f : { ...f, at: { where: 'conclusion', after: END } }));

// ---------- alt text ----------
export const altProblem = (f) => (f.decorative ? '' : str(f.alt).trim() ? '' : f.kind === 'chart' ? '' : 'Add alt text, or mark the image as decorative.');
// The text a reader gets in place of the picture (empty when decorative).
export function altOf(f) { if (f.decorative) return ''; if (str(f.alt).trim()) return str(f.alt).trim(); return f.kind === 'chart' ? chartAlt(f.chart) : ''; }

// ---------- charts ----------
// Strict numbers: "1,250", "12.5%", "$40", "-3" → number; anything else → NaN (never guessed).
export function parseNum(s) { const t = str(s).trim().replace(/^\$/, '').replace(/%$/, '').replace(/,(?=\d{3}(\D|$))/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? +t : NaN; }
export function cleanChart(c = {}) {
  const labels = (c.labels || []).map(str); const series = (c.series && c.series.length ? c.series : [{ name: '', values: [] }]).map((s) => ({ name: str(s.name), values: labels.map((_, i) => (s.values && s.values[i] != null && s.values[i] !== '' ? s.values[i] : '')) }));
  return { type: ['bar', 'line', 'pie'].includes(c.type) ? c.type : 'bar', title: str(c.title), unit: str(c.unit), category: str(c.category), labels, series, source: str(c.source) };
}
export const blankChart = () => ({ type: 'bar', title: '', unit: '', category: '', labels: ['', '', ''], series: [{ name: '', values: ['', '', ''] }], source: '' });
// The chart as typed → the numbers to draw, or what is missing. { ok, problems: [..], chart (numbers only, empty rows dropped) }
export function checkChart(c0) {
  const c = cleanChart(c0); const problems = [];
  const rows = c.labels.map((l, i) => ({ l: l.trim(), v: c.series.map((s) => str(s.values[i]).trim()) })).filter((r) => r.l || r.v.some(Boolean));
  if (!c.title.trim()) problems.push('Give the chart a title.');
  rows.forEach((r, i) => { if (!r.l) problems.push('Row ' + (i + 1) + ' needs a label.'); r.v.forEach((v, j) => { if (!v) problems.push('Row ' + (i + 1) + (c.series.length > 1 ? ', ' + (c.series[j].name || 'series ' + (j + 1)) : '') + ' needs a number.'); else if (!Number.isFinite(parseNum(v))) problems.push('“' + v + '” in row ' + (i + 1) + ' is not a number.'); }); });
  if (rows.length < 2) problems.push('Add at least two rows of data.');
  if (c.series.length > 1 && c.series.some((s) => !s.name.trim())) problems.push('Name each series.');
  if (c.type === 'pie') { if (c.series.length > 1) problems.push('A pie chart shows one series. Use a bar chart for more.'); if (rows.some((r) => Number.isFinite(parseNum(r.v[0])) && parseNum(r.v[0]) <= 0)) problems.push('A pie chart needs numbers above zero.'); }
  const out = { ...c, labels: rows.map((r) => r.l), series: c.series.map((s, j) => ({ name: s.name.trim() || c.title.trim() || 'Value', values: rows.map((r) => parseNum(r.v[j])) })) };
  return { ok: !problems.length, problems, chart: out };
}
// A designer-charts.js spec (the shared CatalystOS chart drawing) from a checked chart.
export function chartSpec(c, id = '') {
  const t = (CHART_TYPES.find((x) => x[0] === c.type) || CHART_TYPES[0])[2];
  return { id, type: t, title: c.title, unit: c.unit, categoryLabel: c.category || '', labels: c.labels.slice(), series: c.series.map((s) => ({ name: s.name, values: s.values.slice() })), source: c.source || '', axis: { min: null } };
}
const fmt = (v, unit) => { if (!Number.isFinite(v)) return ''; const s = Math.abs(v) >= 1000 ? v.toLocaleString('en-US') : String(v); return unit === '%' ? s + '%' : unit === '$' ? '$' + s : s + (unit ? ' ' + unit : ''); };
// Alt text for a chart: its title and every value (the data table in words).
export function chartAlt(c) {
  if (!c) return 'Chart';
  const kind = (CHART_TYPES.find((x) => x[0] === c.type) || CHART_TYPES[0])[1].toLowerCase();
  return (c.title || 'Chart') + ' (' + kind + '): ' + (c.labels || []).map((l, i) => l + ' ' + (c.series || []).map((s) => ((c.series.length > 1 ? s.name + ' ' : '') + fmt(s.values[i], c.unit))).join(', ')).join('; ') + '.' + (c.source ? ' Source: ' + c.source + '.' : '');
}
// The data as rows for a table: { head: [..], rows: [[..]] }
export function chartTable(c) {
  return { head: [c.category || 'Item'].concat((c.series || []).map((s) => s.name + (c.unit ? ' (' + c.unit + ')' : ''))), rows: (c.labels || []).map((l, i) => [l].concat((c.series || []).map((s) => fmt(s.values[i], c.unit === '%' || c.unit === '$' ? c.unit : '')))) };
}
// The theme the chart is drawn in: the client's accent first, then readable brand colors (fallbacks are dark, AA on white).
export function chartTheme(brand = {}) {
  // only colors that stand out on white (3:1, WCAG 1.4.11), so no slice or bar disappears
  const lum = (h) => { const n = parseInt(h.slice(1), 16); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  const cols = [brand.accent].concat(brand.colors || []).filter((c, i, a) => /^#[0-9a-f]{6}$/i.test(c || '') && a.indexOf(c) === i && 1.05 / (lum(c) + 0.05) >= 3);
  return { ink: '#14182B', sub: '#4A5168', grid: '#D9DCE3', paper: '#FFFFFF', colors: cols.concat(['#3B4A6B', '#B54708', '#1A6B2E', '#6818F8', '#0E7490']).slice(0, 8), font: "'" + str(brand.body || 'Inter').replace(/'/g, '') + "', Inter, Arial, sans-serif" };
}
export const svgDataUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

// The line under a picture: its caption and credit; a chart without a caption shows its title (and source).
export function captionOf(f) {
  const cap = str(f.caption).trim() || (f.kind === 'chart' && f.chart ? [str(f.chart.title).trim(), f.chart.source ? 'Source: ' + str(f.chart.source).trim() : ''].filter(Boolean).join('. ') : '');
  return { caption: cap, credit: str(f.credit).trim() };
}

// ---------- uploads ----------
export function uploadProblem(file) {
  if (!file) return 'Choose a picture.';
  const ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1] || '';
  if (!UPLOAD_TYPES[file.type] && !/^(png|jpe?g|webp|gif|svg)$/i.test(ext)) return 'That file type isn’t supported. Use PNG, JPG, WebP, GIF or SVG.';
  if (file.size > UPLOAD_MAX) return 'That picture is ' + (file.size / 1048576).toFixed(1) + ' MB. The limit is ' + UPLOAD_MAX_TEXT + '.';
  return '';
}
// Alt text never comes from a file name; the person writes it (a file name is only a hint in the field's placeholder).
export const nameHint = (name) => str(name).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
