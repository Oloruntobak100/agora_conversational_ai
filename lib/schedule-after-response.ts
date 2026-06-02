import { after } from "next/server";

/** Run work after the response is sent (Next `after`), or immediately in tests. */
export function scheduleAfterResponse(
  task: () => void | Promise<void>,
): void {
  try {
    after(task);
  } catch {
    void task();
  }
}
