/**
 * 外部输入的类型兜底。
 *
 * chrome.storage 里的值不受我们控制：可能是旧版本写的别的形状、被手动改过、
 * 或者压根没写过。**直接当数组/数字用，会在初始化路径上抛错**，
 * 而初始化一旦中断，监听器不会注册、页面停在半死不活的状态（前端只看到一个
 * 未捕获的 promise rejection）。所以读取侧一律先过这里，形状不对就回落默认值。
 */

/** 不是数组（对象 / 字符串 / null / undefined…）就回落到 fallback */
export function asArray<T>(v: unknown, fallback: T[] = []): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

/** 只接受有限数字，其余回落（NaN / Infinity / '46' / null） */
export function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** 只接受真正的 boolean，其余回落（'true' / 1 / null 都算非法） */
export function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
