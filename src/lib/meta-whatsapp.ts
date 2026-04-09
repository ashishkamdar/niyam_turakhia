import crypto from "crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function downloadMedia(
  mediaId: string,
  accessToken: string
): Promise<Buffer> {
  // Step 1: Get media URL
  const urlRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const urlData = await urlRes.json();

  // Step 2: Download the media
  const mediaRes = await fetch(urlData.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  return buffer;
}

export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<void> {
  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}

export async function markAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<void> {
  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
}

// Helper to get config from DB
export function getMetaConfig(db: import("better-sqlite3").Database): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM meta_config").all() as { key: string; value: string }[];
  const config: Record<string, string> = {};
  for (const r of rows) config[r.key] = r.value;
  return config;
}

export function setMetaConfig(db: import("better-sqlite3").Database, key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO meta_config (key, value) VALUES (?, ?)").run(key, value);
}
