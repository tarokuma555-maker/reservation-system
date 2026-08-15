"use client";

import { useActionState } from "react";
import {
  deleteMenuAction,
  toggleMenuPublishedAction,
  type MenuState,
} from "@/app/admin/menu-actions";
import { FormResult, SubmitButton } from "@/components/FormFeedback";
import { MenuEditorToggle, type MenuValues } from "@/components/MenuEditor";

/**
 * 一覧の行にある「直す・出す・消す」。
 *
 * どれも押したあとに結果を出す。以前は何も出ず、
 * 効いたのかどうかが画面から読み取れなかった。
 */
export default function MenuRowActions({
  values,
  categories,
  usedCount,
}: {
  values: MenuValues;
  categories: string[];
  usedCount: number;
}) {
  const [toggleState, toggleAction] = useActionState<MenuState, FormData>(
    toggleMenuPublishedAction,
    {}
  );
  const [deleteState, deleteAction] = useActionState<MenuState, FormData>(deleteMenuAction, {});

  const confirmText =
    usedCount > 0
      ? `「${values.name}」はご予約${usedCount}件で使われています。消さずに「出さない」に切り替えます。よろしいですか？`
      : `「${values.name}」を消します。元に戻せません。よろしいですか？`;

  return (
    <div className="space-y-2">
      <FormResult ok={toggleState.ok ?? deleteState.ok} error={toggleState.error ?? deleteState.error} />

      <div className="flex flex-wrap items-center gap-2">
        <MenuEditorToggle values={values} categories={categories} />

        <form action={toggleAction}>
          <input type="hidden" name="id" value={values.id} />
          <SubmitButton
            variant="secondary"
            size="sm"
            icon={values.isPublished ? "close" : "check"}
            pendingLabel="変えています…"
          >
            {values.isPublished ? "出すのをやめる" : "お客様に出す"}
          </SubmitButton>
        </form>

        <form action={deleteAction} className="ml-auto">
          <input type="hidden" name="id" value={values.id} />
          <SubmitButton
            variant="danger"
            size="sm"
            icon="trash"
            pendingLabel="消しています…"
            confirm={confirmText}
          >
            {usedCount > 0 ? "消す（出すのをやめます）" : "消す"}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
