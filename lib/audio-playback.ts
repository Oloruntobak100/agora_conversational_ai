type RemoteUserWithAudio = {
  uid: string | number;
  audioTrack?: { play: () => void };
};

export async function resumeRtcAudioContext(): Promise<void> {
  try {
    const { default: AgoraRTC } = await import('agora-rtc-react');
    const resume = (
      AgoraRTC as { resumeAudioContext?: () => void | Promise<void> }
    ).resumeAudioContext;
    if (resume) {
      await Promise.resolve(resume());
    }
  } catch (err) {
    console.warn('resumeAudioContext failed:', err);
  }
}

/** Play the conversational agent's remote audio track (mobile autoplay unlock). */
export async function playAgentRemoteAudio(
  remoteUsers: RemoteUserWithAudio[],
  agentUid: string,
): Promise<boolean> {
  await resumeRtcAudioContext();

  let played = false;
  for (const user of remoteUsers) {
    if (user.uid.toString() !== agentUid) continue;
    const track = user.audioTrack;
    if (!track) continue;
    try {
      track.play();
      played = true;
    } catch (err) {
      console.warn('playAgentRemoteAudio failed:', err);
    }
  }
  return played;
}
