// Shared browser-local comparison preference. Never reads editorial drafts.
export const SELECT_KEY = 'robots-compare.selection.v1';
export const MAX_SELECTION = 4;

export function normalizeSelection(value, allowedIds) {
  const allowed = new Set(allowedIds);
  return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && allowed.has(id)))].slice(0, MAX_SELECTION) : [];
}

export function loadSelection(storage, allowedIds) {
  try { return normalizeSelection(JSON.parse(storage?.getItem(SELECT_KEY) || '[]'), allowedIds); }
  catch { return []; }
}

export function saveSelection(storage, selected) {
  try {
    if (!storage) return false;
    storage.setItem(SELECT_KEY, JSON.stringify(selected));
    return true;
  } catch { return false; }
}

export function toggleSelection(selected, id, allowedIds) {
  const next = normalizeSelection(selected, allowedIds);
  if (!allowedIds.includes(id)) return { selected: next, limitReached: false };
  if (next.includes(id)) return { selected: next.filter(value => value !== id), limitReached: false };
  if (next.length >= MAX_SELECTION) return { selected: next, limitReached: true };
  return { selected: [...next, id], limitReached: false };
}
