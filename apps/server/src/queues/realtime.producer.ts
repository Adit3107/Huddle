import { realtimeQueue } from "./realtime.queue.js";
import type { PersistMessageJob } from "./realtime.types.js";

export async function enqueueMessagePersistence(
  message: PersistMessageJob["message"]
) {
  return realtimeQueue.add(
    "persist-message",
    {
      type: "persist-message",
      message
    },
    {}
  );
}

export async function enqueuePeakUsersUpdate(
  roomId: string,
  activeUsers: number
) {
  return realtimeQueue.add(
    "update-peak-users",
    {
      type: "update-peak-users",
      roomId,
      activeUsers
    },
    {
      jobId: `peak-${roomId}-${activeUsers}`
    }
  );
}
