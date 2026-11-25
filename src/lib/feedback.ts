import { jsonArgs, runTuple } from "./tuple";
import { TupleError, TupleErrorKind } from "./types";

const MAX_FEEDBACK_BYTES = 4000;

export function feedbackByteLength(message: string): number {
  return Buffer.byteLength(message.trim(), "utf8");
}

export function feedbackValidationError(message: string): string | undefined {
  if (!message.trim()) return "Enter some feedback before sending.";
  if (message.includes("\0")) return "Remove null characters before sending.";
  if (feedbackByteLength(message) > MAX_FEEDBACK_BYTES) return "Keep your feedback within 4,000 bytes.";
}

export async function sendFeedback(message: string): Promise<void> {
  const error = feedbackValidationError(message);
  if (error) throw new Error(error);
  try {
    const help = await runTuple(["feedback", "--help"]);
    if (!/\btuple feedback <message>/.test(help)) throw new Error("Unsupported feedback command");
  } catch (error) {
    if (error instanceof TupleError && error.kind === TupleErrorKind.NotInstalled) throw error;
    throw new TupleError(TupleErrorKind.CapabilityUnavailable, "Update Tuple to use feedback.");
  }
  await runTuple(jsonArgs("feedback", "--", message.trim()));
}

/** Never surface raw process errors: their command line can contain the user's private message. */
export function feedbackErrorMessage(error: unknown): string {
  if (error instanceof TupleError) {
    if (error.kind === TupleErrorKind.NotInstalled) {
      return "Install Tuple or set the Tuple CLI Path in this extension’s preferences. Your feedback is still here.";
    }
    if (error.kind === TupleErrorKind.CapabilityUnavailable || error.status === 404) {
      return "Update the Tuple app and selected CLI to 3.4.3 or later, then submit again. Your feedback is still here.";
    }
    if (error.status === 401 || error.cliKind === "unauthorized" || error.cliKind === "sign_in_pending") {
      return "Open Tuple, sign in, and allow CLI access if prompted. Then submit again. Your feedback is still here.";
    }
    if (error.cliKind === "feedback_unavailable") {
      return "Tuple cannot accept feedback right now. Your feedback is still here; try again later.";
    }
    if (error.kind === TupleErrorKind.DaemonDown) {
      return "Open Tuple, sign in, then submit again. Your feedback is still here.";
    }
  }
  return "Tuple did not confirm submission. Your feedback is still here. Check before resending to avoid duplicates.";
}
