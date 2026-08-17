"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { SubmitButton, FormResult } from "@/components/FormFeedback";
import { backfillArchivesAction, type ArchiveState } from "@/app/admin/archive-actions";

/**
 * 控えが残っていない領収書を、あとから残す。
 *
 * 以前は控えがうまく保存できていなかった時期があり、そのぶんだけ残っていない。
 * 押すのは一度でよく、押したあとは残っていないものが無くなるので、
 * 次にこの画面を開いたときには出てこない。
 */
export default function ArchiveBackfill({ missing }: { missing: number }) {
  const [state, action] = useActionState<ArchiveState, FormData>(backfillArchivesAction, {});
  const done = Boolean(state.ok || state.error);

  // まだ何も押していなくて、残っていないものも無いなら、出す必要がない。
  // 押したあとは、作り終えていても結果だけは必ず出す
  // （押したのに画面から消えると、効いたのか分からなくなるため）
  if (missing === 0 && !done) return null;

  return (
    <Card className="border-warn-100 bg-warn-50/50">
      <div className="flex gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warn-100 text-warn-700">
          <Icon name={done && !state.error ? "check" : "alert"} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {missing > 0 ? (
            <>
              <p className="text-sm font-bold text-ink">
                控えが残っていない領収書が {missing}件 あります
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                お客様にお渡しした領収書は、7年間とっておくことが法律で決まっています。
                以前お渡ししたぶんの控えが、この中に入っていません。
                下のボタンを<b>一度だけ</b>押すと、お渡ししたときの内容そのままで控えが作られます。
                金額や宛名が変わることはありません。
              </p>
            </>
          ) : (
            <p className="text-sm font-bold text-ink">控えの作成が終わりました</p>
          )}
          <form action={action} className="mt-3 space-y-3">
            {missing > 0 ? (
              <SubmitButton icon="folder" pendingLabel="控えを作っています…">
                控えをまとめて作る
              </SubmitButton>
            ) : null}
            <FormResult ok={state.ok} error={state.error} />
          </form>
        </div>
      </div>
    </Card>
  );
}
