/**
 * 単色・線画のアイコンセット。
 *
 * 絵文字は環境によって形も色も変わり、画面の中で浮いてしまう。
 * すべて同じ太さ・同じ角の丸みで描いた線画にし、色は文字色を継ぐようにしている
 * （currentColor）。そのため置いた場所の色に自然になじむ。
 */

export type IconName =
  | "home"
  | "calendar"
  | "calendarCheck"
  | "clock"
  | "repeat"
  | "chat"
  | "receipt"
  | "user"
  | "users"
  | "sparkle"
  | "visit"
  | "online"
  | "settings"
  | "book"
  | "folder"
  | "wallet"
  | "bell"
  | "alert"
  | "info"
  | "check"
  | "plus"
  | "arrowRight"
  | "arrowLeft"
  | "download"
  | "send"
  | "search"
  | "trash"
  | "edit"
  | "camera"
  | "link"
  | "refresh"
  | "help"
  | "chart"
  | "list"
  | "phone"
  | "pin"
  | "close"
  | "chevronDown"
  | "chevronRight"
  | "pause"
  | "play"
  | "skip";

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.75 9.4V20h12.5V9.4" />
      <path d="M9.75 20v-5.25h4.5V20" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.75h17M8 3v4M16 3v4" />
    </>
  ),
  calendarCheck: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.75h17M8 3v4M16 3v4" />
      <path d="m8.75 14.75 2.25 2.25 4.25-4.25" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.25V12l3.25 2" />
    </>
  ),
  repeat: (
    <>
      <path d="M4 9.25A4.75 4.75 0 0 1 8.75 4.5H18" />
      <path d="m15.25 1.75 3 2.75-3 2.75" />
      <path d="M20 14.75A4.75 4.75 0 0 1 15.25 19.5H6" />
      <path d="m8.75 22.25-3-2.75 3-2.75" />
    </>
  ),
  chat: (
    <>
      <path d="M4.5 5.5h15v11h-8.25L7 20.25V16.5H4.5z" />
    </>
  ),
  receipt: (
    <>
      <path d="M6.25 2.75h11.5v18.5l-2.3-1.6-2.3 1.6-2.3-1.6-2.3 1.6-2.3-1.6z" />
      <path d="M9.5 8h5M9.5 12h5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20.25c0-3.6 3.25-6 7.25-6s7.25 2.4 7.25 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8.25" r="3.25" />
      <path d="M3.25 20c0-3.2 2.8-5.25 6.25-5.25S15.75 16.8 15.75 20" />
      <path d="M16.5 5.5a3.25 3.25 0 0 1 0 6.25M18 14.9c1.8.6 3 2 3 4.1" />
    </>
  ),
  sparkle: (
    <>
      <path d="M11 3.5 12.6 8l4.4 1.6L12.6 11.2 11 15.6 9.4 11.2 5 9.6 9.4 8z" />
      <path d="M17.75 15.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" />
    </>
  ),
  visit: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.75 9.4V20h12.5V9.4" />
      <path d="M10 20v-4.5h4V20" />
    </>
  ),
  online: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2.5" />
      <path d="M8.5 20.5h7" />
      <path d="M12 17v3.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.55 5.45 16.8 7.2M7.2 16.8l-1.75 1.75M18.55 18.55 16.8 16.8M7.2 7.2 5.45 5.45" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 4.75A1.75 1.75 0 0 1 6.25 3H19v18H6.25a1.75 1.75 0 0 1-1.75-1.75z" />
      <path d="M4.5 16.75h14.5" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 6.75A1.75 1.75 0 0 1 5.25 5h4l2 2.5h7.5a1.75 1.75 0 0 1 1.75 1.75v8.5A1.75 1.75 0 0 1 18.75 19.5H5.25A1.75 1.75 0 0 1 3.5 17.75z" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.25" y="6" width="17.5" height="13" rx="2.5" />
      <path d="M3.25 10h17.5" />
      <circle cx="16.5" cy="14.5" r="1.15" />
    </>
  ),
  bell: (
    <>
      <path d="M6.75 10a5.25 5.25 0 0 1 10.5 0c0 4 1.75 5.25 1.75 5.25H5s1.75-1.25 1.75-5.25" />
      <path d="M10.25 18.5a2 2 0 0 0 3.5 0" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.25 21 19.5H3z" />
      <path d="M12 10v3.75M12 16.75h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.25M12 7.75h.01" />
    </>
  ),
  check: <path d="M20 6.75 9.5 17.25 4 11.75" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrowRight: (
    <>
      <path d="M4.75 12h14.5" />
      <path d="m13.5 6.25 5.75 5.75-5.75 5.75" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19.25 12H4.75" />
      <path d="m10.5 6.25-5.75 5.75 5.75 5.75" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.75v11" />
      <path d="m7.25 10.5 4.75 4.75 4.75-4.75" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  send: (
    <>
      <path d="M20.5 3.5 10.75 13.25" />
      <path d="M20.5 3.5 14.25 20.5l-3.5-7.25L3.5 9.75z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4.75 6.5h14.5" />
      <path d="M9.25 6.5V4.75h5.5V6.5" />
      <path d="M6.5 6.5 7.5 20h9l1-13.5" />
    </>
  ),
  edit: (
    <>
      <path d="M4.5 19.5h4l10-10a2.12 2.12 0 0 0-3-3l-10 10z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 8.75A1.75 1.75 0 0 1 5.25 7h2.5l1.5-2.25h5.5L16.25 7h2.5a1.75 1.75 0 0 1 1.75 1.75v8.5a1.75 1.75 0 0 1-1.75 1.75H5.25a1.75 1.75 0 0 1-1.75-1.75z" />
      <circle cx="12" cy="13" r="3.25" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5a3.75 3.75 0 0 0 5.3 0l2.7-2.7a3.75 3.75 0 0 0-5.3-5.3l-1.2 1.2" />
      <path d="M13.5 10.5a3.75 3.75 0 0 0-5.3 0l-2.7 2.7a3.75 3.75 0 0 0 5.3 5.3l1.2-1.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.35-5.65" />
      <path d="M20.25 4v4.5h-4.5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.75 9.5a2.25 2.25 0 1 1 3 2.12V13.5" />
      <path d="M12 16.75h.01" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20.25V4" />
      <path d="M4 20.25h16" />
      <path d="M8 17V12M12.5 17V7.5M17 17v-6.5" />
    </>
  ),
  list: (
    <>
      <path d="M8.5 6.75h11M8.5 12h11M8.5 17.25h11" />
      <path d="M4.5 6.75h.01M4.5 12h.01M4.5 17.25h.01" />
    </>
  ),
  phone: (
    <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5z" />
  ),
  pin: (
    <>
      <path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15 12 21 12 21z" />
      <circle cx="12" cy="10.25" r="2.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronDown: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  chevronRight: <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />,
  pause: <path d="M9.25 5.5v13M14.75 5.5v13" />,
  play: <path d="M7.5 4.75 19 12 7.5 19.25z" />,
  skip: (
    <>
      <path d="M6 5.5 15 12l-9 6.5z" />
      <path d="M18.5 5.5v13" />
    </>
  ),
};

export function Icon({
  name,
  className = "h-4 w-4",
  strokeWidth = 1.7,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
