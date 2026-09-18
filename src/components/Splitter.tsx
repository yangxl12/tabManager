import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, useT } from '@/store';

export function Splitter() {
  const t = useT();
  const setPanelWidth = useStore((s) => s.setPanelWidth);
  const [on, setOn] = useState(false);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setOn(true);
    document.body.classList.add('resizing');
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const main = document.querySelector('.main');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setPanelWidth(pct);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setOn(false);
      document.body.classList.remove('resizing');
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [setPanelWidth]);

  return <div className={`splitter${on ? ' on' : ''}`} onMouseDown={onMouseDown} title={t('split.title')} />;
}
