export const FIELDS = [
  { key: 'height', label: '身高', unit: 'cm', type: 'number', group: '身体规格' },
  { key: 'weight', label: '整机重量', unit: 'kg', type: 'number', group: '身体规格' },
  { key: 'dof', label: '全身自由度', unit: 'DoF', type: 'number', group: '身体规格' },
  { key: 'hand', label: '末端执行器', unit: '', type: 'text', group: '身体规格' },
  { key: 'payload', label: '手臂负载', unit: 'kg', type: 'number', group: '运动与操作' },
  { key: 'speed', label: '移动速度', unit: 'm/s', type: 'number', group: '运动与操作' },
  { key: 'runtime', label: '工作时间', unit: 'h', type: 'number', group: '电池与工作' },
  { key: 'battery_wh', label: '电池能量', unit: 'Wh', type: 'number', group: '电池与工作' },
  { key: 'battery_mah', label: '电池容量', unit: 'mAh', type: 'number', group: '电池与工作' },
  { key: 'sensors', label: '感知配置', unit: '', type: 'text', group: '感知与开发' },
  { key: 'compute', label: '计算平台', unit: '', type: 'text', group: '感知与开发' },
  { key: 'sdk', label: '二次开发', unit: '', type: 'boolean', group: '感知与开发' },
  { key: 'price_usd', label: '美元报价', unit: 'USD', type: 'number', group: '采购信息' },
  { key: 'price_cny', label: '人民币报价', unit: 'CNY', type: 'number', group: '采购信息' }
];
export const VALUE_STATES = { known: '已收录', not_disclosed: '未公开', unknown: '待核实', not_applicable: '不适用' };
export const REVIEW_STATES = { reviewed: '已核对原文', pending_review: '待审核', conflicting: '存在冲突' };
export const EVIDENCE_TYPES = { manufacturer: '厂商资料', third_party: '第三方测试', user_report: '用户反馈', estimate: '编辑估算' };
export const BODY_TYPES = { biped: '双足人形', wheeled: '轮式人形', quadruped: '四足机器人' };
export const PRODUCT_STATES = { announced: '已发布', prototype: '原型', preorder: '预订', pilot: '试点', available: '可采购', discontinued: '已停产', unknown: '状态待核实' };
export const unknownClaim = () => ({ status: 'unknown', value: null, sourceId: null, evidenceType: 'manufacturer', reviewStatus: 'pending_review', condition: '', checkedAt: null });
export const claimFor = (robot, key) => robot.specs[key] || unknownClaim();
export const titleFor = (r) => r.configuration === '标准配置' ? r.name : `${r.name} ${r.configuration}`;
export const makerFor = (catalog, r) => catalog.manufacturers.find(m => m.id === r.manufacturerId);
export const clone = value => JSON.parse(JSON.stringify(value));
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function safeURL(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
export function numericBounds(claim) {
  if (claim.status !== 'known' || claim.reviewStatus !== 'reviewed' || claim.evidenceType === 'estimate') return null;
  if (typeof claim.value === 'number') return { min: claim.value, max: claim.value };
  if (claim.value && typeof claim.value === 'object') return { min: claim.value.min, max: claim.value.max };
  return null;
}
export function formatClaim(claim, field, withUnit = true) {
  if (claim.status !== 'known') return VALUE_STATES[claim.status] || '待核实';
  let value = claim.value;
  if (typeof value === 'boolean') return value ? '支持' : '明确不支持';
  const number = n => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(n);
  if (typeof value === 'number') value = number(value);
  else if (value && typeof value === 'object') value = value.min === null ? `≤ ${number(value.max)}` : value.max === null ? `≥ ${number(value.min)}` : `${number(value.min)}–${number(value.max)}`;
  return `${value}${withUnit && field.unit ? ` ${field.unit}` : ''}`;
}
export function completeness(robot) { return Math.round(FIELDS.filter(f => claimFor(robot, f.key).status === 'known').length / FIELDS.length * 100); }
export function sameKnownClaims(claims) {
  if (!claims.length || claims.some(c => c.status !== 'known' || c.reviewStatus !== 'reviewed')) return false;
  const signature = c => JSON.stringify([c.value, c.condition || '', c.reviewStatus, c.evidenceType]);
  return claims.every(c => signature(c) === signature(claims[0]));
}
export function filterRobots(catalog, filters = {}) {
  const q = (filters.q || '').toLocaleLowerCase().trim();
  const rows = catalog.robots.filter(r => {
    if (r.archived) return false;
    const maker = makerFor(catalog, r);
    if (q && ![r.name, r.configuration, r.description, maker.name, maker.englishName, ...(r.tags || [])].join(' ').toLocaleLowerCase().includes(q)) return false;
    if (filters.body && r.bodyType !== filters.body) return false;
    if (filters.brand && r.manufacturerId !== filters.brand) return false;
    if (filters.sdk && !(claimFor(r, 'sdk').status === 'known' && claimFor(r, 'sdk').value === true && claimFor(r, 'sdk').reviewStatus === 'reviewed' && claimFor(r, 'sdk').evidenceType !== 'estimate')) return false;
    if (filters.priced && !['price_usd', 'price_cny'].some(k => numericBounds(claimFor(r, k)))) return false;
    if (filters.minHeight !== '' && filters.minHeight != null) { const b = numericBounds(claimFor(r, 'height')); if (!b || b.min === null || b.min < Number(filters.minHeight)) return false; }
    if (filters.maxPrice !== '' && filters.maxPrice != null) { const b = numericBounds(claimFor(r, filters.currency === 'CNY' ? 'price_cny' : 'price_usd')); if (!b || b.max === null || b.max > Number(filters.maxPrice)) return false; }
    return true;
  });
  const sort = filters.sort || 'default';
  if (sort === 'name') rows.sort((a, b) => titleFor(a).localeCompare(titleFor(b), 'en'));
  if (sort === 'height' || sort === 'weight') rows.sort((a, b) => (numericBounds(claimFor(a, sort))?.min ?? Infinity) - (numericBounds(claimFor(b, sort))?.min ?? Infinity));
  if (sort === 'complete') rows.sort((a, b) => completeness(b) - completeness(a));
  return rows;
}
const isID = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 5000;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value));
const validNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function validateCatalog(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['资料必须是一个 JSON 对象'];
  if (data.schemaVersion !== 1) errors.push('不支持的数据格式版本');
  if (!Number.isInteger(data.version) || data.version < 1) errors.push('version 必须为正整数');
  if (!validDate(data.updatedAt)) errors.push('updatedAt 不是有效日期');
  for (const key of ['manufacturers', 'sources', 'robots', 'revisions']) if (!Array.isArray(data[key])) errors.push(`${key} 必须是数组`);
  if (errors.length) return errors;
  if (data.robots.length > 2000 || data.sources.length > 5000 || data.revisions.length > 10000) errors.push('数据量超过首版限制');
  const uniqueIDs = (rows, kind) => { const ids = new Set(); rows.forEach(row => { if (!row || !isID(row.id) || ids.has(row.id)) errors.push(`${kind} 的 ID 无效或重复`); else ids.add(row.id); }); return ids; };
  const makers = uniqueIDs(data.manufacturers, '厂家');
  const sources = uniqueIDs(data.sources, '来源');
  uniqueIDs(data.robots, '配置');
  data.manufacturers.forEach(m => { if (!m || !nonempty(m.name) || !nonempty(m.englishName) || !safeURL(m.website)) errors.push('厂家名称或官网无效'); });
  data.sources.forEach(s => { if (!s || !nonempty(s.title) || !nonempty(s.publisher) || !safeURL(s.url) || !validDate(s.accessedAt)) errors.push('来源缺少标题、发布者、安全 URL 或访问日期'); else if (s.publishedAt != null && !validDate(s.publishedAt)) errors.push(`${s.id}: 发布日期无效`); });
  data.robots.forEach(r => {
    if (!r || !nonempty(r.name) || !nonempty(r.configuration) || !makers.has(r.manufacturerId) || !isID(r.productId)) { errors.push('产品身份不完整'); return; }
    if (!Object.hasOwn(BODY_TYPES, r.bodyType) || !Object.hasOwn(PRODUCT_STATES, r.marketStatus)) errors.push(`${r.id}: 形态或交付状态无效`);
    if (!sources.has(r.sourceId)) errors.push(`${r.id}: 产品缺少有效来源`);
    if (r.archived !== undefined && typeof r.archived !== 'boolean') errors.push(`${r.id}: archived 必须为布尔值`);
    if (r.image && !/^assets\/[a-zA-Z0-9/_-]+\.(?:png|jpg|jpeg|webp)$/.test(r.image)) errors.push(`${r.id}: 图片必须使用本地 assets 相对路径`);
    if (typeof r.description !== 'string' || r.description.length > 5000 || !Array.isArray(r.tags) || r.tags.some(t => typeof t !== 'string' || t.length > 100)) errors.push(`${r.id}: 描述或标签无效`);
    if (!r.specs || typeof r.specs !== 'object' || Array.isArray(r.specs)) { errors.push(`${r.id}: 参数对象无效`); return; }
    Object.entries(r.specs).forEach(([key, c]) => {
      const f = FIELDS.find(f => f.key === key);
      if (!f || !c || !Object.hasOwn(VALUE_STATES, c.status) || !Object.hasOwn(EVIDENCE_TYPES, c.evidenceType) || !Object.hasOwn(REVIEW_STATES, c.reviewStatus)) { errors.push(`${r.id}.${key}: 参数类型/状态无效`); return; }
      if (typeof c.condition !== 'string' || c.condition.length > 5000) errors.push(`${r.id}.${key}: 条件无效`);
      if (c.status === 'known') {
        if (!sources.has(c.sourceId) || !validDate(c.checkedAt)) errors.push(`${r.id}.${key}: 已知参数必须有有效来源和核验日期`);
        if (f.type === 'number') {
          const v = c.value;
          const range = v && typeof v === 'object' && !Array.isArray(v) && ['min', 'max'].every(k => v[k] === null || validNumber(v[k])) && (v.min !== null || v.max !== null) && (v.min === null || v.max === null || v.min <= v.max);
          if (!validNumber(v) && !range) errors.push(`${r.id}.${key}: 数字或范围无效`);
        } else if (f.type === 'boolean' && typeof c.value !== 'boolean') errors.push(`${r.id}.${key}: 必须是真/假`);
        else if (f.type === 'text' && !nonempty(c.value)) errors.push(`${r.id}.${key}: 文本为空或过长`);
      } else if (c.value !== null) errors.push(`${r.id}.${key}: 未知/不适用参数的值必须为空`);
      if (c.sourceId !== null && !sources.has(c.sourceId)) errors.push(`${r.id}.${key}: 来源不存在`);
    });
  });
  data.revisions.forEach(r => {
    if (!r || !nonempty(r.id) || !validDate(r.at) || !nonempty(r.author) || !nonempty(r.reason) || !Array.isArray(r.changes)) { errors.push('修订记录格式无效'); return; }
    if (r.changes.some(change => !change || !['robots', 'sources', 'manufacturers'].includes(change.collection) || !isID(change.id) || !Object.hasOwn(change, 'before') || !Object.hasOwn(change, 'after'))) errors.push('修订的前后记录无效');
  });
  return errors;
}
export function createChange(current, incoming, author, reason, at = new Date().toISOString()) {
  const errors = validateCatalog(incoming);
  if (errors.length) throw new Error(errors.slice(0, 8).join('；'));
  if (!nonempty(author) || !nonempty(reason)) throw new Error('请填写修改人和修改原因');
  const next = clone(incoming);
  const changes = [];
  for (const collection of ['robots', 'sources', 'manufacturers']) {
    const before = new Map(current[collection].map(r => [r.id, r]));
    const after = new Map(next[collection].map(r => [r.id, r]));
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      if (JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id))) changes.push({ collection, id, before: before.get(id) || null, after: after.get(id) || null });
    }
  }
  if (!changes.length) return clone(current);
  next.version = current.version + 1;
  next.updatedAt = at;
  next.revisions = [...current.revisions, { id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at, author: author.trim(), reason: reason.trim(), changes }];
  return next;
}
