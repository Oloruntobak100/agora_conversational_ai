export type MicrophonePermissionResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'unsupported' | 'denied' | 'error';
      message: string;
    };

/**
 * Request microphone access while the browser still treats the call as a user
 * gesture (e.g. right after "Start Conversation"). Mobile Chrome often skips
 * the permission prompt if getUserMedia runs only after async network work.
 */
export async function ensureMicrophoneAccess(): Promise<MicrophonePermissionResult> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return {
      ok: false,
      reason: 'unsupported',
      message:
        'This browser does not support microphone access. Try Chrome or Safari on your phone.',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return { ok: true };
  } catch (err) {
    const domErr = err as DOMException | undefined;
    const name = domErr?.name ?? '';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return {
        ok: false,
        reason: 'denied',
        message:
          'Microphone access is blocked. In Chrome: tap the lock icon in the address bar → Site settings → Microphone → Allow, then reload and tap Start Conversation again.',
      };
    }

    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return {
        ok: false,
        reason: 'error',
        message:
          'No microphone was found on this device. Connect or enable a mic and try again.',
      };
    }

    console.error('Microphone permission error:', err);
    return {
      ok: false,
      reason: 'error',
      message:
        'Could not access the microphone. Check site permissions and try again.',
    };
  }
}
