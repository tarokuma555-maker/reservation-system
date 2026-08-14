/**
 * 実際にMessaging APIへ送るJSONを、LINEのトーク画面に近い見た目で描画する。
 * モックモードでも「お客様に何が届くか」をそのまま確認できるようにするためのもの。
 */

type AnyObj = Record<string, unknown>;

export function FlexPreview({ payload }: { payload: string }) {
  let parsed: { messages?: AnyObj[] };
  try {
    parsed = JSON.parse(payload);
  } catch {
    return <p className="text-xs text-bad-600">メッセージの内容を読み取れませんでした</p>;
  }

  return (
    <div className="space-y-2">
      {(parsed.messages ?? []).map((m, i) => (
        <MessageBubble key={i} message={m} />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: AnyObj }) {
  if (message.type === "text") {
    return (
      <div className="max-w-[280px] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 shadow-card ring-1 ring-slate-200/70">
        {String(message.text ?? "")}
      </div>
    );
  }

  if (message.type === "flex") {
    const bubble = (message.contents ?? {}) as AnyObj;
    const header = bubble.header as AnyObj | undefined;
    const body = bubble.body as AnyObj | undefined;
    const footer = bubble.footer as AnyObj | undefined;

    const headerContents = (header?.contents ?? []) as AnyObj[];
    const title = String(headerContents[0]?.text ?? "");
    const subtitle = headerContents[1] ? String(headerContents[1].text ?? "") : "";
    const bg = String(header?.backgroundColor ?? "#D2500F");

    const bodyContents = (body?.contents ?? []) as AnyObj[];

    return (
      <div className="max-w-[300px] overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-slate-200/70">
        <div style={{ backgroundColor: bg }} className="px-4 py-3 text-white">
          <p className="text-sm font-bold">{title}</p>
          {subtitle ? <p className="text-2xs opacity-90">{subtitle}</p> : null}
        </div>
        <div className="space-y-1.5 px-4 py-3">
          {bodyContents.map((c, i) => {
            const contents = (c.contents ?? []) as AnyObj[];
            if (c.layout === "baseline") {
              return (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="w-20 shrink-0 text-slate-500">{String(contents[0]?.text ?? "")}</span>
                  <span className="flex-1 break-all text-slate-800">
                    {String(contents[1]?.text ?? "")}
                  </span>
                </div>
              );
            }
            return (
              <div key={i} className="rounded-lg bg-brand-50 px-2.5 py-2 text-2xs leading-relaxed text-slate-600">
                {String(contents[0]?.text ?? "")}
              </div>
            );
          })}
        </div>
        {footer ? (
          <div className="space-y-1.5 px-4 pb-3">
            {((footer.contents ?? []) as AnyObj[]).map((b, i) => {
              const action = (b.action ?? {}) as AnyObj;
              return (
                <div
                  key={i}
                  style={{ backgroundColor: String(b.color ?? "#D2500F") }}
                  className="rounded-pill py-2 text-center text-xs font-bold text-white"
                >
                  {String(action.label ?? "")}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded bg-slate-100 px-3 py-2 text-xs text-slate-600">
      未対応のメッセージ種別: {String(message.type)}
    </div>
  );
}
