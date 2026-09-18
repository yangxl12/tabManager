import { useStore } from '@/store';
import { THEME_LABEL, THEME_MODES, type ThemeMode } from '@/lib/theme';
import { IconMoon, IconSun, IconThemeAuto } from './icons';
import { RowMenu } from './RowMenu';

function ModeIcon({ mode, size }: { mode: ThemeMode; size: number }) {
  if (mode === 'light') return <IconSun size={size} />;
  if (mode === 'dark') return <IconMoon size={size} />;
  return <IconThemeAuto size={size} />;
}

/** 右上角主题选择：明亮 / 暗黑 / 跟随系统。弹层逻辑复用 RowMenu（portal + fixed）。 */
export function ThemeMenu() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  return (
    <RowMenu
      title={`主题：${THEME_LABEL[theme]}（点击切换）`}
      marker="theme"
      btnClass="theme-btn"
      trigger={<ModeIcon mode={theme} size={15} />}
      items={THEME_MODES.map((m) => ({
        key: m,
        label: THEME_LABEL[m],
        icon: <ModeIcon mode={m} size={14} />,
        checked: theme === m,
        onPick: () => setTheme(m),
      }))}
    />
  );
}
