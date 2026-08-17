import { test } from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../src/lib/db.ts";
import { issueInvoice } from "../src/lib/invoice.ts";
import {
  archiveIssuedInvoice,
  findInvoicesWithoutArchive,
  verifyArchive,
  RETENTION_YEARS,
} from "../src/lib/document-archive.ts";
import { addMinutes, jst } from "../src/lib/time.ts";

/**
 * お渡しした領収書の控えが、ちゃんと残るかの確かめ。
 *
 * 以前はPDFを作れたときだけ控えが残る形で、本番ではPDFを作れず
 * 控えが1件も残っていなかった。法律（電子帳簿保存法）で7年の保存が要る部分なので、
 * 「発行したら必ず残る」「二重に作らない」「あとから書きかわっていたら気づける」を確かめる。
 */

const DATE = "2026-09-05";

async function cleanup() {
  const invoices = await prisma.invoice.findMany({
    where: { customer: { name: { startsWith: "__test__" } } },
    select: { id: true, invoiceNumber: true },
  });
  for (const inv of invoices) {
    const docs = await prisma.document.findMany({ where: { invoiceId: inv.id } });
    for (const d of docs) {
      await prisma.documentLog.deleteMany({ where: { documentId: d.id } });
      await prisma.document.delete({ where: { id: d.id } });
    }
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { description: { contains: inv.invoiceNumber } } },
    });
    await prisma.journalEntry.deleteMany({
      where: { description: { contains: inv.invoiceNumber } },
    });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: inv.id } });
    await prisma.invoice.delete({ where: { id: inv.id } });
  }
  await prisma.reservation.deleteMany({ where: { source: "archive-test" } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: "__test__" } } });
  await prisma.menu.deleteMany({ where: { name: { startsWith: "__test__" } } });
}

/** 領収書を1枚発行するところまで用意する（控えはまだ作らない） */
async function issueOne(hour: string) {
  const staff = await prisma.staff.upsert({
    where: { id: "__test__owner" },
    create: { id: "__test__owner", name: "__test__オーナー", role: "owner" },
    update: {},
  });
  const menu = await prisma.menu.upsert({
    where: { id: "__test__menu" },
    create: {
      id: "__test__menu",
      category: "テスト",
      name: "__test__おそうじ",
      deliveryType: "visit",
      durationMinutes: 120,
      price: 10000,
    },
    update: {},
  });
  const customer = await prisma.customer.upsert({
    where: { id: "__test__customer" },
    create: {
      id: "__test__customer",
      name: "__test__お客様",
      phone: "090-0000-0000",
      address: "東京都中央区銀座1-1",
    },
    update: {},
  });

  const start = jst(DATE, hour);
  const reservation = await prisma.reservation.create({
    data: {
      customerId: customer.id,
      staffId: staff.id,
      menuId: menu.id,
      startAt: start,
      endAt: addMinutes(start, menu.durationMinutes),
      totalMinutes: menu.durationMinutes,
      totalPrice: menu.price,
      status: "completed",
      deliveryType: "visit",
      serviceAddress: customer.address,
      source: "archive-test",
    },
  });

  return issueInvoice({
    customerId: customer.id,
    reservationIds: [reservation.id],
    type: "receipt",
  });
}

test("控えには、法律で必要な項目がそのまま残る", async () => {
  await cleanup();
  const invoice = await issueOne("10:00");

  const { created } = await archiveIssuedInvoice(invoice.id);
  assert.equal(created, true);

  const doc = await prisma.document.findFirstOrThrow({ where: { invoiceId: invoice.id } });

  // 探すための3項目（いつ・いくら・どこの）
  assert.equal(doc.transactionAmount, invoice.totalAmount);
  assert.equal(doc.counterpartyName, invoice.recipientName);
  assert.equal(doc.transactionDate, DATE);

  // 7年とっておく
  assert.equal(doc.retentionUntil.slice(0, 4), String(Number(invoice.issueDate.slice(0, 4)) + RETENTION_YEARS));

  // 書類そのものの中身
  const html = doc.content ?? "";
  assert.ok(html.includes(invoice.invoiceNumber), "書類番号");
  assert.ok(html.includes(invoice.issuerName), "発行者の名称");
  assert.ok(html.includes(invoice.registrationNumber), "登録番号");
  assert.ok(html.includes(invoice.recipientName), "宛名");
  assert.ok(html.includes(invoice.totalAmount.toLocaleString()), "合計金額");

  // あとから開いても当時の見た目のままになるよう、体裁は埋め込み・外の読み込みは無し
  assert.ok(html.includes("<style>"), "体裁が埋め込まれている");
  assert.ok(!/<(script|link)\b/i.test(html), "外の読み込みが無い");

  await cleanup();
});

test("同じ書類の控えを二度作らない", async () => {
  await cleanup();
  const invoice = await issueOne("10:00");

  const first = await archiveIssuedInvoice(invoice.id);
  const second = await archiveIssuedInvoice(invoice.id);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.documentId, first.documentId);
  assert.equal(await prisma.document.count({ where: { invoiceId: invoice.id } }), 1);

  await cleanup();
});

test("控えが書きかわっていたら気づける", async () => {
  await cleanup();
  const invoice = await issueOne("10:00");
  await archiveIssuedInvoice(invoice.id);

  const doc = await prisma.document.findFirstOrThrow({ where: { invoiceId: invoice.id } });
  const html = doc.content ?? "";

  assert.equal(verifyArchive(html, doc.fileHash), true);

  // 金額を書きかえたら
  const cheaper = html.replace(invoice.totalAmount.toLocaleString(), "1");
  assert.notEqual(cheaper, html, "書きかえられていること自体の確認");
  assert.equal(verifyArchive(cheaper, doc.fileHash), false);

  // 空白ひとつでも
  assert.equal(verifyArchive(html + " ", doc.fileHash), false);

  await cleanup();
});

test("控えが残っていない発行ぶんを見つけて、あとから埋められる", async () => {
  await cleanup();
  const before = (await findInvoicesWithoutArchive()).length;

  const a = await issueOne("10:00");
  const b = await issueOne("14:00");

  const missing = await findInvoicesWithoutArchive();
  assert.equal(missing.length, before + 2);
  assert.ok(missing.some((m) => m.id === a.id));
  assert.ok(missing.some((m) => m.id === b.id));

  // 画面のボタンと同じ手順
  for (const m of missing) await archiveIssuedInvoice(m.id);
  assert.equal((await findInvoicesWithoutArchive()).length, 0);

  // 埋めたあとにもう一度押しても増えない
  for (const m of missing) await archiveIssuedInvoice(m.id);
  assert.equal(await prisma.document.count({ where: { invoiceId: a.id } }), 1);
  assert.equal(await prisma.document.count({ where: { invoiceId: b.id } }), 1);

  await cleanup();
  await prisma.$disconnect();
});
