// Included only in the GitHub Pages bundle, never in the local/Sites entry point.
export const CONSENT_KEY = 'robots-compare.analytics-consent.v1';
export const BAIDU_SITE_ID = '4d6aec1c3574f8b89625f82f9225d478';
const ORIGIN = 'https://highlightz.github.io';
const BASE = '/robots-compare/';

export function analyticsPath(location, productIds = [], guideIds = []) {
  if (location.origin !== ORIGIN) return null;
  if (location.pathname === BASE + 'privacy.html') return BASE + 'privacy.html';
  for (const index of ['robots', 'guides']) {
    if ([BASE + index + '/', BASE + index + '/index.html'].includes(location.pathname)) return BASE + index + '/';
  }
  for (const [folder, ids] of [['robots', productIds], ['guides', guideIds]]) {
    const match = location.pathname.match(new RegExp('^' + BASE + folder + '/([a-z][a-z0-9-]*)/(?:index\\.html)?$'));
    if (match && ids.includes(match[1])) return BASE + folder + '/' + match[1];
  }
  if (![BASE, BASE + 'index.html'].includes(location.pathname)) return null;
  const route = (location.hash || '#/').slice(1).split('?')[0];
  if (['/', '/compare', '/sources'].includes(route)) return BASE + route.slice(1);
  if (route.startsWith('/robots/') && productIds.includes(route.slice(8))) return BASE + route.slice(1);
  return null; // Unknown/custom URLs and workspace routes are never manually reported.
}

export function createAnalytics({ window: win, document: doc, productIds = [], guideIds = [], storage }) {
  if (win.location.origin !== ORIGIN || (![BASE, BASE + 'index.html'].includes(win.location.pathname) && !analyticsPath(win.location, productIds, guideIds))) return null;
  if (win.__robotsCompareAnalytics) return win.__robotsCompareAnalytics;
  const read = () => { try { return storage?.getItem(CONSENT_KEY); } catch { return null; } };
  const write = value => { try { storage?.setItem(CONSENT_KEY, value); } catch { /* Session-only choice if storage is unavailable. */ } };
  const blocked = () => win.navigator?.globalPrivacyControl === true || win.navigator?.doNotTrack === '1' || win.doNotTrack === '1';
  let choice = read();
  let loaded = false;
  let lastPath = null;
  let script = null;
  const report = () => {
    if (choice !== 'accepted' || blocked()) return;
    const path = analyticsPath(win.location, productIds, guideIds);
    if (!path) { lastPath = null; return; }
    if (path === lastPath) return;
    lastPath = path;
    try { win._hmt.push(['_trackPageview', path]); } catch { /* Analytics must not break browsing. */ }
  };
  const start = () => {
    if (choice !== 'accepted' || blocked()) return;
    if (!loaded) {
      win._hmt = win._hmt || [];
      // Disable automatic first PV and all-click collection before loading Baidu.
      win._hmt.push(['_setAutoPageview', false]);
      win._hmt.push(['_setAutoEventTracking', false]);
      script = doc.createElement('script');
      script.async = true;
      script.src = 'https://hm.baidu.com/hm.js?' + BAIDU_SITE_ID;
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      script.id = 'baidu-tongji-script';
      script.onerror = () => { /* Blocked/offline tracking does not block the app. */ };
      loaded = true;
      report(); // Queue exactly one initial view before the async library executes.
      doc.head.appendChild(script);
    } else report();
  };
  const panel = doc.createElement('section');
  panel.id = 'analytics-consent';
  panel.className = 'analytics-consent';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', '访问统计选择');
  panel.innerHTML = '<div><h2>帮助我们了解网站使用情况</h2><p>同意后启用百度统计，分析访问量、页面和来源。百度可能处理 IP、设备信息及 Cookie。拒绝不会影响浏览。</p><a href="' + BASE + 'privacy.html">阅读隐私说明</a><span class="analytics-choice-status" aria-live="polite"></span></div><div class="analytics-consent-actions"><button type="button" data-consent="declined">拒绝统计</button><button type="button" data-consent="accepted">同意统计</button></div>';
  doc.body.appendChild(panel);
  const show = () => {
    panel.hidden = false;
    const status = panel.querySelector('.analytics-choice-status');
    status.textContent = blocked() ? '浏览器已要求不跟踪，本网站不会启用统计。' : choice === 'accepted' ? '当前：已同意，可选择拒绝以撤回。' : choice === 'declined' ? '当前：已拒绝，可重新选择。' : '';
    panel.querySelector('[data-consent="accepted"]').disabled = blocked();
  };
  const choose = value => {
    if (!['accepted', 'declined'].includes(value) || (value === 'accepted' && blocked())) return;
    choice = value;
    write(value);
    panel.hidden = true;
    if (value === 'accepted') start();
    else if (loaded) {
      // Removing a script alone cannot unload its listeners. Disable, then reload.
      try { win._hmt.push(['_setAutoTracking', false]); } catch { /* Reload is the final stop. */ }
      script?.remove();
      win.location.reload();
    }
  };
  panel.addEventListener('click', event => {
    const button = event.target.closest('[data-consent]');
    if (button && panel.contains(button)) choose(button.dataset.consent);
  });
  doc.addEventListener('click', event => {
    if (event.target.closest('[data-analytics-action="settings"]')) show();
  });
  win.addEventListener('hashchange', report);
  win.addEventListener('storage', event => {
    if (event.key === CONSENT_KEY || event.key === null) {
      const next = read();
      if (loaded && next !== 'accepted') { choice = 'declined'; win.location.reload(); }
      else { choice = next; if (next === 'accepted') { panel.hidden = true; start(); } else show(); }
    }
  });
  const controller = { choose, show, report };
  win.__robotsCompareAnalytics = controller;
  panel.hidden = choice === 'accepted' || choice === 'declined';
  if (!panel.hidden) show();
  start();
  return controller;
}

async function boot() {
  const config = document.querySelector('script[data-analytics="baidu"]');
  if (!config) return;
  // App renders first, so analytics never prevents catalog loading or delays its UI.
  if (config.dataset.staticPage !== 'true' && !location.pathname.endsWith('/privacy.html')) {
    const { ready } = await import('./app.badb4b3df017cc9d.js');
    await ready;
  }
  let storage;
  try { storage = window.localStorage; } catch { /* Ask again on the next visit. */ }
  createAnalytics({ window, document, storage, productIds: (config.dataset.productIds || '').split(',').filter(Boolean), guideIds: (config.dataset.guideIds || '').split(',').filter(Boolean) });
}
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  boot().catch(() => { /* Do not fail the product UI if an optional integration fails. */ });
}
