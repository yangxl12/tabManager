import { useStore, useT } from '@/store';
import { THEME_MODES, type ThemeMode } from '@/lib/theme';
import { IconMoon, IconSun, IconThemeAuto } from './icons';
import { RowMenu } from './RowMenu';
import type { I18nKey } from '@/lib/i18n';

const MODE_KEY: Record<ThemeMode, I18nKey> = {
  light: 'theme.light',
  dark: 'theme.dark',
  system: 'theme.system',
};

function ModeIcon({ mode, size }: { mode: ThemeMode; size: number }) {
  if (mode === 'light') return <IconSun size={size} />;
  if (mode === 'dark') return <IconMoon size={size} />;
  return <IconThemeAuto size={size} />;
}

/** 右上角主题选择：明亮 / 暗黑 / 跟随系统。弹层逻辑复用 RowMenu（portal + fixed）。 */
export function ThemeMenu() {
  const t = useT();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  return (
    <RowMenu
      title={t('theme.tip', { m: t(MODE_KEY[theme]) })}
      marker="theme"
      btnClass="theme-btn"
      trigger={<ModeIcon mode={theme} size={15} />}
      items={THEME_MODES.map((m) => ({
        key: m,
        label: t(MODE_KEY[m]),
        icon: <ModeIcon mode={m} size={14} />,
        checked: theme === m,
        onPick: () => setTheme(m),
      }))}
    />
  );
}
