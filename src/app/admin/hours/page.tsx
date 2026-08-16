import { prisma } from "@/lib/db";
import { Card, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { WeeklyHoursForm, OnlineHoursForm, type DayRow } from "@/components/BusinessHoursForm";
import HolidayForm from "@/components/HolidayForm";
import { todayStr } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 何も入っていない曜日の既定。お店をやっていない前提にはしない。 */
const DEFAULT_ROW = { openTime: "09:00", closeTime: "18:00" };

export default async function HoursPage() {
  const [hours, holidays] = await Promise.all([
    prisma.businessHour.findMany({ where: { staffId: null } }),
    prisma.holiday.findMany({ orderBy: { date: "asc" } }),
  ]);

  // 曜日ごとに1行そろえる。無い曜日はお休み扱いで出す。
  const general = hours.filter((h) => h.deliveryType === null);
  const rows: DayRow[] = Array.from({ length: 7 }, (_, d) => {
    const found = general.find((h) => h.dayOfWeek === d);
    if (!found) return { dayOfWeek: d, isClosed: true, ...DEFAULT_ROW };
    return {
      dayOfWeek: d,
      isClosed: found.isClosed,
      openTime: found.openTime,
      closeTime: found.closeTime,
    };
  });

  const online = hours.filter((h) => h.deliveryType === "online");
  const onlineEnabled = online.length > 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">営業時間とお休み</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          ここで決めた時間の中だけ、お客様の予約画面に空き時間が出ます。
          移動や準備にかかる時間は自動で差し引くので、
          <b>お仕事をしている時間をそのまま</b>入れてください。
        </p>
      </header>

      <section>
        <SectionTitle hint="曜日ごとに決めます。お休みの曜日はチェックを入れてください">
          曜日ごとの受付時間
        </SectionTitle>
        <Card>
          <WeeklyHoursForm rows={rows} />
        </Card>
      </section>

      <section>
        <SectionTitle hint="訪問はしないけれど、オンラインなら受けられる時間がある場合に使います">
          オンラインだけの受付時間
        </SectionTitle>
        <Card>
          <OnlineHoursForm
            enabled={onlineEnabled}
            days={online.map((h) => h.dayOfWeek)}
            openTime={online[0]?.openTime ?? "20:00"}
            closeTime={online[0]?.closeTime ?? "22:00"}
          />
        </Card>
      </section>

      <section>
        <SectionTitle hint="年末年始や旅行など、決まった日のお休みです">お休みの日</SectionTitle>
        <Card>
          <HolidayForm
            today={todayStr()}
            holidays={holidays.map((h) => ({
              id: h.id,
              date: h.date,
              endDate: h.endDate,
              reason: h.reason,
            }))}
          />
        </Card>
      </section>

      <div className="flex gap-3 rounded-card border border-brand-200 bg-brand-50/60 px-4 py-3.5">
        <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div className="text-xs leading-relaxed text-slate-700">
          <p className="font-bold">急なお休みは、こちらではなく「予定表」から</p>
          <p className="mt-1">
            「今日の午後だけ」のような一時的な予定は、<b>予定表</b>の「予定を入れる」で塞げます。
            この画面は、ふだんの決まりごとを決める場所です。
          </p>
        </div>
      </div>
    </div>
  );
}
