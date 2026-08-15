import Link from "next/link";
import { getCurrentCustomer } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import ProfileForm from "@/components/ProfileForm";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [customer, settings] = await Promise.all([getCurrentCustomer(), getSettings()]);

  if (!customer) {
    return (
      <p className="p-6 text-sm leading-relaxed text-slate-600">
        お客様の情報を読み込めませんでした。恐れ入りますが、
        LINEのメニューからもう一度お開きください。
      </p>
    );
  }

  return (
    <div className="space-y-5 p-4 pb-8">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-ink">ご登録内容</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          ご予約のときに使わせていただきます。あとからいつでも変更できます。
        </p>
      </div>

      <ProfileForm
        values={{
          name: customer.name,
          phone: customer.phone,
          postalCode: customer.postalCode ?? "",
          address: customer.address ?? "",
          buildingName: customer.buildingName ?? "",
          layout: customer.layout ?? "",
          keyHandover: customer.keyHandover ?? "",
          hasPet: customer.hasPet,
        }}
      />

      <div className="rounded-xl border border-slate-200 bg-ground-warm/50 px-4 py-3">
        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-slate-500">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          ご自宅へうかがえる地域は「{settings.serviceAreas.join("・")}」です。
          この地域以外にお住まいの場合も、オンラインのメニューはご利用いただけます。
        </p>
      </div>

      <Link
        href="/liff"
        className="block text-center text-xs font-bold text-slate-500 underline"
      >
        ホームにもどる
      </Link>
    </div>
  );
}
