import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  IRemoteAudioTrack,
} from "agora-rtc-sdk-ng";

/**
 * Subscribe and play remote audio from the assistant (any remote user except local).
 */
export async function subscribeAndPlayRemoteAudio(
  client: IAgoraRTCClient,
  user: IAgoraRTCRemoteUser,
  localUid?: number
): Promise<IRemoteAudioTrack | null> {
  if (localUid != null && Number(user.uid) === Number(localUid)) {
    return null;
  }

  try {
    if (user.hasAudio && !user.audioTrack) {
      await client.subscribe(user, "audio");
    }
  } catch (err) {
    console.warn("Subscribe remote audio failed", user.uid, err);
    return null;
  }

  const track = user.audioTrack;
  if (!track) {
    return null;
  }

  try {
    await track.play();
  } catch (err) {
    console.warn("Remote audio play failed, retrying", err);
    await new Promise((r) => setTimeout(r, 400));
    try {
      await track.play();
    } catch (retryErr) {
      console.warn("Remote audio play retry failed", retryErr);
      return null;
    }
  }

  return track;
}

export async function subscribeAllRemoteAudio(
  client: IAgoraRTCClient,
  localUid?: number
): Promise<number> {
  let count = 0;
  for (const user of client.remoteUsers) {
    const track = await subscribeAndPlayRemoteAudio(client, user, localUid);
    if (track) count += 1;
  }
  return count;
}
