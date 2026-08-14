import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOwner, getCurrentCustomer } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getAvailableSlots, layoutAdjustment } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const dateStr = params.get("date");
  const menuId = params.get("menuId");
  const extraMinutes = Number(params.get("extraMinutes") ?? 0);
  const excludeReservationId = params.get("exclude") ?? undefined;

  if (!dateStr || !menuId) {
    return NextResponse.json({ error: "date と menuId は必須です" }, { status: 400 });
  }

  const [menu, owner, settings, customer] = await Promise.all([
    prisma.menu.findUnique({ where: { id: menuId } }),
    getOwner(),
    getSettings(),
    getCurrentCustomer(),
  ]);
  if (!menu) return NextResponse.json({ error: "メニューが見つかりません" }, { status: 404 });

  const adjust = layoutAdjustment(
    settings,
    menu.deliveryType as "visit" | "online",
    menu.applyLayoutAdjust,
    customer?.layout
  );

  const slots = await getAvailableSlots({
    dateStr,
    durationMinutes: menu.durationMinutes + extraMinutes + adjust,
    deliveryType: menu.deliveryType as "visit" | "online",
    staffId: owner.id,
    excludeReservationId,
  });

  return NextResponse.json({
    date: dateStr,
    durationMinutes: menu.durationMinutes + extraMinutes + adjust,
    layoutAdjustMinutes: adjust,
    slots: slots.map((s) => ({ time: s.time, available: s.available, reason: s.reason })),
  });
}
