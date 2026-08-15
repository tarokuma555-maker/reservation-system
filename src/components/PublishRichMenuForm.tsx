"use client";

import { useActionState } from "react";
import { publishRichMenuAction } from "@/app/actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";

/** メニューを出すボタン。押した結果を、そのボタンのすぐ下に出す。 */
export default function PublishRichMenuForm({
  richMenuId,
  isPublished,
  disabled,
}: {
  richMenuId: string;
  isPublished: boolean;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState<{ ok?: string; error?: string }, FormData>(
    publishRichMenuAction,
    {}
  );

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="richMenuId" value={richMenuId} />
      {disabled ? (
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-pill border border-slate-200 bg-slate-100 px-6 py-2.5 text-sm font-bold text-slate-400"
        >
          {isPublished ? "もう一度出しなおす" : "このメニューを出す"}
        </button>
      ) : (
        <SubmitButton
          icon="send"
          variant={isPublished ? "secondary" : "primary"}
          pendingLabel="LINEに送っています…"
          className="w-full justify-center"
        >
          {isPublished ? "もう一度出しなおす" : "このメニューを出す"}
        </SubmitButton>
      )}
      <FormResult ok={state.ok} error={state.error} />
    </form>
  );
}
