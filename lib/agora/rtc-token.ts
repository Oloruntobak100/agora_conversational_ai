import { RtcRole, RtcTokenBuilder } from "agora-token";

import { RTC_TOKEN_TTL_SEC } from "@/lib/constants";

export function buildRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number
): string {
  const role = RtcRole.PUBLISHER;
  const expire = RTC_TOKEN_TTL_SEC;
  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    role,
    expire,
    expire
  );
}
