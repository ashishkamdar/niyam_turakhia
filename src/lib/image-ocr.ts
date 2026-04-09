export interface OcrResult {
  type: "payment" | "barlist" | "receipt" | "unknown";
  amount?: number;
  currency?: string;
  sender_wallet?: string;
  receiver_wallet?: string;
  transaction_id?: string;
  date?: string;
  status?: string;
  weight_grams?: number;
  bar_count?: number;
  raw_text: string;
}

export async function analyzeImage(imageBuffer: Buffer, mimeType: string): Promise<OcrResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { type: "unknown", raw_text: "No ANTHROPIC_API_KEY configured" };
  }

  const base64 = imageBuffer.toString("base64");
  const mediaType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Analyze this image from a precious metals trading WhatsApp chat. Extract financial details.

Return ONLY a JSON object with these fields (omit fields that don't apply):
{
  "type": "payment" | "barlist" | "receipt" | "unknown",
  "amount": number (the main amount),
  "currency": "USDT" | "HKD" | "USD" | "AED",
  "sender_wallet": "wallet address if visible",
  "receiver_wallet": "wallet address if visible",
  "transaction_id": "tx hash if visible",
  "date": "date if visible",
  "status": "confirmed" | "pending" | "sent",
  "weight_grams": number (if this is a weighing/barlist photo),
  "bar_count": number (if bars are visible),
  "raw_text": "all readable text from the image"
}

Return ONLY the JSON, no markdown, no explanation.`,
            },
          ],
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "{}";

    // Try to parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as OcrResult;
    }
    return { type: "unknown", raw_text: text };
  } catch (err) {
    return { type: "unknown", raw_text: `OCR error: ${err}` };
  }
}
