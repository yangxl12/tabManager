import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '@/store';

const ROWS: Array<{ label: string; hint?: string; keys: string[] }> = [
  { label: '撤回删除', hint: '书签', keys: ['Ctrl', 'Z'] },
  { label: '多选 / 范围选择', hint: '卡片', keys: ['Ctrl', '点击', 'Shift'] },
  { label: '勾选任意卡片后进入多选模式', hint: '单击即勾选', keys: ['点击'] },
  { label: '批量删除选中书签', hint: 'Delete', keys: ['Del'] },
  { label: '取消全部选择 / 关闭弹窗', keys: ['Esc'] },
  { label: '全局搜索书签', hint: '也点了右上角放大镜', keys: ['Ctrl', 'K'] },
  { label: '拖拽标签到右侧', hint: '加入书签', keys: ['Drag'] },
  { label: '拖拽卡片 / 文件夹', hint: '排序 · 归入文件夹', keys: ['Drag'] },
  { label: '按住 Ctrl 点击标签卡片', hint: '多选后整组排序', keys: ['Ctrl'] },
];

export function HelpPanel() {
  const open = useStore((s) => s.helpOpen);
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="help"
          className="help"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.22, 0.8, 0.28, 1] }}
        >
          <h4>快捷键与操作</h4>
          {ROWS.map((r) => (
            <div className="kbd-row" key={r.label}>
              <span>{r.label}</span>
              {r.hint ? <em>{r.hint}</em> : null}
              {r.keys.map((k, i) => (
                <kbd key={`${k}-${i}`}>{k}</kbd>
              ))}
            </div>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
