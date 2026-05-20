import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  IRemoteAudioTrack,
} from "agora-rtc-sdk-ng";

/**
 * Subscribe and play remote audio (agent). Required for users already in the
 * channel when we join — user-published alone is not enough.
 */
export async function subscribeAndPlayRemoteAudio(
  client: IAgoraRTCClient,
  user: IAgoraRTCRemoteUser,
  expectedAgentUid?: number
): Promise<IRemoteAudioTrack | null> {
  if (
    expectedAgentUid != null &&
    Number(user.uid) !== Number(expectedAgentUid)
  ) {
    return null;
  }

  if (user.hasAudio && !user.audioTrack) {
    await client.subscribe(user, "audio");
  }

  const track = user.audioTrack;
  if (!track) {
    return null;
  }

  try {
    await track.play();
  } catch (err) {
    console.warn("Remote audio play failed, retrying once", err);
    await new Promise((r) => setTimeout(r, 300));
    await track.play();
  }

  return track;
}

export async function subscribeAllRemoteAudio(
  client: IAgoraRTCClient,
  expectedAgentUid?: number
): Promise<number> {
  let count = 0;
  for (const user of client.remoteUsers) {
    const track = await subscribeAndPlayRemoteAudio(
      client,
      user,
      expectedAgentUid
    );
    if (track) count += 1;
  }
  return count;
}
