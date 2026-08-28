import type { ChatMessageItemType, RoomMetaType, RoomType } from '@/domain/types';

export type ApiErrorResType = {
  error: string;
};

export type CreateRoomReqType = {
  title?: string;
  ownerKeyHash: string;
};

export type RoomDetailResType = {
  meta: RoomMetaType;
  room: RoomType;
  shared: boolean;
};

export type GetRoomResType = RoomDetailResType | ApiErrorResType;

export type SaveRoomReqType = {
  room: RoomType;
  title?: string;
  thumbnail?: string | null;
  ownerKeyHash: string;
};

export type SaveRoomResType = {
  meta: RoomMetaType;
};

export type ChatListResType = {
  messages: ChatMessageItemType[];
  enabled: boolean;
};

export type SendChatReqType = {
  body: string;
  authorName: string;
  visitorKey: string;
};

export type SendChatResType = {
  message: ChatMessageItemType;
};
