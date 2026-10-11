import { NextResponse } from "next/server";
import { stripeConfigured } from "@/lib/stripe/env";
import { sweepDuePayouts } from "@/lib/stripe/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Periodic sweep: releases held funds for jobs that completed via the 48-hour
 * auto-complete (where there's no live request to trigger payout). Protected by
 * CRON_SECRET — Vercel Cron sends it automatically as a Bearer token. Jobs the
 * customer confirmed are already released instantly, so this is a backstop.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!stripeConfigured) {
    return NextResponse.json({ skipped: "stripe not configured" });
  }

  const released = await sweepDuePayouts();
  return NextResponse.json({ released });
}
