import { redirect } from "next/navigation";

/**
 * 入口。
 *
 * お客様はLINEのメニューから /liff に直接入ってこられるので、
 * ここを開くのはお店の方だけ。管理画面へそのまま送る。
 * （ログインしていなければ、その先でログイン画面になる）
 */
export default function Home() {
  redirect("/admin");
}
