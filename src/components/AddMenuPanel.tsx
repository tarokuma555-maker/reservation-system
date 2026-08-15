"use client";

import { useState } from "react";
import MenuEditor from "@/components/MenuEditor";
import { Icon } from "@/components/Icon";

/** 「新しく追加」を押したときだけ入力欄を出す。ふだんは一覧を見やすくしておく。 */
export default function AddMenuPanel({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-pill bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-brand-700"
      >
        <Icon name="plus" className="h-4 w-4" />
        メニューを新しく追加する
      </button>
    );
  }

  return (
    <div className="rounded-card border border-brand-200 bg-brand-50/40 p-5">
      <p className="mb-4 text-sm font-bold text-ink">メニューを新しく追加する</p>
      <MenuEditor categories={categories} onDone={() => setOpen(false)} />
    </div>
  );
}
