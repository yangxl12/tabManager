import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, useT } from '@/store';

export function Splitter() {
  const t = useT();
  const setPanelWidth = useStore((s) => s.setPanelWidth);
  const [on, setOn] = useState(false);
  const dragging = useRef(false);
  const frame = useRef<number | null>(null);
  const pending = useRef<number | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setOn(true);
    document.body.classList.add('resizing');
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const main = document.querySelector('.workspace');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      pending.current = pct;
      if (frame.current === null) frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        if (pending.current !== null) setPanelWidth(pending.current, false);
      });
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
      setPanelWidth(pending.current ?? useStore.getState().panelWidth, true);
      pending.current = null;
      setOn(false);
      document.body.classList.remove('resizing');
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('blur', up);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [setPanelWidth]);

  return <div className={`splitter${on ? ' on' : ''}`} onMouseDown={onMouseDown} title={t('split.title')} />;
}
