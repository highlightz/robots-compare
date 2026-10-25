import { FIELDS, EVIDENCE_TYPES, BODY_TYPES, PRODUCT_STATES, claimFor, titleFor, makerFor, escapeHTML as e, formatClaim, completeness, sameKnownClaims, filterRobots, validateCatalog } from './core.e1b56426ce3f5f32.js';
import { EDITABLE } from './runtime.e1b56426ce3f5f32.js';
import { SELECT_KEY, loadSelection, saveSelection as persistSelection } from './selection.e1b56426ce3f5f32.js';

const $ = selector => document.querySelector(selector);
// Stay within the app while choosing products; static pages are search entries.
const productHref = r => `#/robots/${e(r.id)}`;
const state = { catalog: null, mode: EDITABLE ? 'file' : 'visitor', etag: null, selected: [], view: 'cards', filters: { q: '', body: '', brand: '', sdk: false, priced: false, minHeight: '', maxPrice: '', currency: 'USD', sort: 'default' }, differences: false, editorId: null, busy: false, recovery: null, editorDirty: false };
let editor = null;
let toastTimer;
const field = key => FIELDS.find(f => f.key === key);
const sourceFor = id => state.catalog.sources.find(s => s.id === id);
const robotFor = id => state.catalog.robots.find(r => r.id === id);
const options = (values, selected) => Object.entries(values).map(([value, label]) => `<option value="${e(value)}" ${value === selected ? 'selected' : ''}>${e(label)}</option>`).join('');
const pill = (text, type = '') => `<span class="pill ${type}">${e(text)}</span>`;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200); }
function image(r, className = '') { return r.image ? `<img class="${className}" src="${e(r.image)}" alt="${e(titleFor(r))} 资料配图（适用范围见详情）" loading="lazy">` : `<div class="image-placeholder ${className}"><span>▥</span>暂无产品图</div>`; }
function evidence(c) { return c.status === 'known' ? `<span class="evidence ${c.reviewStatus === 'conflicting' ? 'warning' : ''}">${e(c.reviewStatus === 'conflicting' ? '口径冲突' : c.reviewStatus === 'pending_review' ? `待审核 · ${EVIDENCE_TYPES[c.evidenceType]}` : EVIDENCE_TYPES[c.evidenceType])}</span>` : ''; }
function selectionButton(r, small = false) { if (r.archived) return '<span class="pill neutral">已归档</span>'; const selected = state.selected.includes(r.id); return `<button type="button" class="${small ? 'icon-button' : 'select-button'} ${selected ? 'selected' : ''}" data-action="select" data-id="${e(r.id)}" aria-pressed="${selected}" aria-label="${selected ? '移除对比' : '加入对比'} ${e(titleFor(r))}">${selected ? '✓' : '+'}${small ? '' : selected ? ' 已加入对比' : ' 加入对比'}</button>`; }
function price(r) { for (const k of ['price_cny', 'price_usd']) { const c = claimFor(r, k); if (c.status === 'known') return `${k === 'price_usd' ? '$' : '¥'}${formatClaim(c, field(k), false)}`; } return '报价待补'; }
function saveSelection() { try { persistSelection(localStorage, state.selected); } catch { /* Selection persistence is optional. */ } }
function renderTray() {
  $('#nav-count').textContent = state.selected.length;
  const selected = state.selected.map(robotFor).filter(Boolean);
  $('#compare-tray').innerHTML = !selected.length ? '' : `<div class="tray-inner"><div class="tray-label"><span class="tray-number">${selected.length}</span><span>对比清单<small>最多选择 4 个配置</small></span></div><div class="tray-products">${selected.map(r => `<button class="tray-chip" data-action="select" data-id="${e(r.id)}" aria-label="移除 ${e(titleFor(r))}">${image(r)}<span>${e(titleFor(r))}</span><b>×</b></button>`).join('')}</div><button class="text-button tray-clear" data-action="clear-selection">清空</button><button class="button primary" data-action="compare" ${selected.length < 2 ? 'disabled' : ''}>开始对比 <span>↗</span></button></div>`;
  document.body.classList.toggle('has-tray', !!selected.length);
}
function parseRoute() { const [path, query = ''] = (location.hash.slice(1) || '/').split('?'); return { path, query: new URLSearchParams(query) }; }
function render() {
  if (!state.catalog) return;
  state.selected = state.selected.filter(id => robotFor(id) && !robotFor(id).archived);
  const { path, query } = parseRoute();
  let nav = 'catalog';
  if (path.startsWith('/robots/')) renderDetail(decodeURIComponent(path.slice(8)));
  else if (path === '/compare') { nav = 'compare'; if (query.has('ids')) { const requested = [...new Set(query.get('ids').split(','))]; state.selected = requested.filter(id => robotFor(id) && !robotFor(id).archived).slice(0, 4); saveSelection(); } renderCompare(); }
  else if (path === '/workspace') { nav = 'workspace'; if (editor) editor.renderWorkspace(); else renderUnavailableWorkspace(); }
  else if (path === '/sources') { nav = 'sources'; renderSources(); }
  else renderCatalog();
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === nav));
  renderTray();
}
function pageHeading(kicker, title, subtitle, actions = '') { return `<section class="page-heading"><div><div class="eyebrow">${e(kicker)}</div><h1>${e(title)}</h1><p>${e(subtitle)}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</section>`; }
function renderCatalog() {
  document.title = 'Robots Compare — 具身机器人产品库';
  const c = { ...state.catalog, robots: state.catalog.robots.filter(r => !r.archived) };
  const knownCount = c.robots.reduce((sum, r) => sum + FIELDS.filter(f => claimFor(r, f.key).status === 'known').length, 0);
  $('#main').innerHTML = `<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> THE EMBODIED ROBOT DATABASE <span class="beta">BETA 0.3</span></div><h1>看清参数，<br>找到合适的<span>机器人。</span></h1><p>从硬件规格到开发支持，按真实配置横向比较。<br class="desktop-break">每一个已收录参数，都有可追溯的依据。</p><a class="hero-link" href="#/sources">我们如何整理数据 <span>↗</span></a></div><div class="hero-visual"><div class="visual-grid"></div><span class="visual-caption">${c.robots[0] ? e(titleFor(c.robots[0])) : '机器人产品资料库'}</span>${c.robots[0] ? image(c.robots[0]) : '<div class="image-placeholder">暂无产品资料</div>'}<span class="visual-note"><i></i> 厂商产品图 · 非性能实测</span><div class="visual-coordinate">01 / PRODUCT ARCHIVE</div></div></section>
  <section class="metrics" aria-label="资料库统计"><div><strong>${String(c.robots.length).padStart(2, '0')}</strong><span>产品配置<small>${new Set(c.robots.map(r => r.productId)).size} 个型号，持续补充</small></span></div><div><strong>${String(c.manufacturers.length).padStart(2, '0')}</strong><span>机器人厂商<small>覆盖国内外厂商</small></span></div><div><strong>${knownCount}</strong><span>已收录参数<small>保留条件与来源</small></span></div><div class="metric-date"><span class="live-dot"></span><span>最近资料更新<strong>${e(c.updatedAt.slice(0, 10).replaceAll('-', '.'))}</strong></span></div></section>
  <section class="catalog-section" id="catalog"><div class="section-top"><div><span class="section-index">01 / EXPLORE</span><h2>机器人产品目录 <span>${c.robots.length}</span></h2></div>${editor ? '<a href="#/workspace" class="subtle-link">补充或修正资料 ↗</a>' : ''}</div><div class="catalog-layout"><aside class="filters"><div class="filters-top"><h3>筛选产品</h3><button class="text-button" data-action="reset-filters">重置</button></div><label class="filter-label" for="brand-filter">制造商</label><select id="brand-filter" data-filter="brand"><option value="">全部制造商</option>${c.manufacturers.map(m => `<option value="${e(m.id)}" ${state.filters.brand === m.id ? 'selected' : ''}>${e(m.name)} · ${e(m.englishName)}</option>`).join('')}</select><label class="filter-label" for="height-filter">最低身高 <span>cm</span></label><input id="height-filter" data-filter="minHeight" type="number" min="0" step="any" placeholder="不限" value="${e(state.filters.minHeight)}"><label class="filter-label" for="price-filter">最高公开报价</label><div class="price-filter"><select data-filter="currency" aria-label="报价币种">${options({ USD: 'USD $', CNY: 'CNY ¥' }, state.filters.currency)}</select><input id="price-filter" data-filter="maxPrice" type="number" min="0" step="any" placeholder="不限" value="${e(state.filters.maxPrice)}"></div><p class="filter-help">仅比较所选币种原价；未知报价不参与价格筛选。</p><div class="filter-divider"></div><label class="check-label"><input type="checkbox" data-filter="sdk" ${state.filters.sdk ? 'checked' : ''}>明确支持二次开发</label><label class="check-label"><input type="checkbox" data-filter="priced" ${state.filters.priced ? 'checked' : ''}>有公开报价</label><div class="filter-note"><span>ⓘ</span><p>空缺不等于厂商未公开。<br>具体缺失原因请看详情。</p></div></aside><div class="catalog-content"><div class="catalog-tools"><label class="search-box"><span aria-hidden="true">⌕</span><input type="search" id="search" placeholder="搜索型号、厂商或关键词…" value="${e(state.filters.q)}" aria-label="搜索机器人"><kbd>/</kbd></label><select data-filter="sort" aria-label="排序">${options({ default: '默认排序', name: '型号名称', height: '身高从低到高', weight: '重量从轻到重', complete: '资料完整度' }, state.filters.sort)}</select><div class="view-switch" aria-label="展示方式"><button data-action="view-cards" class="${state.view === 'cards' ? 'active' : ''}" aria-label="卡片视图" aria-pressed="${state.view === 'cards'}">▦</button><button data-action="view-table" class="${state.view === 'table' ? 'active' : ''}" aria-label="表格视图" aria-pressed="${state.view === 'table'}">☷</button></div></div><div class="category-tabs" role="group" aria-label="机器人形态">${[['', '全部产品'], ...Object.entries(BODY_TYPES).filter(([key]) => c.robots.some(r => r.bodyType === key))].map(([value, label]) => `<button data-action="body" data-value="${value}" class="${state.filters.body === value ? 'active' : ''}">${label}<span>${c.robots.filter(r => !value || r.bodyType === value).length}</span></button>`).join('')}</div><div class="results-line"><span id="result-count"></span><span>选择产品卡片上的 <b>+</b> 开始对比</span></div><div id="results"></div></div></div></section>
  <section class="contribute"><div class="contribute-icon">↗</div><div><span class="section-index">A LIVING DATABASE</span><h2>资料库，和机器人一起进化。</h2><p>参数会变化，配置会更新。每次补充与纠错，都让下一次比较更有依据。</p></div>${editor ? '<a class="button" href="#/workspace">进入资料工作台 <span>↗</span></a>' : '<a class="button" href="#/sources">了解数据与来源 <span>↗</span></a>'}</section>`;
  updateResults();
}
function updateResults() {
  const rows = filterRobots(state.catalog, state.filters);
  $('#result-count').textContent = `显示 ${rows.length} / ${state.catalog.robots.filter(r => !r.archived).length} 个配置`;
  if (!rows.length) { $('#results').innerHTML = `<div class="empty-state"><span>⌕</span><h3>没有符合条件的产品</h3><p>试试减少筛选条件。尚未公开的参数不会当作零参与筛选。</p><button class="button" data-action="reset-filters">重置筛选</button></div>`; return; }
  if (state.view === 'table') { $('#results').innerHTML = `<div class="table-scroll"><table class="catalog-table"><thead><tr><th>产品配置</th><th>身高</th><th>重量</th><th>自由度</th><th>报价</th><th>对比</th></tr></thead><tbody>${rows.map(r => `<tr><th><a href="${productHref(r)}">${e(titleFor(r))}</a><small>${e(makerFor(state.catalog, r).name)}</small></th>${['height', 'weight', 'dof'].map(k => `<td>${e(formatClaim(claimFor(r, k), field(k)))}${claimFor(r, k).reviewStatus === 'conflicting' ? '<small class="warning">口径冲突</small>' : ''}</td>`).join('')}<td>${e(price(r))}</td><td>${selectionButton(r, true)}</td></tr>`).join('')}</tbody></table></div>`; return; }
  $('#results').innerHTML = `<div class="robot-grid">${rows.map(r => `<article class="robot-card ${state.selected.includes(r.id) ? 'is-selected' : ''}"><div class="card-image"><a href="${productHref(r)}" tabindex="-1" aria-hidden="true">${image(r)}</a><span class="card-type">${e(BODY_TYPES[r.bodyType])}</span>${selectionButton(r, true)}</div><div class="card-body"><div class="card-maker">${e(makerFor(state.catalog, r).englishName)} <span>↗</span></div><h3><a href="${productHref(r)}">${e(r.name)}<span>${e(r.configuration)}</span></a></h3><div class="card-specs">${['height', 'weight', 'dof'].map(k => `<div><span>${field(k).label === '全身自由度' ? '自由度' : field(k).label}</span><strong class="${claimFor(r, k).reviewStatus === 'conflicting' ? 'warning' : ''}">${e(formatClaim(claimFor(r, k), field(k)))}${claimFor(r, k).reviewStatus === 'conflicting' ? ' *' : ''}</strong></div>`).join('')}</div><div class="card-bottom"><div><span class="card-price">${e(price(r))}</span><small>${claimFor(r, 'price_usd').status === 'known' ? '不含税费与运费' : '按具体配置询价'}</small></div><a class="detail-link" href="${productHref(r)}" aria-label="查看 ${e(titleFor(r))} 详情">↗</a></div></div><div class="card-footer"><span><i></i>${Object.values(r.specs).some(c => c.status === 'known' && c.reviewStatus === 'pending_review') ? '含待审核参数' : '参数附来源'}</span><span>${completeness(r)}% 已收录</span></div></article>`).join('')}</div>`;
}
function specValue(c, f, showSource = true) {
  const s = sourceFor(c.sourceId);
  const reason = c.status !== 'known' ? c.condition?.match(/^【([^】]+)】/)?.[1] || (c.condition?.startsWith('缺失原因：') ? '缺失原因见下' : '') : '';
  return `<div class="spec-value ${c.status !== 'known' ? 'muted' : ''}"><strong>${e(formatClaim(c, f))}${reason ? ` · ${e(reason)}` : ''}</strong>${evidence(c)}${c.condition ? `<p>${e(c.condition)}</p>` : ''}${showSource && s ? `<a class="source-link" href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)} ↗</a><small class="claim-source-meta">${e(s.publisher)}${s.publishedAt ? ` · 发布 ${e(s.publishedAt)}` : ' · 发布日期未注明'}</small>` : ''}${showSource ? `<small class="claim-source-meta">${c.checkedAt ? `本项资料核验 ${e(c.checkedAt)}` : '专项核验尚未完成'}${c.status !== 'known' ? '；链接可能仅为相关资料或排除错代的依据，不表示厂商从未披露' : ''}</small>` : ''}</div>`;
}
function renderDetail(id) {
  const r = robotFor(id);
  if (!r) { $('#main').innerHTML = '<div class="empty-state"><h1>未找到这个产品配置</h1><a class="button" href="#/">返回目录</a></div>'; return; }
  document.title = `${titleFor(r)} 参数与来源 — Robots Compare`;
  const maker = makerFor(state.catalog, r);
  const siblings = state.catalog.robots.filter(x => x.productId === r.productId && (!x.archived || x.id === r.id));
  $('#main').innerHTML = `${r.archived ? '<div class="info-note"><span>ⓘ</span><p>此配置已归档，不再显示在产品目录中。原始资料与历史保留，可在工作台恢复。</p></div>' : ''}<div class="breadcrumb"><a href="#/">产品目录</a><span>/</span><span>${e(maker.name)}</span><span>/</span>${e(titleFor(r))}</div><section class="detail-hero"><div class="detail-image">${image(r)}</div><div class="detail-intro"><div class="eyebrow">${e(maker.englishName)} / PRODUCT PROFILE</div><h1>${e(r.name)} <span>${e(r.configuration)}</span></h1><div class="tags">${pill(BODY_TYPES[r.bodyType])}${pill(PRODUCT_STATES[r.marketStatus], 'neutral')}${(r.tags || []).map(t => pill(t, 'neutral')).join('')}</div><p>${e(r.description)}</p><div class="detail-price">${e(price(r))}<small>公开报价与采购条件以原始来源为准</small></div><div class="detail-actions">${selectionButton(r)}${editor ? `<button class="button" data-action="edit" data-id="${e(r.id)}">修正资料</button>` : ''}<a class="text-button" href="${e(sourceFor(r.sourceId).url)}" target="_blank" rel="noopener noreferrer">产品官网 ↗</a></div>${siblings.length > 1 ? `<div class="variant-switch"><span>配置版本</span>${siblings.map(v => `<a class="${v.id === r.id ? 'active' : ''}" href="${productHref(v)}">${e(v.configuration)}</a>`).join('')}</div>` : ''}</div></section><div class="info-note"><span>ⓘ</span><p>本页区分厂商资料与独立实测。负载、速度、续航受配置与测试条件影响，请阅读每项备注。资料收录 ${completeness(r)}%，空缺项逐项注明原因；“待继续采集”不表示已经深挖完毕。</p></div><section class="specifications"><div class="section-top"><div><span class="section-index">SPECIFICATION SHEET</span><h2>完整规格与依据</h2></div>${editor ? `<button class="text-button" data-action="edit" data-id="${e(r.id)}">编辑此配置 ↗</button>` : ''}</div>${[...new Set(FIELDS.map(f => f.group))].map(group => `<div class="spec-group"><h3>${e(group)}</h3><dl>${FIELDS.filter(f => f.group === group).map(f => `<div class="spec-row"><dt>${e(f.label)}</dt><dd>${specValue(claimFor(r, f.key), f)}</dd></div>`).join('')}</dl></div>`).join('')}</section>`;
}
function renderUnavailableWorkspace() {
  document.title = '只读产品目录 — Robots Compare';
  $('#main').innerHTML = '<div class="empty-state"><h1>这里是只读产品目录</h1><p>资料维护入口不在此站点提供。你仍可浏览产品、查看来源和进行参数对比。</p><a class="button primary" href="#/">返回产品目录</a></div>';
}
function renderSources() {
  document.title = '数据与来源 — Robots Compare';
  $('#main').innerHTML = `${pageHeading('03 / DATA & SOURCES', '保留未知，标明依据。', '本资料库按具体配置整理。厂商宣称不等同于独立实测，参数条件与审核状态应一起阅读。')}
  <section class="specifications"><h2>如何理解这些资料</h2><p>未公开、待核实、不适用与明确不支持分别记录；未知数值不当作零。价格按原始币种与配置展示，不做未经注明的汇率换算。</p><p>待审核、冲突及估算参数不参与数值筛选。“只显示差异”保留未知、待审核及冲突项。来源访问日期不代表厂商发布日期。</p><p>缺失原因区分待继续采集、本轮未找到、代际/配置不匹配、口径不兼容、原文访问受限等。相关链接可用于解释为什么不能采纳某个旧代数值，不是“厂商从未披露”的证明。概念目标、相对改善和现售规格不可混用；原画面托管复本会注明出处，并保留待审核。</p><p>当前资料范围有限，不是完整市场数据库，也不是采购承诺。请通过原始来源核对最新规格及交付条件。</p></section>
  <section class="specifications"><h2>资料来源 · ${state.catalog.sources.length}</h2>${state.catalog.sources.map(s => `<article class="spec-group"><h3><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)} ↗</a></h3><p>${e(s.publisher)} · 访问日期 ${e(s.accessedAt)}${s.publishedAt ? ` · 发布日期 ${e(s.publishedAt)}` : ' · 发布日期未注明'}</p></article>`).join('')}</section>`;
}
function renderCompare() {
  document.title = '参数对比 — Robots Compare';
  const rows = state.selected.map(robotFor).filter(Boolean);
  $('#main').innerHTML = `${pageHeading('02 / SIDE BY SIDE', '让差异，一目了然。', '按具体配置比较。条件不同的数字，不应直接判断谁更好。', `<button class="button" data-action="share">复制对比链接 ↗</button><a class="button" href="#/">添加产品 +</a>`)}${rows.length < 2 ? `<div class="empty-state"><span>⇄</span><h2>选择至少两个配置开始比较</h2><p>你可以从产品目录添加最多四个配置，比较不同型号，也比较同型号的不同版本。</p><a class="button primary" href="#/">浏览机器人产品</a></div>` : `<div class="compare-toolbar"><span>${rows.length} 个产品配置</span><label class="check-label"><input type="checkbox" id="differences" ${state.differences ? 'checked' : ''}>只显示差异</label></div><div class="table-scroll compare-scroll"><table class="compare-table"><thead><tr><th class="compare-label">产品配置<small>参数带条件与来源</small></th>${rows.map(r => `<th><button class="remove-compare" data-action="remove-compare" data-id="${e(r.id)}" aria-label="移除 ${e(titleFor(r))}">×</button>${image(r)}<span class="card-maker">${e(makerFor(state.catalog, r).englishName)}</span><a href="${productHref(r)}">${e(titleFor(r))} ↗</a><small>${e(BODY_TYPES[r.bodyType])}</small></th>`).join('')}</tr></thead><tbody>${[...new Set(FIELDS.map(f => f.group))].map(group => { const fields = FIELDS.filter(f => f.group === group && (!state.differences || !sameKnownClaims(rows.map(r => claimFor(r, f.key))))); return fields.length ? `<tr class="compare-group"><th colspan="${rows.length + 1}">${e(group)}</th></tr>${fields.map(f => `<tr><th scope="row">${e(f.label)}</th>${rows.map(r => `<td>${specValue(claimFor(r, f.key), f)}</td>`).join('')}</tr>`).join('')}` : ''; }).join('')}</tbody></table></div><div class="info-note"><span>ⓘ</span><p>未知项会保留显示。仅当数值、适用条件、证据类型和审核状态一致时，才视为相同项。</p></div>`}`;
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || !state.catalog) return;
  const action = button.dataset.action;
  if (editor?.handleAction(button)) return;
  if (action === 'select') {
    const id = button.dataset.id;
    if (state.selected.includes(id)) state.selected = state.selected.filter(x => x !== id);
    else { if (state.selected.length >= 4) return toast('最多比较 4 个配置，请先移除一个'); state.selected.push(id); }
    saveSelection(); const { path } = parseRoute(); if (path === '/') { updateResults(); renderTray(); } else if (path === '/compare') { location.hash = `/compare?ids=${state.selected.join(',')}`; render(); } else render();
  } else if (action === 'compare') location.hash = `/compare?ids=${state.selected.join(',')}`;
  else if (action === 'remove-compare') { state.selected = state.selected.filter(id => id !== button.dataset.id); saveSelection(); location.hash = `/compare?ids=${state.selected.join(',')}`; render(); }
  else if (action === 'clear-selection') { state.selected = []; saveSelection(); if (parseRoute().path === '/compare') location.hash = '/compare?ids='; render(); }
  else if (action === 'body') { state.filters.body = button.dataset.value; renderCatalog(); }
  else if (action === 'reset-filters') { state.filters = { q: '', body: '', brand: '', sdk: false, priced: false, minHeight: '', maxPrice: '', currency: 'USD', sort: 'default' }; renderCatalog(); }
  else if (action === 'view-cards' || action === 'view-table') { state.view = action === 'view-cards' ? 'cards' : 'table'; renderCatalog(); }
  else if (action === 'share') {
    const url = `${location.origin}${location.pathname}#/compare?ids=${state.selected.join(',')}`;
    try { await navigator.clipboard.writeText(url); toast('对比链接已复制'); } catch { toast('当前环境不支持自动复制，请复制浏览器地址栏链接'); location.hash = `/compare?ids=${state.selected.join(',')}`; }
  }
});
document.addEventListener('input', event => {
  if (editor?.handleInput(event.target)) return;
  if (event.target.id === 'search') { state.filters.q = event.target.value; updateResults(); }
});
document.addEventListener('change', async event => {
  const input = event.target;
  if (editor?.handleInput(input)) return;
  if (input.dataset.filter) { state.filters[input.dataset.filter] = input.type === 'checkbox' ? input.checked : input.value; updateResults(); }
  if (input.id === 'differences') { state.differences = input.checked; renderCompare(); }
  await editor?.importFile(input);
});
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && !$('#editor')?.open && $('#search')) { event.preventDefault(); $('#search').focus(); } });
window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0, behavior: 'instant' }); });
function syncSelection() {
  if (!state.catalog) return;
  try { state.selected = loadSelection(localStorage, state.catalog.robots.filter(r => !r.archived).map(r => r.id)); } catch { return; }
  if (parseRoute().path === '/compare') location.hash = `/compare?ids=${state.selected.join(',')}`;
  render();
}
window.addEventListener('storage', event => { if (event.key === SELECT_KEY || event.key === null) syncSelection(); });
window.addEventListener('pageshow', event => { if (event.persisted) syncSelection(); });
async function initialize() {
  const response = await fetch('catalog.e1b56426ce3f5f32.json', { cache: 'no-store' }); if (!response.ok) throw new Error('未能读取 catalog.json');
  const base = await response.json(); const errors = validateCatalog(base); if (errors.length) throw new Error(errors.join('；'));
  state.catalog = base; state.etag = response.headers.get('etag');
  if (EDITABLE) {
    const { createEditor } = await import('./editor.js');
    editor = createEditor({ state, $, render, toast, robotFor, options, saveSelection });
  }
  try { state.selected = loadSelection(localStorage, state.catalog.robots.filter(r => !r.archived).map(r => r.id)); } catch { state.selected = []; }
  render();
}
export const ready = initialize().catch(error => { $('#main').innerHTML = `<div class="empty-state"><h1>资料暂时无法加载</h1><p>${e(error.message)}</p><button class="button" onclick="location.reload()">重新加载</button></div>`; });
