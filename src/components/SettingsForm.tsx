"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "@/app/actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";

/**
 * 設定の入力欄をつつむ枠。
 *
 * 中身（入力欄そのもの）はサーバー側で組み立てたものをそのまま受け取る。
 * ここでやるのは「保存しました／できませんでした」を出すことだけ。
 */
export default function SettingsForm({ children }: { children: React.ReactNode }) {
  const [state, formAction] = useActionState<{ ok?: string; error?: string }, FormData>(
    updateSettingsAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-6">
      {children}

      {/* 画面のどこにいても押せるように下に貼りつく */}
      <div className="sticky bottom-0 -mx-1 space-y-2 border-t border-slate-200/80 bg-ground/95 px-1 py-3 backdrop-blur">
        <FormResult ok={state.ok} error={state.error} />
        <div className="flex flex-wrap items-center justify-end gap-4">
          <p className="text-2xs text-slate-500">変えたところは、保存を押すまで反映されません</p>
          <SubmitButton icon="check" pendingLabel="保存しています…" className="px-7 py-3">
            この内容で保存する
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
