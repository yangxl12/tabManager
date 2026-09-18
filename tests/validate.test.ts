import { describe, expect, it } from 'vitest';
import { asArray, asBool, asNumber } from '@/lib/validate';

describe('asArray', () => {
  it('数组原样返回', () => {
    const arr = ['a', 'b'];
    expect(asArray(arr)).toBe(arr);
    expect(asArray([])).toEqual([]);
  });

  it('非数组一律回落（这就是 i.filter is not a function 的来源）', () => {
    for (const bad of [null, undefined, 5, 'a', { '1': true }, NaN, true]) {
      expect(asArray(bad)).toEqual([]);
    }
  });

  it('可以指定 fallback', () => {
    expect(asArray(null, ['x'])).toEqual(['x']);
    expect(asArray('nope', ['x'])).toEqual(['x']);
  });
});

describe('asNumber', () => {
  it('有限数字通过', () => {
    expect(asNumber(46, 30)).toBe(46);
    expect(asNumber(0, 30)).toBe(0);
    expect(asNumber(-1, 30)).toBe(-1);
  });

  it('NaN / Infinity / 数字字符串 / 其他类型全回落', () => {
    for (const bad of [NaN, Infinity, -Infinity, '46', null, undefined, {}, []]) {
      expect(asNumber(bad, 30)).toBe(30);
    }
  });
});

describe('asBool', () => {
  it('只认真正的 boolean', () => {
    expect(asBool(true, false)).toBe(true);
    expect(asBool(false, true)).toBe(false);
  });

  it('真值字符串 / 数字 1 都算非法（避免把 "false" 当 true）', () => {
    for (const bad of ['true', 'false', 'yes', 1, 0, null, undefined, {}]) {
      expect(asBool(bad, true)).toBe(true); // 落到 fallback，而不是被强转
    }
  });
});
