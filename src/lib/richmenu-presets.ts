import type { RichMenuArea } from "./line";

/**
 * LINEの下に出るメニューの中身。
 *
 * ここを唯一の正とし、公開するときも画面に見せるときもここを読む。
 * DBにも同じものを持っていたが、あとから中身を直しても、すでに保存された
 * 古い内容が使われ続けてしまう（行き先の無いボタンが残っていた）。
 *
 * 背景画像に文字を焼きこんでいるため、**ラベルを変えたら画像も作り直すこと**。
 *   npm run build:richmenu
 */

export type RichMenuTarget = "default" | "booked";

export type RichMenuPreset = {
  target: RichMenuTarget;
  name: string;
  chatBarText: string;
  /** 3列×2行。並び順がそのまま押せる場所になる */
  areas: RichMenuArea[];
};

/**
 * 6つとも、実際に開ける別々の画面にしている。
 * 行き先の無いボタンを混ぜると、押しても最初の画面に戻るだけで、
 * 壊れているように見える。
 */
export const RICH_MENU_PRESETS: RichMenuPreset[] = [
  {
    target: "default",
    name: "はじめての方向け",
    chatBarText: "メニュー",
    areas: [
      { label: "予約する", icon: "calendar", path: "/menus" },
      { label: "予約の確認", icon: "calendarCheck", path: "/reservations" },
      { label: "定期のご利用", icon: "repeat", path: "/recurring" },
      { label: "ご登録内容", icon: "user", path: "/profile" },
      { label: "領収書", icon: "receipt", path: "/invoices" },
      { label: "お問い合わせ", icon: "chat", path: "/talk" },
    ],
  },
  {
    target: "booked",
    name: "ご予約がある方向け",
    chatBarText: "予約メニュー",
    areas: [
      { label: "次回の予約", icon: "calendarCheck", path: "/reservations" },
      { label: "新しく予約", icon: "calendar", path: "/menus" },
      { label: "定期のご利用", icon: "repeat", path: "/recurring" },
      { label: "ご登録内容", icon: "user", path: "/profile" },
      { label: "領収書", icon: "receipt", path: "/invoices" },
      { label: "お問い合わせ", icon: "chat", path: "/talk" },
    ],
  },
];

export function presetFor(target: string): RichMenuPreset {
  return (
    RICH_MENU_PRESETS.find((p) => p.target === target) ??
    RICH_MENU_PRESETS[0]
  );
}
