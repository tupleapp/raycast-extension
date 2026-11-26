import { Action, ActionPanel, Form, Icon, showToast, Toast } from "@raycast/api";
import { useRef, useState } from "react";
import { feedbackLengthWarning, feedbackValidationError, sendFeedback, feedbackErrorMessage } from "./lib/feedback";

export default function SendFeedback() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const field = useRef<Form.TextArea>(null);
  const lengthWarning = feedbackLengthWarning(message);

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
      navigationTitle="Send Feedback"
      isLoading={sending}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send Feedback" icon={Icon.Message} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="message"
        title="Feedback"
        placeholder="Share an idea or report a bug…"
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
      {lengthWarning && <Form.Description text={lengthWarning} />}
      <Form.Description text="Includes your Tuple account and app details." />
    </Form>
  );
}
