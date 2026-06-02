import { RtcRole, RtcTokenBuilder } from "agora-token";
import {
  getAgoraAppCertificate,
  getAgoraAppId,
  getRtmSignalUid,
} from "@/lib/env";

const EXPIRATION_SECONDS = 3600;

export type NexoraSessionSignal = {
  object: "nexora.session";
  action: "end";
  reason?: string;
};

export async function publishRtmSessionEnd(options: {
  channel: string;
  reason?: string;
}): Promise<void> {
  const appId = getAgoraAppId();
  const certificate = getAgoraAppCertificate();
  const uid = getRtmSignalUid();
  const { channel, reason } = options;

  const expiration = Math.floor(Date.now() / 1000) + EXPIRATION_SECONDS;
  const token = RtcTokenBuilder.buildTokenWithRtm(
    appId,
    certificate,
    channel,
    uid,
    RtcRole.PUBLISHER,
    expiration,
    expiration,
  );

  const { default: AgoraRTM } = await import("agora-rtm");
  const rtm = new AgoraRTM.RTM(appId, uid);
  await rtm.login({ token });
  await rtm.subscribe(channel);

  const payload: NexoraSessionSignal = {
    object: "nexora.session",
    action: "end",
    ...(reason ? { reason } : {}),
  };

  await rtm.publish(channel, JSON.stringify(payload), {
    channelType: "MESSAGE",
  });

  try {
    await rtm.unsubscribe(channel);
    await rtm.logout();
  } catch {
    // Best-effort cleanup.
  }
}
