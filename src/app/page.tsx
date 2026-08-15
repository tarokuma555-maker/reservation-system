import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo-mode";
import DemoLanding from "@/components/DemoLanding";

export const dynamic = "force-dynamic";

/**
 * 入口。
 *
 * 本番では、お客様はLINEのメニューから /liff に直接入ってこられるので、
 * ここを開くのはお店の方だけ。管理画面へそのまま送る。
 *
 * デモの置き場所（DEMO_MODE=1）では、お客様側とお店側のどちらも
 * 見比べられる紹介の画面を出す。
 */
export default function Home() {
  if (isDemoMode()) return <DemoLanding />;
  redirect("/admin");
}
