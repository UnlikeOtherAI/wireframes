import { findMembership } from "../repositories/project.js";
import { findChatSession } from "../repositories/chat.js";

export async function canSubscribeToChannel(
  userId: string,
  channel: string,
): Promise<boolean> {
  const parts = channel.split(".");
  if (parts.length !== 2) return false;

  const [prefix, id] = parts;

  if (prefix === "project") {
    const membership = await findMembership(userId, id);
    return membership !== null;
  }

  if (prefix === "chat") {
    const session = await findChatSession(id);
    if (!session) return false;
    return session.userId === userId;
  }

  return false;
}
