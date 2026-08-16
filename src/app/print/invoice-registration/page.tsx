import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import PrintTrigger from "@/components/PrintTrigger";

export const dynamic = "force-dynamic";

/**
 * インボイス登録申請の下書き用の控え。
 *
 * 申請そのものは国税庁で行う。ここで出すのは
 * 「申請の画面で聞かれることを、手元に並べた紙」。
 * 提出用の様式ではないので、そのことを紙面にも書いておく。
 */
export default async function PrintInvoiceRegistration() {
  const [s, owner] = await Promise.all([
    getSettings(),
    prisma.staff.findFirst({ where: { role: "owner" } }),
  ]);

  return (
    <div className="mx-auto max-w-[820px] px-8 py-10 text-ink">
      <PrintTrigger />

      <p className="no-print mb-6 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-xs leading-relaxed text-slate-700">
        印刷の画面が出たら、送り先に<b>「PDFとして保存」</b>をえらんでください。
        出てこない場合は <b>⌘P</b>（Windowsは <b>Ctrl+P</b>）で開けます。
      </p>

      <header className="mb-6 border-b-2 border-ink pb-4">
        <h1 className="text-xl font-bold tracking-tight">インボイス登録申請の控え</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          申請の画面で聞かれることを、手元にまとめたものです。
        </p>
      </header>

      <div className="mb-6 border-2 border-bad-600 px-4 py-3">
        <p className="text-sm font-bold text-bad-700">この紙は提出用ではありません</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-700">
          税務署に送っても受け付けられません。申請は e-Tax、または国税庁の申請書を
          インボイス登録センターへ郵送して行ってください。
        </p>
      </div>

      <Section title="1. お店の情報（設定から）">
        <Row label="名称（登記どおり）" value={s.issuerName} />
        <Row label="所在地" value={s.baseAddress} />
        <Row label="代表者名" value={owner?.name ?? ""} />
        <Row label="いまの登録番号" value={s.registrationNumber || "（まだありません）"} />
      </Section>

      <Section title="2. 申請のときに手元に要るもの">
        <Check>法人番号（13桁）※国税庁の法人番号公表サイトで調べられます</Check>
        <Check>マイナンバーカードとカードリーダー（e-Taxで申請する場合）</Check>
        <Check>納税地（税務署の管轄）</Check>
        <Check>事業内容（例: 家事代行業、整理収納のコンサルティング）</Check>
        <Check>登録を希望する年月日</Check>
      </Section>

      <Section title="3. 申請の前に決めておくこと">
        <Check>登録するかどうか（消費税を納める事業者になります）</Check>
        <Check>いつから登録するか</Check>
        <Check>消費税の納め方（本則課税・簡易課税のどちらか）</Check>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          いずれも税務の判断です。税理士か、所轄の税務署にご確認ください。
        </p>
      </Section>

      <Section title="4. 番号が届いたあと">
        <Check>管理画面「お店の設定」の登録番号に、T + 13桁を入れて保存する</Check>
        <Check>国税庁の公表サイトで、名称と所在地が正しく出るか確かめる</Check>
        <Check>取引先に、登録番号を知らせる</Check>
      </Section>

      <div className="mt-8 border-t border-slate-300 pt-3 text-2xs leading-relaxed text-slate-600">
        <p>申請先・様式は国税庁のページでご確認ください。</p>
        <p className="mt-0.5">
          e-Tax: https://www.e-tax.nta.go.jp/toiawase/qa/e-taxweb_invoice/01.htm
        </p>
        <p>
          申請手続: https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice_shinsei.htm
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-base font-bold tracking-tight">
        {title}
      </h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-dotted border-slate-300 py-1.5 text-sm">
      <span className="w-48 shrink-0 text-slate-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** 手で確かめながら進められるよう、四角を印字する */
function Check({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm leading-relaxed">
      <span className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 border border-ink" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
