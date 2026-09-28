import { useStore, useT } from '@/store';
import { THEME_MODES, type ThemeMode } from '@/lib/theme';
import type { Lang, I18nKey } from '@/lib/i18n';
import {
  IconGlobe,
  IconHelp,
  IconMoon,
  IconSearch,
  IconSun,
  IconThemeAuto,
  IconUpload,
} from './icons';
import { RowMenu } from './RowMenu';

const MODE_KEY: Record<ThemeMode, I18nKey> = {
  light: 'theme.light',
  dark: 'theme.dark',
  system: 'theme.system',
};

/** 语言分组（与主题同款单选：每项自带展示名，当前项打勾） */
const LANGS: Lang[] = ['zh', 'en'];
const LANG_KEY: Record<Lang, I18nKey> = { zh: 'lang.zh', en: 'lang.en' };

function ModeIcon({ mode, size }: { mode: ThemeMode; size: number }) {
  if (mode === 'light') return <IconSun size={size} />;
  if (mode === 'dark') return <IconMoon size={size} />;
  return <IconThemeAuto size={size} />;
}

/**
 * 书签面板右上角的工具收纳入口（三个点）：搜索 / 界面语言 / 主题 / 导入 JSON / 帮助。
 * 这些都是低频操作，散在标题行里挤占空间（尤其是便签按钮左侧那一段），收进弹层更清爽。
 * 弹层逻辑复用 RowMenu（portal + fixed + Esc / 外部点击关闭）。
 */
export function ToolsMenu({
  onOpenSearch,
  onOpenImport,
}: {
  onOpenSearch: () => void;
  onOpenImport: () => void;
}) {
  const t = useT();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const toggleHelp = useStore((s) => s.toggleHelp);

  return (
    <RowMenu
      marker="tools"
      btnClass="tools-btn"
      width={186}
      title={t('tools.tip')}
      items={[
        {
          key: 'search',
          label: t('tools.search'),
          icon: <IconSearch size={13} />,
          onPick: onOpenSearch,
        },
        {
          key: 'import',
          label: t('bm.import'),
          icon: <IconUpload size={12} />,
          onPick: onOpenImport,
        },
        ...LANGS.map((l) => ({
          key: `lang.${l}`,
          label: t(LANG_KEY[l]),
          icon: <IconGlobe size={13} />,
          // 分组小标题挂在第一项上，弹层里就是「界面语言 / 中文 / English」
          ...(l === LANGS[0] ? { section: t('tools.lang') } : {}),
          checked: lang === l,
          onPick: () => setLang(l),
        })),
        ...THEME_MODES.map((m) => ({
          key: m,
          label: t(MODE_KEY[m]),
          icon: <ModeIcon mode={m} size={13} />,
          // 分组小标题挂在第一项上，弹层里就是「主题 / 明亮 / 暗黑 / 跟随系统」
          ...(m === THEME_MODES[0] ? { section: t('tools.theme') } : {}),
          checked: theme === m,
          onPick: () => setTheme(m),
        })),
        {
          key: 'help',
          label: t('tools.help'),
          icon: <IconHelp size={13} />,
          onPick: toggleHelp,
        },
      ]}
    />
  );
}
