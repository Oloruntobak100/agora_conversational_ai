import { NextRequest, NextResponse } from "next/server";
import {
  buildEmailReadBackLine,
  isValidEmail,
} from "@/lib/email-utils";
import { debugLog } from "@/lib/debug-log";
import {
  clearSessionFields,
  confirmSessionEmail,
  sessionFieldsPublicView,
  setSessionEmail,
} from "@/lib/session-fields";

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get("channel")?.trim();
  if (!channel) {
    return NextResponse.json({ error: "channel is required" }, { status: 400 });
  }

  return NextResponse.json(await sessionFieldsPublicView(channel));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      channel?: string;
      email?: string;
      action?: "submit" | "confirm" | "reset";
    };

    const channel = body.channel?.trim();
    if (!channel) {
      return NextResponse.json({ error: "channel is required" }, { status: 400 });
    }

    const action = body.action ?? "submit";

    if (action === "reset") {
      await clearSessionFields(channel);
      return NextResponse.json({
        ok: true,
        ...(await sessionFieldsPublicView(channel)),
      });
    }

    if (action === "confirm") {
      const ok = await confirmSessionEmail(channel);
      if (!ok) {
        return NextResponse.json(
          { error: "No email to confirm. Submit an email first." },
          { status: 400 },
        );
      }
      const view = await sessionFieldsPublicView(channel);
      // #region agent log
      debugLog(
        "session-fields/route.ts:POST",
        "email confirm",
        {
          channelLen: channel.length,
          status: view.status,
          storage: view.storage,
        },
        "C",
      );
      // #endregion
      return NextResponse.json({
        ok: true,
        ...view,
        message: "Email confirmed. You can ask the assistant to send the email.",
      });
    }

    const email = body.email?.trim();
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 },
      );
    }

    await setSessionEmail(channel, email);
    const readBackLine = buildEmailReadBackLine(email);
    const view = await sessionFieldsPublicView(channel);
    // #region agent log
    debugLog(
      "session-fields/route.ts:POST",
      "email submit",
      {
        channelLen: channel.length,
        action,
        status: view.status,
        storage: view.storage,
      },
      "C",
    );
    // #endregion

    return NextResponse.json({
      ok: true,
      ...view,
      readBackLine,
      message:
        "Email saved. The assistant will read it back for confirmation.",
    });
  } catch (error) {
    console.error("[session-fields]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update session fields",
      },
      { status: 500 },
    );
  }
}
