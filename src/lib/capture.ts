import { CaptureRecord } from "./types";

export function formatCapture(records: CaptureRecord[]): string {
  const names = new Map<number, string>();
  for (const { data } of records) {
    if (data.user) names.set(data.user.id, data.user.full_name || data.user.email || `user:${data.user.id}`);
    for (const participant of data.participants ?? []) {
      names.set(participant.id, participant.full_name || participant.email || `user:${participant.id}`);
    }
  }
  return records
    .map((record) => {
      const instant = record.type === "transcription_finished" ? record.data.start || record.time : record.time;
      const date = new Date(instant);
      const clock = Number.isNaN(date.getTime()) ? instant : date.toLocaleTimeString("en-GB", { hour12: false });
      if (record.type === "transcription_finished" && typeof record.data.text === "string") {
        const speaker = names.get(record.data.user_id ?? 0) || `user:${record.data.user_id ?? "unknown"}`;
        return `[${clock}] ${speaker}: ${record.data.text}`;
      }
      return `[${clock}] ${record.type}: ${JSON.stringify(record.data)}`;
    })
    .join("\n");
}
