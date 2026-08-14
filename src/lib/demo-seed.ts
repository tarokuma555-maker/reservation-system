/**
 * デモ用の初期データ。
 * まだ確定していない項目（料金・営業時間・登録番号など）はすべて仮置きで、
 * 管理画面から変更できる。
 *
 * CLI（npm run db:seed）からも、サーバーレス起動時の自動投入からも同じ関数を使う。
 */
import { prisma } from "./db";
import { DEFAULT_SETTINGS } from "./settings";
import { addDays, addMinutes, jst, todayStr } from "./time";
import { generateOccurrences } from "./recurring";
import { issueInvoice } from "./invoice";
import {
  ensureChartOfAccounts,
  ensureFiscalYear,
  journalizeExpense,
  journalizeInvoice,
  journalizePayment,
  postOpeningBalances,
} from "./accounting";
import { syncReservationToCalendar } from "./google-calendar";
import { notifyBookingConfirmed, notifyWelcome } from "./notifications";

export async function seedDemoData() {
  // 既存データを消してから作り直す
  await prisma.documentLog.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.document.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.fixedAsset.deleteMany();
  await prisma.fiscalYear.deleteMany();
  await prisma.account.deleteMany();
  await prisma.outboundMessage.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.richMenu.deleteMany();
  await prisma.calendarSync.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.reservationLog.deleteMany();
  await prisma.reservationOption.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.recurringRule.deleteMany();
  await prisma.blockedSlot.deleteMany();
  await prisma.menuOption.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.setting.deleteMany();

  await prisma.setting.upsert({
    where: { key: "app_settings" },
    create: { key: "app_settings", value: JSON.stringify(DEFAULT_SETTINGS) },
    update: { value: JSON.stringify(DEFAULT_SETTINGS) },
  });

  const owner = await prisma.staff.create({
    data: {
      name: "オーナー（田中）",
      role: "owner",
      canHandleOnline: true,
      baseAddress: DEFAULT_SETTINGS.baseAddress,
    },
  });

  // 営業時間: 平日9:00-18:00 / 土9:00-15:00 / 日休
  for (let d = 1; d <= 5; d++) {
    await prisma.businessHour.create({
      data: { staffId: null, dayOfWeek: d, openTime: "09:00", closeTime: "18:00" },
    });
    // オンラインのみ夜枠も受け付ける
    await prisma.businessHour.create({
      data: { staffId: null, dayOfWeek: d, openTime: "20:00", closeTime: "22:00", deliveryType: "online" },
    });
  }
  await prisma.businessHour.create({
    data: { staffId: null, dayOfWeek: 6, openTime: "09:00", closeTime: "15:00" },
  });
  await prisma.businessHour.create({
    data: { staffId: null, dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isClosed: true },
  });

  // 臨時休業日（デモ用に2週間後）
  await prisma.holiday.create({
    data: { date: addDays(todayStr(), 14), reason: "研修のため休業" },
  });

  // メニュー（料金はすべて税込。総額表示義務に合わせている）
  const m = {
    clean3: await prisma.menu.create({
      data: {
        category: "お掃除",
        name: "おそうじ基本プラン（3時間）",
        deliveryType: "visit",
        description: "キッチン・浴室・トイレ・床の掃除機がけまで、お部屋全体を整えます。",
        durationMinutes: 180,
        price: 13200,
        applyLayoutAdjust: true,
        sortOrder: 1,
      },
    }),
    clean2: await prisma.menu.create({
      data: {
        category: "お掃除",
        name: "おそうじライト（2時間）",
        deliveryType: "visit",
        description: "水回り中心の短時間プラン。",
        durationMinutes: 120,
        price: 9900,
        applyLayoutAdjust: true,
        sortOrder: 2,
      },
    }),
    trial: await prisma.menu.create({
      data: {
        category: "初回お試し",
        name: "初回お試し（2時間）",
        deliveryType: "visit",
        description: "はじめての方限定。気になる場所を2時間で。",
        durationMinutes: 120,
        price: 6600,
        isFirstTimeOnly: true,
        sortOrder: 0,
      },
    }),
    cleanRecurring: await prisma.menu.create({
      data: {
        category: "お掃除",
        name: "定期おそうじ（3時間）",
        deliveryType: "visit",
        description: "定期利用の方向けの割引プランです。",
        durationMinutes: 180,
        price: 12100,
        applyLayoutAdjust: true,
        isRecurringOnly: true,
        sortOrder: 3,
      },
    }),
    consultVisit: await prisma.menu.create({
      data: {
        category: "片付けコンサル",
        name: "片付けコンサル 訪問（3時間）",
        deliveryType: "visit",
        description: "お部屋を一緒に見ながら、片付けの仕組みを作ります。",
        durationMinutes: 180,
        price: 19800,
        sortOrder: 4,
      },
    }),
    consultOnline60: await prisma.menu.create({
      data: {
        category: "片付けコンサル",
        name: "片付けコンサル オンライン（60分）",
        deliveryType: "online",
        description: "ビデオ通話でお部屋を映していただきながらご相談。全国対応です。",
        durationMinutes: 60,
        price: 8800,
        sortOrder: 5,
      },
    }),
    consultOnline30: await prisma.menu.create({
      data: {
        category: "片付けコンサル",
        name: "オンライン相談（30分）",
        deliveryType: "online",
        description: "まずは短時間で相談したい方に。",
        durationMinutes: 30,
        price: 4400,
        sortOrder: 6,
      },
    }),
    onlineFollow: await prisma.menu.create({
      data: {
        category: "片付けコンサル",
        name: "オンラインフォロー（月1回・45分）",
        deliveryType: "online",
        description: "片付けの習慣化を月1回のオンラインで伴走します。",
        durationMinutes: 45,
        price: 6600,
        isRecurringOnly: true,
        sortOrder: 7,
      },
    }),
  };

  // オプション（訪問メニュー向け）
  const options = await Promise.all([
    prisma.menuOption.create({
      data: { menuId: null, name: "換気扇クリーニング", additionalMinutes: 60, additionalPrice: 5500, sortOrder: 1 },
    }),
    prisma.menuOption.create({
      data: { menuId: null, name: "冷蔵庫内クリーニング", additionalMinutes: 30, additionalPrice: 3300, sortOrder: 2 },
    }),
    prisma.menuOption.create({
      data: { menuId: null, name: "窓・サッシ拭き", additionalMinutes: 30, additionalPrice: 2750, sortOrder: 3 },
    }),
  ]);

  // 顧客
  const c = {
    sato: await prisma.customer.create({
      data: {
        lineUserId: "U_demo_sato",
        name: "佐藤 美咲",
        nameKana: "サトウ ミサキ",
        phone: "090-1234-5678",
        postalCode: "154-0001",
        address: "東京都世田谷区池尻2-10-5",
        buildingName: "パークハイツ301",
        layout: "2LDK",
        keyHandover: "在宅",
        tags: "定期,VIP",
        consentAt: new Date(),
      },
    }),
    yamada: await prisma.customer.create({
      data: {
        lineUserId: "U_demo_yamada",
        name: "山田 健一",
        nameKana: "ヤマダ ケンイチ",
        phone: "080-2222-3333",
        postalCode: "153-0051",
        address: "東京都目黒区上目黒1-5-2",
        layout: "3LDK以上",
        hasPet: true,
        keyHandover: "キーボックス",
        tags: "ペットあり",
        consentAt: new Date(),
      },
    }),
    // オンラインのみの遠方顧客（住所を持たない＝訪問メニューは予約できない）
    kobayashi: await prisma.customer.create({
      data: {
        lineUserId: "U_demo_kobayashi",
        name: "小林 あかり",
        nameKana: "コバヤシ アカリ",
        phone: "070-4444-5555",
        email: "akari@example.com",
        tags: "オンラインのみ,遠方",
        consentAt: new Date(),
      },
    }),
    // 法人顧客（インボイスの宛名が法人名になる）
    corp: await prisma.customer.create({
      data: {
        lineUserId: "U_demo_corp",
        name: "受付 担当",
        nameKana: "ウケツケ タントウ",
        phone: "03-1111-2222",
        companyName: "株式会社みらいオフィス",
        registrationNumber: "T9876543210987",
        postalCode: "150-0002",
        address: "東京都渋谷区渋谷3-1-1",
        buildingName: "みらいビル5F",
        invoiceDelivery: "email",
        tags: "法人,月次一括",
        consentAt: new Date(),
      },
    }),
  };

  const today = todayStr();

  // 単発予約をいくつか作る
  const mk = async (
    customerId: string,
    menu: { id: string; deliveryType: string; durationMinutes: number; price: number; name: string },
    dateStr: string,
    time: string,
    status = "confirmed",
    address?: string | null
  ) => {
    const start = jst(dateStr, time);
    return prisma.reservation.create({
      data: {
        customerId,
        staffId: owner.id,
        menuId: menu.id,
        startAt: start,
        endAt: addMinutes(start, menu.durationMinutes),
        totalMinutes: menu.durationMinutes,
        totalPrice: menu.price,
        status,
        deliveryType: menu.deliveryType,
        serviceAddress: menu.deliveryType === "visit" ? address ?? null : null,
        meetingUrl:
          menu.deliveryType === "online"
            ? `https://meet.google.com/demo-${dateStr.replace(/-/g, "")}-${time.replace(":", "")}`
            : null,
        source: "line",
      },
    });
  };

  // 本日の予定（訪問 → オンラインの並びで、移動余裕時間の効き方が見える）
  await mk(c.yamada.id, m.clean3, today, "09:30", "confirmed", "東京都目黒区上目黒1-5-2");
  await mk(c.kobayashi.id, m.consultOnline60, today, "16:00");

  // 明日以降
  await mk(c.sato.id, m.clean2, addDays(today, 1), "10:00", "confirmed", "東京都世田谷区池尻2-10-5 パークハイツ301");
  await mk(c.corp.id, m.consultVisit, addDays(today, 2), "13:00", "confirmed", "東京都渋谷区渋谷3-1-1 みらいビル5F");
  await mk(c.kobayashi.id, m.consultOnline30, addDays(today, 3), "20:00");

  // 実施済み（請求書の発行対象になる）
  const done1 = await mk(c.sato.id, m.clean3, addDays(today, -7), "10:00", "completed", "東京都世田谷区池尻2-10-5 パークハイツ301");
  const done2 = await mk(c.corp.id, m.consultVisit, addDays(today, -5), "14:00", "completed", "東京都渋谷区渋谷3-1-1 みらいビル5F");

  // オプション付きの実施済み予約（請求明細が2行になる例）
  await prisma.reservationOption.create({
    data: {
      reservationId: done1.id,
      optionId: options[0].id,
      name: options[0].name,
      additionalMinutes: options[0].additionalMinutes,
      additionalPrice: options[0].additionalPrice,
    },
  });
  await prisma.reservation.update({
    where: { id: done1.id },
    data: {
      totalMinutes: done1.totalMinutes + options[0].additionalMinutes,
      totalPrice: done1.totalPrice + options[0].additionalPrice,
      endAt: addMinutes(done1.endAt, options[0].additionalMinutes),
      paymentStatus: "cash_received",
    },
  });
  await prisma.reservation.update({
    where: { id: done2.id },
    data: { paymentStatus: "transfer_confirmed" },
  });

  // ブロック枠（私用予定。Googleカレンダーから取り込んだ想定）
  const blockStart = jst(addDays(today, 1), "15:00");
  await prisma.blockedSlot.create({
    data: {
      staffId: owner.id,
      startAt: blockStart,
      endAt: addMinutes(blockStart, 120),
      title: "こどもの学校行事",
      source: "google",
    },
  });

  // 定期ルール1: 毎週火曜10:00 訪問おそうじ
  const rule1 = await prisma.recurringRule.create({
    data: {
      customerId: c.sato.id,
      staffId: owner.id,
      menuId: m.cleanRecurring.id,
      frequency: "weekly",
      dayOfWeek: 2,
      startTime: "10:00",
      durationMinutes: m.cleanRecurring.durationMinutes,
      startDate: today,
      status: "active",
    },
  });

  // 定期ルール2: 毎月第2土曜 11:00 オンラインフォロー
  const rule2 = await prisma.recurringRule.create({
    data: {
      customerId: c.kobayashi.id,
      staffId: owner.id,
      menuId: m.onlineFollow.id,
      frequency: "monthly_nth",
      dayOfWeek: 6,
      nthWeek: 2,
      startTime: "11:00",
      durationMinutes: m.onlineFollow.durationMinutes,
      startDate: today,
      status: "active",
    },
  });

  const g1 = await generateOccurrences(rule1.id);
  const g2 = await generateOccurrences(rule2.id);

  /* ---------- リッチメニュー ---------- */
  await prisma.richMenu.create({
    data: {
      name: "はじめての方向け",
      target: "default",
      chatBarText: "メニュー",
      areas: JSON.stringify([
        { label: "はじめての方へ", icon: "sparkle", path: "" },
        { label: "料金・メニュー", icon: "list", path: "/menus" },
        { label: "予約する", icon: "calendar", path: "/menus" },
        { label: "定期利用", icon: "repeat", path: "/recurring/new" },
        { label: "よくある質問", icon: "help", path: "" },
        { label: "お問い合わせ", icon: "chat", path: "" },
      ]),
    },
  });
  await prisma.richMenu.create({
    data: {
      name: "ご予約がある方向け",
      target: "booked",
      chatBarText: "予約メニュー",
      areas: JSON.stringify([
        { label: "次回の予約", icon: "calendarCheck", path: "/reservations" },
        { label: "予約を変更", icon: "edit", path: "/reservations" },
        { label: "キャンセル", icon: "close", path: "/reservations" },
        { label: "定期利用の管理", icon: "repeat", path: "/recurring" },
        { label: "新しく予約", icon: "calendar", path: "/menus" },
        { label: "領収書", icon: "receipt", path: "/invoices" },
      ]),
    },
  });

  /* ---------- Googleカレンダーへ書き出し ---------- */
  const toSync = await prisma.reservation.findMany({
    where: { status: { in: ["confirmed", "completed"] } },
    select: { id: true },
  });
  for (const r of toSync) await syncReservationToCalendar(r.id);

  // Google側にだけある私用予定（取り込みのデモ用）
  const personalStart = jst(addDays(today, 5), "13:00");
  await prisma.calendarEvent.create({
    data: {
      googleEventId: "mock_personal_seed_1",
      summary: "歯科（Googleカレンダーに直接入れた予定）",
      startAt: personalStart,
      endAt: addMinutes(personalStart, 90),
      source: "personal",
    },
  });

  /* ---------- LINE通知 ---------- */
  await notifyWelcome(c.sato.id);
  const upcoming = await prisma.reservation.findMany({
    where: { status: "confirmed", startAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    take: 3,
  });
  for (const r of upcoming) await notifyBookingConfirmed(r.id);

  /* ---------- 会計 ---------- */
  await ensureChartOfAccounts();
  const fy = await ensureFiscalYear(today);

  // 期首残高（導入時の移行を想定した仮の値）
  await postOpeningBalances(fy.id, [
    { accountCode: "1010", debit: 150_000 },
    { accountCode: "1020", debit: 1_850_000 },
    { accountCode: "1500", debit: 480_000 },
    { accountCode: "1590", credit: 160_000 },
    { accountCode: "3010", credit: 1_000_000 },
    { accountCode: "3020", credit: 1_320_000 },
  ]);

  // 固定資産（減価償却のデモ用）
  await prisma.fixedAsset.create({
    data: {
      name: "業務用スチームクリーナー",
      acquisitionDate: addDays(today, -400),
      acquisitionCost: 480_000,
      accountCode: "1500",
      usefulLife: 6,
      accumulatedDepreciation: 160_000,
    },
  });

  // 発行済みの請求書と、その売上・入金の仕訳
  const inv = await issueInvoice({ customerId: c.sato.id, reservationIds: [done1.id], type: "receipt" });
  await journalizeInvoice(inv.id);
  await journalizePayment({
    reservationId: done1.id,
    date: addDays(today, -7),
    amount: done1.totalPrice + options[0].additionalPrice,
    method: "cash",
    customerName: "佐藤 美咲",
  });

  // 経費をいくつか登録し、仕訳まで通す
  const expenseSeed = [
    { date: addDays(today, -20), account: "5110", amount: 2640, vendor: "カインズホーム 世田谷店", reg: "T1234567890999", status: "qualified" },
    { date: addDays(today, -12), account: "5140", amount: 6255, vendor: "ENEOS 環七通り給油所", reg: "T2345678901234", status: "qualified" },
    { date: addDays(today, -9), account: "5150", amount: 600, vendor: "パークタイム目黒第3", reg: null, status: "small_amount_exception" },
    { date: addDays(today, -4), account: "5200", amount: 33000, vendor: "一般社団法人 整理収納協会", reg: "T3456789012345", status: "qualified" },
    { date: addDays(today, -3), account: "5160", amount: 8800, vendor: "スマホ通信（個人事業者）", reg: null, status: "non_qualified" },
  ];

  for (const e of expenseSeed) {
    const doc = await prisma.document.create({
      data: {
        kind: "received_receipt",
        filePath: `storage/receipts/${e.date}-${e.vendor}.jpg`,
        mimeType: "image/jpeg",
        transactionDate: e.date,
        transactionAmount: e.amount,
        counterpartyName: e.vendor,
        retentionUntil: addDays(e.date, 365 * 7),
      },
    });
    await prisma.documentLog.create({
      data: { documentId: doc.id, action: "create", detail: "レシートを撮影して登録" },
    });
    const expense = await prisma.expense.create({
      data: {
        expenseDate: e.date,
        accountCode: e.account,
        amount: e.amount,
        taxCategory: "課税10",
        vendorName: e.vendor,
        vendorRegistrationNumber: e.reg,
        invoiceStatus: e.status,
        documentId: doc.id,
      },
    });
    await journalizeExpense(expense.id);
  }

  const summary: string[] = [];
  const log = (m: string) => summary.push(m);
  log("デモデータを作成しました");
  log(`スタッフ: ${owner.name}`);
  log(`メニュー: ${Object.keys(m).length}件 / オプション: ${options.length}件`);
  log(`顧客: 4名（うちオンラインのみ1名・法人1名）`);
  log(`定期ルール1（毎週火曜・訪問）: ${g1.created}件を生成`);
  log(`定期ルール2（毎月第2土曜・オンライン）: ${g2.created}件を生成`);
  log(`カレンダーへ書き出し: ${toSync.length}件`);
  log(`会計: 勘定科目 ${(await prisma.account.count())}件 / 仕訳 ${(await prisma.journalEntry.count())}件 / レシート・書類 ${(await prisma.document.count())}件`);
  log(`LINE通知: ${(await prisma.outboundMessage.count())}件（送信したことにする）`);
  if (g1.conflicts.length || g2.conflicts.length) {
    log(`要調整: ${[...g1.conflicts, ...g2.conflicts].join(" / ")}`);
  }

  await prisma.setting.upsert({
    where: { key: SEED_MARKER_KEY },
    create: { key: SEED_MARKER_KEY, value: JSON.stringify({ seededOn: todayStr() }) },
    update: { value: JSON.stringify({ seededOn: todayStr() }) },
  });

  return summary;
}

const SEED_MARKER_KEY = "demo_seeded_on";

/**
 * デモの日付が古くなっていたら作り直す。
 * サーバーレス環境では起動のたびにこれが走り、常に「今日」を基準にしたデータになる。
 */
export async function ensureFreshDemoData() {
  const marker = await prisma.setting.findUnique({ where: { key: SEED_MARKER_KEY } }).catch(() => null);
  if (marker) {
    try {
      const { seededOn } = JSON.parse(marker.value) as { seededOn: string };
      if (seededOn === todayStr()) return { reseeded: false };
    } catch {
      /* 壊れていたら作り直す */
    }
  }
  await seedDemoData();
  return { reseeded: true };
}
