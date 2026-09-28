import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore, useT } from '@/store';
import { colorFor } from '@/lib/colors';
import { hostOf, normalizeUrl } from '@/lib/url';
import { IconPencil, IconTrash } from './icons';
import { RowMenu } from './RowMenu';
import { Tile } from './Tile';
import { useCardDrag, useQuickSortTarget, useQuickTarget } from '@/dnd/dnd';
import { DEFAULT_QUICK_GROUP_ID, quickGroupOf } from '@/store/quickSlice';
import type { QuickSite } from '@/lib/types';

interface FormState {
  open: boolean;
  editingId: string | null;
  name: string;
  url: string;
}

const CLOSED: FormState = { open: false, editingId: null, name: '', url: '' };

/**
 * 单个快捷磁贴：既是拖拽源（可拖去排序），也是排序落点。
 * 拖到自己身上不显示插入线，落点判定由 dnd.ts 统一处理。
 */
const QuickTile = memo(function QuickTile({
  site,
  index,
  groupId,
  onEdit,
}: {
  site: QuickSite;
  index: number;
  groupId: string;
  onEdit: (site: QuickSite) => void;
}) {
  const t = useT();
  const openTab = useStore((s) => s.openTab);
  const removeQuick = useStore((s) => s.removeQuick);
  const toast = useStore((s) => s.toast);
  const ref = useRef<HTMLDivElement>(null);

  const indicator = useStore((s) =>
    s.drag.indicator?.kind === 'quick' && s.drag.indicator.targetId === site.id
      ? s.drag.indicator.side
      : null,
  );
  const dragging = useStore(
    (s) => s.drag.active && s.drag.kind === 'quick' && s.drag.ids.includes(site.id),
  );

  const color = colorFor(site.name);

  useCardDrag({
    elementRef: ref,
    getData: () => ({
      kind: 'quick',
      id: site.id,
      parentId: null,
      ids: [site.id],
      color,
      index,
    }),
  });

  useQuickSortTarget({
    elementRef: ref,
    getData: () => ({ id: site.id, index, groupId }),
  });

  const cls = [
    'quick-tile',
    dragging ? 'dragging' : '',
    indicator === 'before' ? 'drop-b' : '',
    indicator === 'after' ? 'drop-a' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.div
      layout
      ref={ref}
      className={cls}
      data-quick-tile={site.id}
      title={`${site.name} · ${hostOf(site.url)}`}
      onClick={() => void openTab(site.url)}
    >
      <Tile url={site.url} seed={site.name} size={42} className="quick-tile__ic" />
      <span className="quick-tile__nm">{site.name}</span>
      <RowMenu
        marker={site.id}
        title={t('tree.rowMore', { t: site.name })}
        items={[
          {
            key: 'edit',
            label: t('common.edit'),
            icon: <IconPencil size={13} />,
            onPick: () => onEdit(site),
          },
          {
            key: 'remove',
            label: t('common.delete'),
            icon: <IconTrash size={13} />,
            danger: true,
            onPick: () => {
              removeQuick(site.id);
              toast(t('quick.deleted', { t: site.name }));
            },
          },
        ]}
      />
    </motion.div>
  );
});

export function QuickSites() {
  const t = useT();
  const allSites = useStore((s) => s.quickSites);
  const groups = useStore((s) => s.quickGroups);
  const activeGroupId = useStore((s) => s.activeQuickGroupId);
  const setActiveGroup = useStore((s) => s.setActiveQuickGroup);
  const addGroup = useStore((s) => s.addQuickGroup);
  const renameGroup = useStore((s) => s.renameQuickGroup);
  const removeGroup = useStore((s) => s.removeQuickGroup);
  const addQuick = useStore((s) => s.addQuick);
  const updateQuick = useStore((s) => s.updateQuick);
  const dropQuick = useStore((s) => s.drag.dropQuick);
  const toast = useStore((s) => s.toast);
  const [form, setForm] = useState<FormState>(CLOSED);
  const [groupForm, setGroupForm] = useState<{ id: string | null; name: string } | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const groupNameRef = useRef<HTMLInputElement>(null);
  const sites = allSites.filter((site) => quickGroupOf(site) === activeGroupId);

  // 标签 / 书签卡片拖到这里 = 加入快捷访问；快捷磁贴拖到空白 = 挪到末尾
  useQuickTarget({ elementRef: paneRef, groupId: activeGroupId });

  useEffect(() => {
    if (form.open) nameRef.current?.focus();
  }, [form.open]);

  useEffect(() => {
    if (groupForm) groupNameRef.current?.focus();
  }, [groupForm?.id]);

  const selectGroup = (id: string) => {
    setForm(CLOSED);
    setGroupForm(null);
    setActiveGroup(id);
  };

  const submitGroup = () => {
    if (!groupForm) return;
    const name = groupForm.name.trim();
    if (!name) {
      toast(t('quick.groupNeedName'), { tone: 'warn' });
      return;
    }
    if (groups.some((g) => g.id !== groupForm.id && g.name.toLowerCase() === name.toLowerCase())) {
      toast(t('quick.groupExists'), { tone: 'warn' });
      return;
    }
    if (groupForm.id) renameGroup(groupForm.id, name);
    else addGroup(name);
    setGroupForm(null);
  };

  const openAdd = () => {
    setForm({ open: true, editingId: null, name: '', url: '' });
  };

  const openEdit = useCallback((site: QuickSite) => {
    setForm({ open: true, editingId: site.id, name: site.name, url: hostOf(site.url) });
  }, []);

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
    else addQuick(form.name, url, activeGroupId);
    setForm(CLOSED);
  };

  return (
    <div
      ref={paneRef}
      className={`pane-quick${dropQuick ? ' is-drop' : ''}`}
      data-quick-pane="1"
    >
      <div className="quick-tabs">
        <div className="quick-tabs__list" role="tablist" aria-label={t('quick.groupsLabel')}>
          <button
            type="button"
            role="tab"
            aria-selected={activeGroupId === DEFAULT_QUICK_GROUP_ID}
            aria-controls="quick-site-grid"
            className={`quick-tab${activeGroupId === DEFAULT_QUICK_GROUP_ID ? ' is-active' : ''}`}
            onClick={() => selectGroup(DEFAULT_QUICK_GROUP_ID)}
          >
            {t('quick.defaultGroup')}
          </button>
          {groups.map((group) => (
            <div className={`quick-tab-wrap${activeGroupId === group.id ? ' is-active' : ''}`} key={group.id}>
              <button
                type="button"
                role="tab"
                aria-selected={activeGroupId === group.id}
                aria-controls="quick-site-grid"
                className={`quick-tab${activeGroupId === group.id ? ' is-active' : ''}`}
                title={group.name}
                onClick={() => selectGroup(group.id)}
              >
                {group.name}
              </button>
              <RowMenu
                marker={`quick-group-${group.id}`}
                title={t('tree.rowMore', { t: group.name })}
                btnClass="quick-tab__more"
                items={[
                  {
                    key: 'rename',
                    label: t('tree.rename'),
                    icon: <IconPencil size={13} />,
                    onPick: () => setGroupForm({ id: group.id, name: group.name }),
                  },
                  {
                    key: 'delete',
                    label: t('common.delete'),
                    icon: <IconTrash size={13} />,
                    danger: true,
                    onPick: () => {
                      const count = allSites.filter((site) => quickGroupOf(site) === group.id).length;
                      if (window.confirm(t('quick.groupDeleteConfirm', { t: group.name, n: count }))) {
                        removeGroup(group.id);
                        setForm(CLOSED);
                      }
                    },
                  },
                ]}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="quick-tabs__add"
          title={t('quick.addGroup')}
          aria-label={t('quick.addGroup')}
          onClick={() => setGroupForm({ id: null, name: '' })}
        >+</button>
      </div>

      {groupForm ? (
        <form
          className="quick-group-form"
          onSubmit={(e) => { e.preventDefault(); submitGroup(); }}
        >
          <input
            ref={groupNameRef}
            className="fld"
            placeholder={t('quick.groupNamePh')}
            maxLength={24}
            value={groupForm.name}
            onChange={(e) => setGroupForm((g) => g ? { ...g, name: e.target.value } : null)}
            onKeyDown={(e) => { if (e.key === 'Escape') setGroupForm(null); }}
          />
          <button className="btn btn--dark btn--sm" type="submit">{t('quick.save')}</button>
          <button className="btn btn--sm" type="button" onClick={() => setGroupForm(null)}>{t('common.cancel')}</button>
        </form>
      ) : null}

      <div className="quick-grid" id="quick-site-grid" role="tabpanel">
        {sites.map((s, i) => (
          <QuickTile key={s.id} site={s} index={i} groupId={activeGroupId} onEdit={openEdit} />
        ))}

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
