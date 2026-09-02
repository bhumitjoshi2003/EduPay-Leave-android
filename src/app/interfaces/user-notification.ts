export interface UserNotification {
    id: number;
    userId: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
    readAt?: string | null;
    eventCode?: string | null;
    category?: string | null;
    priority?: string | null;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    actionRoute?: string | null;
    actionMetadata?: string | null;
    expiresAt?: string | null;
}
