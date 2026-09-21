interface IconProps {
  size?: number;
  className?: string;
}

const S = (size = 14) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function IconPlus({ size = 12, className }: IconProps) {
  return (
    <svg {...S(size)} className={className}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function IconX({ size = 11, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={2} className={className}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function IconUpload({ size = 12, className }: IconProps) {
  return (
    <svg {...S(size)} className={className}>
      <path d="M8 10.6V3M5.1 5.9 8 3l2.9 2.9M2.8 11.2v1.4a.9.9 0 0 0 .9.9h8.6a.9.9 0 0 0 .9-.9v-1.4" />
    </svg>
  );
}

export function IconPencil({ size = 10, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.6} className={className}>
      <path d="M11.2 2.6l2.2 2.2-8 8-2.8.6.6-2.8z" />
    </svg>
  );
}

export function IconDots({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={0} className={className}>
      <circle cx="3.4" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="12.6" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function IconTrash({ size = 13, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.5} className={className}>
      <path d="M2.9 4.4h10.2M6.3 4.4V3c0-.4.3-.7.7-.7h2c.4 0 .7.3.7.7v1.4" />
      <path d="M4.3 4.4l.6 8.3c0 .6.5 1 1.1 1h4c.6 0 1.1-.4 1.1-1l.6-8.3" />
      <path d="M6.9 7v4.2M9.1 7v4.2" />
    </svg>
  );
}

export function IconChevron({ size = 9, className }: IconProps) {
  return (
    <svg
      {...S(size)}
      strokeWidth={1.9}
      viewBox="0 0 10 10"
      width={size}
      height={size}
      className={className}
    >
      <path d="M3.5 1.8 7 5l-3.5 3.2" />
    </svg>
  );
}

export function IconFolder({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.45} className={className}>
      <path d="M1.8 4.1c0-.7.6-1.3 1.3-1.3h2.2l1.2 1.6h5.4c.7 0 1.3.6 1.3 1.3v5.9c0 .7-.6 1.3-1.3 1.3H3.1c-.7 0-1.3-.6-1.3-1.3z" />
    </svg>
  );
}

export function IconFolderPlus({ size = 13, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.45} className={className}>
      <path d="M1.8 4.1c0-.7.6-1.3 1.3-1.3h2.2l1.2 1.6h5.4c.7 0 1.3.6 1.3 1.3v5.9c0 .7-.6 1.3-1.3 1.3H3.1c-.7 0-1.3-.6-1.3-1.3z" />
      <path d="M8 7.4v3.2M6.4 9h3.2" />
    </svg>
  );
}

export function IconCheck({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={2} className={className}>
      <path d="M3.4 8.4l3 3 6.2-6.6" />
    </svg>
  );
}

export function IconWarn({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.8} className={className}>
      <path d="M8 2.6 14.6 13.4H1.4z" />
      <path d="M8 6.4v3.2" />
      <circle cx="8" cy="11.5" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSearch({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} width={size} height={size} viewBox="0 0 16 16" className={className}>
      <circle cx="7" cy="7" r="4.6" />
      <path d="M10.6 10.6 14 14" />
    </svg>
  );
}

export function IconHelp({ size = 15, className }: IconProps) {
  return (
    <svg {...S(size)} width={size} height={size} viewBox="0 0 16 16" className={className}>
      <path d="M6 6.1a2 2 0 1 1 2.6 1.9c-.5.2-.6.6-.6 1v.4" />
      <circle cx="8" cy="12.4" r=".85" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSun({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.6} className={className}>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.7v1.7M8 12.6v1.7M1.7 8h1.7M12.6 8h1.7M3.55 3.55l1.2 1.2M11.25 11.25l1.2 1.2M12.45 3.55l-1.2 1.2M4.75 11.25l-1.2 1.2" />
    </svg>
  );
}

export function IconMoon({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.6} className={className}>
      <path d="M13.3 9.7A5.7 5.7 0 0 1 6.3 2.7a5.7 5.7 0 1 0 7 7z" />
    </svg>
  );
}

/** 跟随系统：显示器 */
export function IconThemeAuto({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.6} className={className}>
      <rect x="1.9" y="2.9" width="12.2" height="8.4" rx="1.6" />
      <path d="M6.1 13.4h3.8M8 11.3v2.1" />
    </svg>
  );
}

/** 界面语言切换：地球（i18n 通用语义） */
export function IconGlobe({ size = 15, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.5} className={className}>
      <circle cx="8" cy="8" r="6.1" />
      <ellipse cx="8" cy="8" rx="2.7" ry="6.1" />
      <path d="M2.2 8h11.6M2.9 5h10.2M2.9 11h10.2" />
    </svg>
  );
}

/** 便签：右上折角的纸片 + 两条内容线 */
export function IconNote({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.45} className={className}>
      <path d="M4 2.9h5.1l4 4v5.2c0 .6-.5 1.1-1.1 1.1H4c-.6 0-1.1-.5-1.1-1.1V4c0-.6.5-1.1 1.1-1.1z" />
      <path d="M9.1 2.9V6c0 .6.5 1.1 1.1 1.1h2.9" />
      <path d="M5.3 9.1h5.4M5.3 11.4h3.2" />
    </svg>
  );
}

/** 便签工具条：无序列表 */
export function IconListUl({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.5} className={className}>
      <path d="M6.5 4.2h6.7M6.5 8h6.7M6.5 11.8h6.7" />
      <circle cx="3.1" cy="4.2" r=".95" fill="currentColor" stroke="none" />
      <circle cx="3.1" cy="8" r=".95" fill="currentColor" stroke="none" />
      <circle cx="3.1" cy="11.8" r=".95" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 便签工具条：有序列表（序号走 text，跟界面同一字体） */
export function IconListOl({ size = 14, className }: IconProps) {
  return (
    <svg {...S(size)} strokeWidth={1.5} className={className}>
      <path d="M6.5 4.2h6.7M6.5 8h6.7M6.5 11.8h6.7" />
      <text x="2.9" y="6.1" fontSize="5.6" fill="currentColor" stroke="none" textAnchor="middle">1</text>
      <text x="2.9" y="9.9" fontSize="5.6" fill="currentColor" stroke="none" textAnchor="middle">2</text>
      <text x="2.9" y="13.7" fontSize="5.6" fill="currentColor" stroke="none" textAnchor="middle">3</text>
    </svg>
  );
}

export function IconBrand({ size = 24, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="10" height="10" rx="3" fill="#0F8A6B" />
      <rect x="12.5" y="1.5" width="10" height="10" rx="3" fill="#2C6FDB" />
      <rect x="1.5" y="12.5" width="10" height="10" rx="3" fill="#E0473E" />
      <rect x="12.5" y="12.5" width="10" height="10" rx="3" fill="#D9A220" />
    </svg>
  );
}

export function EmptyTabsArt() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 48 48"
      fill="none"
      stroke="#B6AFA4"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <rect x="6" y="10" width="26" height="20" rx="4" />
      <path d="M6 17h26" />
      <path d="M22 30v6h14a4 4 0 0 0 4-4V20a4 4 0 0 0-4-4h-1" />
    </svg>
  );
}

export function EmptyBmsArt() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 48 48"
      fill="none"
      stroke="#B6AFA4"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d="M6 14a3 3 0 0 1 3-3h8l3.5 4.5H39a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" />
      <path d="M24 24v8M20 28h8" />
    </svg>
  );
}
