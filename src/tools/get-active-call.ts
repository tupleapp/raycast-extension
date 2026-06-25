import { getActiveCall, isNoActiveCall } from "../lib/tuple";

/** Report whether the user is currently on a Tuple call, with whom, their mute state, and whether they're transcribing it. */
export default async function () {
  // `tuple call current` returns the normalized roster (self already excluded)
  // and exits non-zero when there is no active call.
  try {
    const call = await getActiveCall();
    return {
      inCall: true,
      callId: call.call_id,
      muted: call.muted,
      // Transcription is per-participant; this is whether *you* are transcribing the call.
      transcribing: call.transcribing,
      participants: call.participants.map((p) => p.name || p.email),
    };
  } catch (error) {
    if (isNoActiveCall(error)) {
      return { inCall: false };
    }
    throw error;
  }
}
