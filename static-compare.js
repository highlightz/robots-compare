import { SELECT_KEY, loadSelection, saveSelection, toggleSelection } from './selection.e1b56426ce3f5f32.js';
import { escapeHTML as e } from './core.e1b56426ce3f5f32.js';

// A small progressive enhancement for public HTML. No app/catalog fetch, no
// analytics, no writable API. No-JS visitors can still read all specifications.
export function createStaticComparison({ window: win, document: doc, storage, products, root }) {
  if (!Array.isArray(products) || !/^(?:\.\.\/){1,2}$/.test(root)) return null;
  const rows = products.filter(row => row && /^[a-z][a-z0-9-]{0,79}$/.test(row.id) && typeof row.title === 'string');
  const ids = rows.map(row => row.id);
  const titles = new Map(rows.map(row => [row.id, row.title]));
  const tray = doc.querySelector('#compare-tray');
  const status = doc.querySelector('#static-comparison-status');
  if (!tray || !status || !rows.length) return null;
  let selected = loadSelection(storage, ids);
  const announce = text => { status.textContent = text; };
  const compareURL = () => `${root}#/compare?ids=${selected.join(',')}`;
  const render = () => {
    for (const button of doc.querySelectorAll('[data-static-compare]')) {
      const id = button.dataset.staticCompare;
      const active = selected.includes(id);
      button.disabled = !titles.has(id);
      button.textContent = active ? '✓ 已加入对比' : '+ 加入对比';
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', `${active ? '移除对比' : '加入对比'} ${titles.get(id) || ''}`);
      button.classList.toggle('selected', active);
    }
    for (const count of doc.querySelectorAll('[data-static-compare-count]')) count.textContent = selected.length;
    for (const link of doc.querySelectorAll('[data-static-compare-link]')) link.setAttribute('href', compareURL());
    doc.body.classList.toggle('has-tray', !!selected.length);
    tray.hidden = !selected.length;
    tray.innerHTML = !selected.length ? '' : `<div class="tray-inner"><div class="tray-label"><span class="tray-number">${selected.length}</span><span>对比清单<small>最多选择 4 个配置</small></span></div><div class="tray-products">${selected.map(id => `<button type="button" class="tray-chip" data-static-remove="${e(id)}" aria-label="移除 ${e(titles.get(id))}"><span>${e(titles.get(id))}</span><b aria-hidden="true">×</b></button>`).join('')}</div><button type="button" class="text-button tray-clear" data-static-clear>清空</button><a class="button static-continue" href="${root}#/">继续挑选</a><a class="button primary" data-static-start ${selected.length < 2 ? 'aria-disabled="true" tabindex="-1"' : `href="${compareURL()}"`}>${selected.length < 2 ? '再选 1 个开始对比' : '开始对比 ↗'}</a></div>`;
  };
  const commit = message => {
    const saved = saveSelection(storage, selected);
    render();
    announce(saved ? message : `${message}。浏览器无法保存清单，跨页可能不保留；可使用本页的开始对比链接。`);
  };
  const click = event => {
    const button = event.target.closest('[data-static-compare], [data-static-remove], [data-static-clear]');
    if (!button) return;
    if ('staticClear' in button.dataset) { selected = []; commit('已清空对比清单'); return; }
    const id = button.dataset.staticCompare || button.dataset.staticRemove;
    if (!ids.includes(id)) return;
    if (button.dataset.staticRemove) selected = selected.filter(value => value !== id);
    else {
      const result = toggleSelection(selected, id, ids);
      if (result.limitReached) { announce('最多比较 4 个配置，请先移除一个'); return; }
      selected = result.selected;
    }
    commit(`${titles.get(id)}${selected.includes(id) ? '已加入对比' : '已从对比清单移除'}`);
  };
  const sync = () => { selected = loadSelection(storage, ids); render(); };
  doc.addEventListener('click', click);
  win.addEventListener('storage', event => { if (event.key === SELECT_KEY || event.key === null) sync(); });
  win.addEventListener('pageshow', event => { if (event.persisted) sync(); });
  render();
  return { getSelected: () => [...selected], render, sync };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const config = document.querySelector('#static-comparison-data');
  if (config) {
    try {
      const { products, root } = JSON.parse(config.textContent);
      let storage;
      try { storage = window.localStorage; } catch { /* Session-only selection. */ }
      createStaticComparison({ window, document, storage, products, root });
    } catch { /* Static specifications and fallback links remain usable. */ }
  }
}
