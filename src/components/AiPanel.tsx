import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { AI_WIDTH_MAX, AI_WIDTH_MIN, MIN_WORKSPACE_WIDTH, clampAiWidth } from '@/lib/aiPanel';
import { useStore, useT } from '@/store';

const sites = [
  { id: 'chatgpt', name: 'ChatGPT', icon: '/ai-icons/chatgpt.svg', url: 'https://chatgpt.com/', zh: '对话与创作', en: 'Ideas & writing' },
  { id: 'deepseek', name: 'DeepSeek', icon: '/ai-icons/deepseek.svg', url: 'https://chat.deepseek.com/', zh: '深度思考', en: 'Deep reasoning' },
  { id: 'chatglm', name: '智谱清言', icon: '/ai-icons/chatglm.png', url: 'https://chatglm.cn/', zh: '灵感与探索', en: 'Explore & create' },
  { id: 'yuanbao', name: '元宝', icon: '/ai-icons/yuanbao.png', url: 'https://yuanbao.tencent.com/', zh: '搜索与问答', en: 'Search & answers' },
  { id: 'kimi', name: 'Kimi', icon: '/ai-icons/kimi.png', url: 'https://www.kimi.com/', zh: '阅读与研究', en: 'Read & research' },
  { id: 'doubao', name: '豆包', icon: '/ai-icons/doubao.png', url: 'https://www.doubao.com/', zh: '日常灵感', en: 'Everyday ideas' },
  { id: 'grok', name: 'Grok', icon: '/ai-icons/grok.png', url: 'https://grok.com/', zh: '实时探索', en: 'Explore the now' },
  { id: 'gemini', name: 'Gemini', icon: '/ai-icons/gemini.png', url: 'https://gemini.google.com/', zh: '多元创想', en: 'Imagine more' },
] as const;

export function AiPanel() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const width = useStore((s) => s.aiWidth);
  const setWidth = useStore((s) => s.setAiWidth);
  const dragging = useRef(false);
  const frame = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  const availableMax = () => {
    const mainWidth = document.querySelector('.main')?.getBoundingClientRect().width ?? window.innerWidth;
    const noteWidth = document.querySelector('.note-pane')?.getBoundingClientRect().width ?? 0;
    return Math.max(AI_WIDTH_MIN, Math.min(AI_WIDTH_MAX, mainWidth - noteWidth - MIN_WORKSPACE_WIDTH - 13));
  };

  const onSplitDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging.current = true;
    setActive(true);
    document.body.classList.add('resizing');
  }, []);

  useEffect(() => {
    const move = (event: globalThis.MouseEvent) => {
      if (!dragging.current) return;
      const left = document.querySelector('.main')?.getBoundingClientRect().left ?? 0;
      pending.current = clampAiWidth(Math.min(event.clientX - left, availableMax()));
      if (frame.current === null) frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        if (pending.current !== null) setWidth(pending.current, false);
      });
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
      setWidth(pending.current ?? useStore.getState().aiWidth, true);
      pending.current = null;
      setActive(false);
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
      if (dragging.current) document.body.classList.remove('resizing');
    };
  }, [setWidth]);

  const onSplitKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 12;
    let next: number;
    if (event.key === 'ArrowLeft') next = width - step;
    else if (event.key === 'ArrowRight') next = width + step;
    else if (event.key === 'Home') next = AI_WIDTH_MIN;
    else if (event.key === 'End') next = AI_WIDTH_MAX;
    else return;
    event.preventDefault();
    setWidth(Math.min(next, availableMax()));
  };

  return (
    <aside className="ai-pane" style={{ '--ai-width': `${width}px` } as CSSProperties} aria-label={t('ai.title')}>
      <div className="panel ai-inner">
        <div className="ai-head">
          <div className="ai-head__eyebrow"><span className="ai-head__spark">✳</span> AI ATLAS <span className="ai-head__count">/ 08</span></div>
          <h2>{t('ai.title')}</h2>
          <p>{t('ai.subtitle')}</p>
        </div>

        <div className="ai-list scroll">
          {sites.map((site, index) => (
            <a
              className="ai-link"
              data-site={site.id}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${site.name} · ${t('ai.open')}`}
              key={site.id}
              style={{ '--ai-index': index } as CSSProperties}
            >
              <span className="ai-link__mark" aria-hidden="true"><img src={site.icon} alt="" width="29" height="29" draggable={false} /></span>
              <span className="ai-link__copy">
                <strong>{site.name}</strong>
                <small>{lang === 'zh' ? site.zh : site.en}</small>
              </span>
              <span className="ai-link__arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>

        <div className="ai-foot"><span className="ai-foot__line" />{t('ai.footer')}<span className="ai-foot__line" /></div>
      </div>
      <div
        className={`splitter${active ? ' on' : ''}`}
        role="separator"
        tabIndex={0}
        aria-label={t('split.title')}
        aria-orientation="vertical"
        aria-valuemin={AI_WIDTH_MIN}
        aria-valuemax={AI_WIDTH_MAX}
        aria-valuenow={width}
        title={t('split.title')}
        onMouseDown={onSplitDown}
        onKeyDown={onSplitKey}
      />
    </aside>
  );
}
