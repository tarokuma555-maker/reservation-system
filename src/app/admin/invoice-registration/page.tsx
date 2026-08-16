import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Card, LinkButton, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * インボイス（適格請求書発行事業者）の登録を進めるための画面。
 *
 * 申請そのものは税務署への手続きなので、このシステムからは行えない。
 * ここでできるのは「申請のときに聞かれることを、あらかじめ手元にまとめておく」ことと、
 * 取れた番号を書類に反映させること。
 */
export default async function InvoiceRegistrationPage() {
  const s = await getSettings();
  const hasNumber = /^T\d{13}$/.test(s.registrationNumber);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tighter text-ink">
          インボイスの登録
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          登録番号があると、お客様が支払った消費税を経費として差し引けるようになります。
          法人のお客様やお店を相手にするときに求められることが多い番号です。
        </p>
      </header>

      {hasNumber ? (
        <div className="flex gap-3 rounded-card border border-good-100 bg-good-50 px-4 py-3.5">
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-good-600" strokeWidth={2.6} />
          <div className="text-xs leading-relaxed text-good-700">
            <p className="font-bold">登録番号が入っています（{s.registrationNumber}）</p>
            <p className="mt-1 text-slate-600">
              これから発行する領収書に印字されます。発行した時点の番号を控えに焼き付けているので、
              あとから番号を変えても、過去の領収書はそのまま残ります。
            </p>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 rounded-card border border-warn-100 bg-warn-50 px-4 py-3.5">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" />
          <div className="text-xs leading-relaxed text-warn-700">
            <p className="font-bold">まだ登録番号が入っていません</p>
            <p className="mt-1">
              番号が届くまでは、<b>空のままにしておいてください</b>。
              誤った番号が印字された領収書では、お客様が消費税を差し引けません。
            </p>
          </div>
        </div>
      )}

      {/* ---------------- 申請前に決めること ---------------- */}
      <section>
        <SectionTitle hint="ここは金額に直結します。申請の前に必ずご確認ください">
          はじめに、税理士さんか税務署にご確認ください
        </SectionTitle>
        <Card className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            登録すると<b>消費税を納める事業者</b>になります。
            いま消費税を納めていない場合、登録によって新たに納税の義務が生じます。
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-xs">
            <li>登録したほうが得か、しないほうが得か（お客様に事業者が多いかどうかで変わります）</li>
            <li>いつから登録するか（課税期間の途中からにするかどうか）</li>
            <li>納め方をどちらにするか（本則課税・簡易課税）</li>
          </ul>
          <p className="text-xs text-slate-600">
            これらは税務の判断になるため、システムでは決められません。
            決まったら、<Link href="/admin/settings" className="font-bold text-brand-700 underline">お店の設定</Link>
            の「税金まわり」にも同じ内容を入れてください。消費税の集計がその設定どおりに計算されます。
          </p>
        </Card>
      </section>

      {/* ---------------- 申請の手順 ---------------- */}
      <section>
        <SectionTitle hint="申請は国税庁へ行います。このシステムからは送れません">
          申請のしかた
        </SectionTitle>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <p className="text-sm font-bold text-ink">e-Tax で申請する（早いほう）</p>
            <p className="text-xs leading-relaxed text-slate-600">
              マイナンバーカードなどの電子証明書が要ります。
              登録の通知も、e-Taxのメッセージボックスで受け取れます。
            </p>
            <LinkButton
              href="https://www.e-tax.nta.go.jp/toiawase/qa/e-taxweb_invoice/01.htm"
              target="_blank"
              rel="noreferrer noopener"
              size="sm"
            >
              <Icon name="link" className="h-3.5 w-3.5" />
              e-Taxの手順を開く
            </LinkButton>
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-bold text-ink">紙で申請する</p>
            <p className="text-xs leading-relaxed text-slate-600">
              申請書を印刷して記入し、お住まいの地域を管轄する
              <b>インボイス登録センター</b>へ郵送します。
              電子証明書は要りませんが、通知までに時間がかかります。
            </p>
            <LinkButton
              href="https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice_shinsei.htm"
              target="_blank"
              rel="noreferrer noopener"
              variant="secondary"
              size="sm"
            >
              <Icon name="link" className="h-3.5 w-3.5" />
              申請書と送り先を見る
            </LinkButton>
          </Card>
        </div>
      </section>

      {/* ---------------- 準備シート ---------------- */}
      <section>
        <SectionTitle hint="申請の画面で聞かれることを、1枚にまとめて印刷できます">
          申請に使う控え
        </SectionTitle>
        <Card className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-700">
            申請では、お店の名前・所在地・法人番号などを入力します。
            設定に入っている内容をまとめた紙を出せるので、
            <b>手元に置きながら入力</b>していただけます。
          </p>
          <LinkButton href="/print/invoice-registration" target="_blank" rel="noreferrer noopener">
            <Icon name="receipt" className="h-4 w-4" />
            控えをPDFで保存する
          </LinkButton>
          <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
            <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            これは<b>下書き用の控え</b>です。この紙を税務署に送っても受け付けられません。
            提出は、上のe-Taxか国税庁の申請書からお願いします。
          </p>
        </Card>
      </section>

      {/* ---------------- 番号が届いたら ---------------- */}
      <section>
        <SectionTitle hint="ここまで来たら、あとは1か所入れるだけです">
          登録番号が届いたら
        </SectionTitle>
        <Card className="space-y-3 text-sm leading-relaxed text-slate-700">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              <Link href="/admin/settings" className="font-bold text-brand-700 underline">
                お店の設定
              </Link>
              の「インボイスの登録番号」に、<b>T + 13桁</b>を入れて保存します
            </li>
            <li>以降に発行する領収書へ、自動で印字されます</li>
            <li>
              <a
                href="https://www.invoice-kohyo.nta.go.jp/"
                target="_blank"
                rel="noreferrer noopener"
                className="font-bold text-brand-700 underline"
              >
                公表サイト
              </a>
              でご自身の番号を検索し、名前と住所が正しく出るかご確認ください
            </li>
          </ol>
        </Card>
      </section>
    </div>
  );
}
