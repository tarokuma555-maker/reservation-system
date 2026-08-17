/**
 * 控えに埋め込む体裁。
 *
 * 交付した書類の控えは、あとから開いても当時の見た目でなければ意味が薄い。
 * 外の読み込みに頼ると、その先が変わったときに見た目まで変わってしまうため、
 * 使っている分だけをここに書き出して、控えの中に閉じ込める。
 *
 * InvoiceDocument で使っている表現だけを並べている。
 * あちらに新しい表現を足したら、こちらにも足すこと。
 */
export function archiveStylesheet(): string {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP",Meiryo,system-ui,sans-serif;
  color:#2B1A10;background:#fff;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{border-collapse:collapse}

.bg-white{background:#fff}
.bg-slate-50{background:#F8FAFC}
.bg-bad-50{background:#FDEFEC}

.text-ink{color:#2B1A10}
.text-slate-500{color:#64748B}
.text-slate-600{color:#475569}
.text-slate-700{color:#334155}
.text-bad-600{color:#C4442E}

.text-\\[11px\\]{font-size:11px}
.text-xs{font-size:12px}
.text-sm{font-size:14px}
.text-lg{font-size:18px}
.text-xl{font-size:20px}
.text-3xl{font-size:30px}

.font-medium{font-weight:500}
.font-bold{font-weight:700}
.tracking-wide{letter-spacing:.025em}
.leading-relaxed{line-height:1.625}
.tabular-nums{font-variant-numeric:tabular-nums}

.text-left{text-align:left}
.text-right{text-align:right}

.flex{display:flex}
.flex-wrap{flex-wrap:wrap}
.items-start{align-items:flex-start}
.items-end{align-items:flex-end}
.justify-between{justify-content:space-between}
.justify-end{justify-content:flex-end}
.gap-6{gap:24px}

.w-full{width:100%}
.max-w-xs{max-width:320px}

.p-3{padding:12px}
.p-8{padding:32px}
.py-1{padding-top:4px;padding-bottom:4px}
.py-2{padding-top:8px;padding-bottom:8px}
.pb-1{padding-bottom:4px}
.ml-1{margin-left:4px}
.mt-1{margin-top:4px}
.mt-4{margin-top:16px}
.mt-6{margin-top:24px}
.mt-8{margin-top:32px}

.rounded{border-radius:4px}
.border-t{border-top-width:1px;border-top-style:solid}
.border-b{border-bottom-width:1px;border-bottom-style:solid}
.border-y{border-top-width:1px;border-bottom-width:1px;border-top-style:solid;border-bottom-style:solid}
.border-slate-100{border-color:#F1F5F9}
.border-slate-300{border-color:#CBD5E1}
.border-slate-400{border-color:#94A3B8}

@page{size:A4;margin:14mm}
`.trim();
}
