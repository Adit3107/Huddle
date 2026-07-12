export const REALTIME_QUEUE_NAME = "realtime";

export type PersistMessageJob = {
  type: "persist-message";
  message: {
    roomId: string;
    senderId: string;
    senderName: string;
    text: string | null;
    fileUrl: string | null;
    fileType: string | null;
    fileName: string | null;
    createdAt: string;
  };
};

export type UpdatePeakUsersJob = {
  type: "update-peak-users";
  roomId: string;
  activeUsers: number;
};

export type RealtimeJob = PersistMessageJob | UpdatePeakUsersJob;
