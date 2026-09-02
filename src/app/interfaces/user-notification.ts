export interface UserNotification {
    /** Authoritative recipient inbox-row ID used by the mark-read endpoint. */
    inboxId?: number;
    /** @deprecated Compatibility alias for older API responses. */
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
