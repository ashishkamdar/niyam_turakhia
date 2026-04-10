/**
 * In-memory buffer for WhatsApp image attachments that arrived WITHOUT
 * a matching deal context — i.e. staff sent a screenshot on its own,
 * without a caption containing a #NT deal code and without being a
 * reply to an earlier deal message.
 *
 * These "orphans" sit in this buffer waiting for a later text message
 * that references them (via WhatsApp's native reply/context feature).
 * When the matching reply arrives, we attach the orphan's OCR data to
 * the new pending_deals row and drop the orphan from the buffer.
 *
 * Design notes:
 *  - NOT persisted to the database. If the server restarts, any unclaimed
 *    orphans are lost — staff would need to resend. This keeps the DB
 *    clean and avoids having to manage stale state across deploys.
 *  - TTL of 1 hour: if an orphan isn't claimed within that window, it's
 *    silently evicted. A payment screenshot that stays unclaimed for
 *    more than an hour is probably abandoned anyway.
 *  - Ring buffer capped at 50 entries as a safety rail against a runaway
 *    screenshot flood eating server memory.
 *  - Module-scoped state, which works because PM2 runs nt-metals as a
 *    single fork-mode instance. Multi-process would need Redis or similar.
 */

import type { OcrResult } from "./image-ocr";

export interface OrphanedAttachment {
  /** Meta's WhatsApp message ID (wamid.xxx...) — matches against context.id on replies */
  wa_message_id: string;
  sender_phone: string;
  sender_name: string;
  ocr: OcrResult;
  /** Relative URL under which the saved image file is served, e.g. "/api/screenshots/<uuid>.jpg".
      Null if the file failed to save (OCR still available). */
  screenshot_url: string | null;
  /** ISO timestamp of when the image was received */
  received_at: string;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_BUFFER = 50;

const buffer: OrphanedAttachment[] = [];

function pruneExpired(): void {
  const cutoff = Date.now() - TTL_MS;
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (new Date(buffer[i].received_at).getTime() < cutoff) {
      buffer.splice(i, 1);
    }
  }
}

export function pushOrphan(attachment: OrphanedAttachment): void {
  pruneExpired();
  // Prevent duplicate pushes if the same wamid hits twice (edge case)
  const idx = buffer.findIndex((a) => a.wa_message_id === attachment.wa_message_id);
  if (idx >= 0) {
    buffer.splice(idx, 1);
  }
  buffer.unshift(attachment);
  if (buffer.length > MAX_BUFFER) {
    buffer.length = MAX_BUFFER;
  }
}

export function findOrphanByWaMessageId(waMessageId: string): OrphanedAttachment | null {
  pruneExpired();
  return buffer.find((a) => a.wa_message_id === waMessageId) ?? null;
}

export function removeOrphanByWaMessageId(waMessageId: string): void {
  const idx = buffer.findIndex((a) => a.wa_message_id === waMessageId);
  if (idx >= 0) buffer.splice(idx, 1);
}

export function getOrphanCount(): number {
  pruneExpired();
  return buffer.length;
}
