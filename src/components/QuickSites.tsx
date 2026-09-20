import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore, useT } from '@/store';
import { colorFor, firstChar } from '@/lib/colors';
import { hostOf, normalizeUrl } from '@/lib/url';
import { IconPencil, IconTrash } from './icons';
import { RowMenu } from './RowMenu';
import { useQuickTarget } from '@/dnd/dnd';

interface FormState {
  open: boolean;
  editingId: string | null;
  name: string;
  url: string;
}

const CLOSED: FormState = { open: false, editingId: null, name: '', url: '' };

export function QuickSites() {
  const t = useT();
  const sites = useStore((s) => s.quickSites);
  const addQuick = useStore((s) => s.addQuick);
  const updateQuick = useStore((s) => s.updateQuick);
  const removeQuick = useStore((s) => s.removeQuick);
  const openTab = useStore((s) => s.openTab);
  const toast = useStore((s) => s.toast);
  const dropQuick = useStore((s) => s.drag.dropQuick);
  const [form, setForm] = useState<FormState>(CLOSED);
  const paneRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // 标签 / 书签卡片拖到这里 = 加入快捷访问（不设数量上限，随便加）
  useQuickTarget({ elementRef: paneRef });

  useEffect(() => {
    if (form.open) nameRef.current?.focus();
  }, [form.open]);

  const openAdd = () => {
    setForm({ open: true, editingId: null, name: '', url: '' });
  };

  const openEdit = (id: string, name: string, url: string) => {
    setForm({ open: true, editingId: id, name, url: hostOf(url) });
  };

  const submit = () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast(t('quick.needBoth'), { tone: 'warn' });
      return;
    }
    const url = normalizeUrl(form.url);
    if (!url) {
      toast(t('quick.badUrl'), { tone: 'warn' });
      return;
    }
    if (form.editingId) updateQuick(form.editingId, form.name, url);
    else addQuick(form.name, url);
    setForm(CLOSED);
  };

  return (
    <div
      ref={paneRef}
      className={`pane-quick${dropQuick ? ' is-drop' : ''}`}
      data-quick-pane="1"
    >
      <div className="quick-grid">
        {sites.map((s) => {
          const c = colorFor(s.name);
          return (
            <div
              key={s.id}
              className="quick-tile"
              title={`${s.name} · ${hostOf(s.url)}`}
              onClick={() => void openTab(s.url)}
            >
              <span
                className="quick-tile__ic"
                style={{ ['--c' as string]: c }}
              >
                {firstChar(s.name)}
              </span>
              <span className="quick-tile__nm">{s.name}</span>
              <RowMenu
                marker={s.id}
                title={t('tree.rowMore', { t: s.name })}
                items={[
                  {
                    key: 'edit',
                    label: t('common.edit'),
                    icon: <IconPencil size={13} />,
                    onPick: () => openEdit(s.id, s.name, s.url),
                  },
                  {
                    key: 'remove',
                    label: t('common.delete'),
                    icon: <IconTrash size={13} />,
                    danger: true,
                    onPick: () => {
                      removeQuick(s.id);
                      toast(t('quick.deleted', { t: s.name }));
                    },
                  },
                ]}
              />
            </div>
          );
        })}

        <div
          className="quick-tile quick-tile--add"
          title={t('quick.addTitle')}
          onClick={openAdd}
        >
          <span className="quick-tile__ic">+</span>
          <span className="quick-tile__nm">{t('quick.add')}</span>
        </div>
      </div>

      {dropQuick ? <div className="drop-hint">{t('quick.dropHint')}</div> : null}

      <AnimatePresence initial={false}>
        {form.open ? (
          <motion.form
            className="quick-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.22, 0.8, 0.28, 1] }}
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              ref={nameRef}
              className="fld"
              placeholder={t('quick.namePh')}
              maxLength={24}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setForm(CLOSED);
              }}
            />
            <input
              className="fld"
              placeholder={t('quick.urlPh')}
              spellCheck={false}
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setForm(CLOSED);
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn--dark btn--sm" type="submit">
                {form.editingId ? t('quick.save') : t('quick.addBtn')}
              </button>
              <button className="btn btn--sm" type="button" onClick={() => setForm(CLOSED)}>
                {t('common.cancel')}
              </button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
