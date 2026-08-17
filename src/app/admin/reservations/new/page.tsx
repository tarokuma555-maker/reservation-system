import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";
import OwnerBookingForm from "@/components/OwnerBookingForm";
import { todayStr } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * お店の側から予約を入れる画面。
 *
 * 電話・紹介で受けたご予約の受け口。これが無いと、LINE以外から来た
 * ご依頼をシステムに残せず、予定表にもカレンダーにも現れない。
 */
export default async function NewReservationPage() {
  const [customers, menus, options] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.menu.findMany({
      where: { isPublished: true, isRecurringOnly: false },
      orderBy: [{ deliveryType: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.menuOption.findMany({ where: { isPublished: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/calendar"
          className="inline-flex items-center gap-1 text-2xs font-bold text-slate-400 transition hover:text-brand-600"
        >
          <Icon name="arrowLeft" className="h-3 w-3" />
          予定表へ戻る
        </Link>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tighter text-ink">
          ご予約を入れる
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          お電話や紹介で受けたご予約を、こちらから入れます。
          入れると予定表に並び、Googleカレンダーにも書き出されます。
        </p>
      </header>

      <section>
        <SectionTitle hint="お客様の画面と違い、営業時間の外や締切を過ぎた時間でも入れられます">
          ご予約の内容
        </SectionTitle>
        <Card>
          <OwnerBookingForm
            today={todayStr()}
            customers={customers.map((c) => ({
              id: c.id,
              name: c.name,
              companyName: c.companyName,
              hasAddress: Boolean(c.address?.trim()),
            }))}
            menus={menus.map((m) => ({
              id: m.id,
              name: m.name,
              deliveryType: m.deliveryType,
              durationMinutes: m.durationMinutes,
              price: m.price,
            }))}
            options={options.map((o) => ({
              id: o.id,
              name: o.name,
              additionalMinutes: o.additionalMinutes,
              additionalPrice: o.additionalPrice,
            }))}
          />
        </Card>
      </section>

      <div className="flex gap-3 rounded-card border border-brand-200 bg-brand-50/60 px-4 py-3.5">
        <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div className="text-xs leading-relaxed text-slate-700">
          <p className="font-bold">お客様がまだ登録されていない場合</p>
          <p className="mt-1">
            先に{" "}
            <Link href="/admin/customers" className="font-bold text-brand-700 underline">
              お客様
            </Link>{" "}
            の画面で登録してください。お名前だけでも登録できます。
            うかがうメニューをご予約いただく場合は、ご住所とお電話番号もお願いします。
          </p>
        </div>
      </div>
    </div>
  );
}
