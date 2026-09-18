let seq = 0;

/** 本地 UI 实体 id（快捷站点等非 chrome 实体） */
export function uid(prefix = 'q'): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
