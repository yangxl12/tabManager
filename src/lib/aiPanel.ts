export const AI_WIDTH_KEY = 'tabnest.aiWidth';
export const AI_WIDTH_DEFAULT = 222;
export const AI_WIDTH_MIN = 190;
export const AI_WIDTH_MAX = 360;
export const MIN_WORKSPACE_WIDTH = 760;

export function clampAiWidth(value: number): number {
  return Math.round(Math.max(AI_WIDTH_MIN, Math.min(AI_WIDTH_MAX, value)));
}

export function normalizeAiWidth(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clampAiWidth(value) : fallback;
}

export function readMirrorAiWidth(): number {
  try {
    const raw = localStorage.getItem(AI_WIDTH_KEY);
    return raw === null ? AI_WIDTH_DEFAULT : normalizeAiWidth(Number(raw), AI_WIDTH_DEFAULT);
  } catch {
    return AI_WIDTH_DEFAULT;
  }
}

export function writeMirrorAiWidth(value: number): void {
  try {
    localStorage.setItem(AI_WIDTH_KEY, String(value));
  } catch {
    // chrome.storage.local remains the source of truth when localStorage is unavailable.
  }
}
