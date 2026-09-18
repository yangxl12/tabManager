import { memo, useMemo, useState } from 'react';
import { colorFor, firstChar } from '@/lib/colors';
import { faviconUrl } from '@/services/favicon';

interface Props {
  /** 页面 URL，用于取 favicon */
  url: string;
  /** 字母 tile 的配色种子 */
  seed: string;
  /** 图标尺寸 */
  size?: number;
}

/** 站点图标：_favicon 优先，失败/内部页降级为字母渐变 tile */
export const Tile = memo(function Tile({ url, seed }: Props) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => faviconUrl(url), [url]);
  const c = useMemo(() => colorFor(seed), [seed]);

  return (
    <span className="tile" style={{ ['--c' as string]: c }}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />
      ) : (
        firstChar(seed)
      )}
    </span>
  );
});
