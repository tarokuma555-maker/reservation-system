import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { visitEligibility } from "@/lib/availability";
import { createRecurringRule } from "@/app/actions";
import { DeliveryBadge } from "@/components/ui";
import { formatYen, todayStr, WEEKDAY_LABELS } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function NewRecurringPage() {
  const [customer, settings, menus] = await Promise.all([
    getCurrentCustomer(),
    getSettings(),
    prisma.menu.findMany({ where: { isPublished: true, isRecurringOnly: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!customer) return null;

  const visitState = visitEligibility(settings, "visit", customer.address);
  const canVisit = visitState === "ok";
  const selectable = menus.filter((m) => m.deliveryType === "online" || canVisit);

  return (
    <div className="space-y-5 p-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-ink">定期利用のお申込み</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          曜日と時間を決めておくと、毎回ご予約いただかなくても自動でお伺いします。
          お休みしたい回だけスキップすることもできます。
        </p>
      </div>

      <form action={createRecurringRule} className="space-y-4">
        <input type="hidden" name="customerId" value={customer.id} />

        <section>
          <h2 className="mb-2 text-sm font-bold text-ink">プランを選ぶ</h2>
          <div className="space-y-2">
            {selectable.map((m, i) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-surface p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
              >
                <input
                  type="radio"
                  name="menuId"
                  value={m.id}
                  defaultChecked={i === 0}
                  className="mt-1 h-4 w-4 accent-[#47705f]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink">{m.name}</span>
                    <DeliveryBadge type={m.deliveryType} />
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">{m.description}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    約{m.durationMinutes}分 ／ {formatYen(m.price)}（税込）／回
                  </span>
                </span>
              </label>
            ))}
          </div>
          {visitState === "no_address" ? (
            <p className="mt-2 text-2xs leading-relaxed text-warn-700">
              ※ ご自宅へうかがうプランをお選びいただくには、ご住所のご登録が必要です。
              <Link href="/liff/profile" className="ml-1 font-bold underline">
                ご住所を登録する
              </Link>
            </p>
          ) : visitState === "out_of_area" ? (
            <p className="mt-2 text-2xs text-ocean-600">
              ※ ご登録の住所は訪問エリア外のため、オンラインのプランのみ選択できます
            </p>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-ink">ペースと曜日</h2>

          <Field label="頻度">
            <select name="frequency" defaultValue="weekly" className={inputCls}>
              <option value="weekly">毎週</option>
              <option value="biweekly">隔週</option>
              <option value="every4weeks">4週ごと</option>
              <option value="monthly_nth">毎月・第N曜日</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="曜日">
              <select name="dayOfWeek" defaultValue="2" className={inputCls}>
                {WEEKDAY_LABELS.map((w, i) => (
                  <option key={i} value={i}>
                    {w}曜日
                  </option>
                ))}
              </select>
            </Field>
            <Field label="第N週（毎月の場合）">
              <select name="nthWeek" defaultValue="2" className={inputCls}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    第{n}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="開始時刻">
              <input name="startTime" type="time" defaultValue="10:00" step={1800} className={inputCls} />
            </Field>
            <Field label="開始日">
              <input name="startDate" type="date" defaultValue={todayStr()} className={inputCls} />
            </Field>
          </div>
        </section>

        <div className="rounded-xl bg-brand-50/60 p-3.5 text-2xs leading-relaxed text-slate-600">
          お申込み後、今後90日分のご予定を自動で確保します。
          既にほかのご予約が入っている回は確保できないため、その場合は個別にご相談させてください。
        </div>

        <button
          type="submit"
          className="w-full rounded-pill bg-brand-600 py-3.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700"
        >
          この内容で申し込む
        </button>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      {children}
    </label>
  );
}
