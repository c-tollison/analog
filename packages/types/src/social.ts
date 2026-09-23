import { z } from 'zod';

export enum Relationship {
    Self = 'self',
    None = 'none',
    Friends = 'friends',
    RequestSent = 'request_sent',
    RequestReceived = 'request_received',
}

export enum NotificationKind {
    FriendRequest = 'friend_request',
    CollectionInvite = 'collection_invite',
}

export const USER_SEARCH_MIN_LENGTH = 2;

export const UserIdSchema = z.object({ userId: z.uuid('Invalid id') });
