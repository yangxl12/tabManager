import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { colorFor, firstChar } from '@/lib/colors';
import { faviconUrl, isFallbackIcon } from '@/services/favicon';

interface Props {
  /** 页面 URL，用于取 favicon */
  url: string;
  /** 字母兜底时的配色种子（同时也决定字色） */
  seed: string;
  /** 图标边长（px）。不传时用 CSS 默认尺寸，交给调用方的类名接管 */
  size?: number;
  /** 追加类名（如 quick-tile__ic），便于定位与尺寸微调 */
  className?: string;
}

/**
 * 站点图标：真实 favicon 优先，取不到（onError / 内部页 / Chrome 默认灰地球）降级为首字母。
 * 无底色 —— 图标下方不垫色块，字母兜底靠站点色字色区分。
 */
export const Tile = memo(function Tile({ url, seed, size, className }: Props) {
  const [failed, setFailed] = useState(false);
  // 展示尺寸越大，请求越大的源图，避免 42px 位置放 32px 糊图
  const reqSize = (size ?? 30) > 32 ? 64 : 32;
  const src = useMemo(() => faviconUrl(url, reqSize), [url, reqSize]);
  const c = useMemo(() => colorFor(seed), [seed]);

  useEffect(() => setFailed(false), [url]);

  // Chrome 在没有该站图标缓存时给的是默认灰地球（不是 404），这里识破它当失败处理
  const onLoad = useCallback(
    async (e: SyntheticEvent<HTMLImageElement>) => {
      if (await isFallbackIcon(e.currentTarget, reqSize)) setFailed(true);
    },
    [reqSize],
  );

  return (
    <span
      className={className ? `tile ${className}` : 'tile'}
      style={{
        ['--c' as string]: c,
        ...(size ? { ['--tile-size' as string]: `${size}px` } : {}),
      }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          onLoad={onLoad}
        />
      ) : (
        firstChar(seed)
      )}
    </span>
  );
});
