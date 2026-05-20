import { NextRequest, NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-token";
import { getAgoraAppCertificate, getAgoraAppId } from "@/lib/env";

const EXPIRATION_TIME_IN_SECONDS = 3600;

function generateChannelName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `nexora-${timestamp}-${random}`;
}

export async function GET(request: NextRequest) {
  try {
    const appId = getAgoraAppId();
    const appCertificate = getAgoraAppCertificate();

    const { searchParams } = new URL(request.url);
    const uidStr = searchParams.get("uid");
    const parsedUid = uidStr ? parseInt(uidStr, 10) : Number.NaN;
    const uid = Number.isNaN(parsedUid)
      ? Math.floor(Math.random() * 9_999_000) + 1000
      : parsedUid;
    const channelName = searchParams.get("channel") || generateChannelName();

    const expirationTime =
      Math.floor(Date.now() / 1000) + EXPIRATION_TIME_IN_SECONDS;

    const token = RtcTokenBuilder.buildTokenWithRtm(
      appId,
      appCertificate,
      channelName,
      uid.toString(),
      RtcRole.PUBLISHER,
      expirationTime,
      expirationTime
    );

    return NextResponse.json({
      token,
      uid: uid.toString(),
      channel: channelName,
    });
  } catch (error) {
    console.error("[generate-agora-token]", error);
    return NextResponse.json(
      {
        error: "Failed to generate Agora token",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
