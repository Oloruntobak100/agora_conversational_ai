import { NextRequest, NextResponse } from "next/server";
import { listToolBranchEvents } from "@/lib/session-tool-events";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get("channel")?.trim();
  if (!channel) {
    return NextResponse.json({ error: "channel is required" }, { status: 400 });
  }

  const sinceRaw = request.nextUrl.searchParams.get("since");
  const sinceMs = sinceRaw ? Number.parseInt(sinceRaw, 10) : 0;
  const since = Number.isFinite(sinceMs) && sinceMs >= 0 ? sinceMs : 0;

  const events = await listToolBranchEvents(channel, since);

  return NextResponse.json({ events });
}
