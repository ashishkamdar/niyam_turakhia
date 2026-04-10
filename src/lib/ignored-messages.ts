/**
 * In-memory ring buffer for WhatsApp messages that the bot received but
 * did NOT parse as deal codes. Shown in the "Ignored" tab on the /review
 * page as proof that the bot is listening to everything — not silently
 * dropping anything — while only acting on #NT trigger messages.
 *
 * Deliberately NOT persisted to the database:
 *  - Junk messages don't need to survive server restarts
 *  - Keeps the schema clean
 *  - Auto-evicts the oldest entry when the buffer fills up
 *
 * This module relies on Node.js process-scoped module state, which works
 * because PM2 runs a single instance of nt-metals in fork mode. If we
 * ever scale to multiple processes, this needs to move to Redis or similar.
 */

const MAX_BUFFER_SIZE = 100;

export interface IgnoredMessage {
  id: string;
  sender_name: string;
  sender_phone: string;
  raw_message: string;
  received_at: string;
}

// Module-level buffer. Newest entries at index 0 (unshift on push).
const buffer: IgnoredMessage[] = [];

export function pushIgnored(msg: IgnoredMessage): void {
  buffer.unshift(msg);
  if (buffer.length > MAX_BUFFER_SIZE) {
    buffer.length = MAX_BUFFER_SIZE;
  }
}

export function getIgnored(): IgnoredMessage[] {
  // Return a defensive copy so callers can't mutate our buffer
  return buffer.slice();
}

export function getIgnoredCount(): number {
  return buffer.length;
}

export function clearIgnored(): void {
  buffer.length = 0;
}
