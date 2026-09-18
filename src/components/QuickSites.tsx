import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { QUICK_LIMIT, useStore } from '@/store';
import { colorFor, firstChar } from '@/lib/colors';
import { hostOf, normalizeUrl } from '@/lib/url';
import { IconPencil, IconTrash } from './icons';
import { RowMenu } from './RowMenu';

interface FormState {
  open: boolean;
  editingId: string | null;
  name: string;
  url: string;
}

const CLOSED: FormState = { open: false, editingId: null, name: '', url: '' };

export function QuickSites() {
  const sites = useStore((s) => s.quickSites);
  const addQuick = useStore((s) => s.addQuick);
  const updateQuick = useStore((s) => s.updateQuick);
  const removeQuick = useStore((s) => s.removeQuick);
  const openTab = useStore((s) => s.openTab);
  const toast = useStore((s) => s.toast);
  const [form, setForm] = useState<FormState>(CLOSED);
  const nameRef = useRef<HTMLInputElement>(null);

  const full = sites.length >= QUICK_LIMIT;

  useEffect(() => {
    if (form.open) nameRef.current?.focus();
  }, [form.open]);

  const openAdd = () => {
    if (full) {
      toast(`快捷站点最多 ${QUICK_LIMIT} 个，先删掉一些再添加`, { tone: 'warn' });
      return;
    }
    setForm({ open: true, editingId: null, name: '', url: '' });
  };

  const openEdit = (id: string, name: string, url: string) => {
    setForm({ open: true, editingId: id, name, url: hostOf(url) });
  };

  const submit = () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast('名称和网址都要填', { tone: 'warn' });
      return;
    }
    const url = normalizeUrl(form.url);
    if (!url) {
      toast('网址格式不对，例如 zhihu.com', { tone: 'warn' });
      return;
    }
    if (form.editingId) updateQuick(form.editingId, form.name, url);
    else addQuick(form.name, url);
    setForm(CLOSED);
  };

  return (
    <div className="pane-quick">
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
                title={`${s.name} · 更多操作`}
                items={[
                  {
                    key: 'edit',
                    label: '编辑',
                    icon: <IconPencil size={13} />,
                    onPick: () => openEdit(s.id, s.name, s.url),
                  },
                  {
                    key: 'remove',
                    label: '删除',
                    icon: <IconTrash size={13} />,
                    danger: true,
                    onPick: () => {
                      removeQuick(s.id);
                      toast(`已删除快捷站点「${s.name}」`);
                    },
                  },
                ]}
              />
            </div>
          );
        })}

        <div
          className="quick-tile quick-tile--add"
          title={full ? `已达上限 ${QUICK_LIMIT} 个` : '新增快捷站点'}
          style={full ? { opacity: 0.45 } : undefined}
          onClick={openAdd}
        >
          <span className="quick-tile__ic">+</span>
          <span className="quick-tile__nm">新增</span>
        </div>
      </div>

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
              placeholder="名称，如：知乎"
              maxLength={24}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setForm(CLOSED);
              }}
            />
            <input
              className="fld"
              placeholder="网址，如：zhihu.com"
              spellCheck={false}
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setForm(CLOSED);
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn--dark btn--sm" type="submit">
                {form.editingId ? '保存' : '添加'}
              </button>
              <button className="btn btn--sm" type="button" onClick={() => setForm(CLOSED)}>
                取消
              </button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
