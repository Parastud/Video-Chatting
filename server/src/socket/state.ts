export const rooms = new Map<string, Set<string>>();
export const roomSessions = new Map<string, { Username: string; RoomId: string }>();
export const socketToUserId = new Map<string, string>();
export const roomCallStartedAt = new Map<string, number>();
