import { showHUD } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { joinCall, listRooms } from "./lib/tuple";

export default async function JoinPersonalRoom() {
  try {
    // `tuple rooms list --personal` returns the user's personal room(s) — the common case is
    // exactly one. Take the first (the CLI already orders occupied, then favorited, then by name).
    const [room] = await listRooms("--personal");

    if (!room) {
      await showHUD("No personal room found");
      return;
    }

    await joinCall(room.slug);
    await showHUD("Joining your personal room");
  } catch (error) {
    await showFailureToast(error, { title: "Could Not Join Personal Room" });
  }
}
