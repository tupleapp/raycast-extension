import { Action, ActionPanel, Form, Icon, showToast, Toast } from "@raycast/api";
import { useRef, useState } from "react";
import { feedbackByteLength, feedbackValidationError, sendFeedback, feedbackErrorMessage } from "./lib/feedback";

export default function SendFeedback() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const field = useRef<Form.TextArea>(null);

  async function submit(values: { message: string }) {
    if (inFlight.current) return false;
    const validationError = feedbackValidationError(values.message);
    setError(validationError);
    if (validationError) {
      field.current?.focus();
      return false;
    }

    inFlight.current = true;
    setSending(true);
    try {
      const toast = await showToast({ style: Toast.Style.Animated, title: "Submitting Feedback…" });
      try {
        await sendFeedback(values.message);
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = "Could Not Submit Feedback";
        toast.message = feedbackErrorMessage(error);
        return false;
      }
      setMessage((current) => (current === values.message ? "" : current));
      toast.style = Toast.Style.Success;
      toast.title = "Feedback Submitted";
      toast.message = "Thank you for helping improve Tuple.";
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <Form
      navigationTitle="Send Feedback to Tuple"
      isLoading={sending}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send Feedback to Tuple" icon={Icon.Message} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Have an idea or hit a rough edge? Send it to the Tuple team using your signed-in Tuple account. Nothing is sent until you submit." />
      <Form.TextArea
        id="message"
        title="Feedback"
        placeholder="What could we make better? For a bug, include what happened and what you expected."
        value={message}
        autoFocus
        ref={field}
        error={error}
        onChange={(value) => {
          setMessage(value);
          setError(value.trim() ? feedbackValidationError(value) : undefined);
        }}
        onBlur={(event) => setError(feedbackValidationError(event.target.value ?? ""))}
      />
      <Form.Description
        text={`${feedbackByteLength(message).toLocaleString()} / 4,000 bytes · Emoji and other non-ASCII text use more than one byte.`}
      />
      <Form.Separator />
      <Form.Description
        title="Before You Send"
        text="Your message is sent through Tuple’s feedback analytics with your account and app details. Don’t include passwords or sensitive call content. This does not use Raycast AI. Requires Tuple 3.4.3 or later."
      />
    </Form>
  );
}
