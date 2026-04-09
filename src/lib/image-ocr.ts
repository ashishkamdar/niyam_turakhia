/**
 * Image OCR Module — Multiple Provider Support
 *
 * Providers (in order of quality):
 * 1. Google Cloud Vision — 1,000 images/month FREE, best quality
 * 2. Claude Vision — best AI understanding, ~$0.01-0.03/image
 * 3. GPT-4o-mini — cheapest AI, ~$0.003/image
 * 4. Tesseract.js — 100% free, runs locally, no API needed
 */

export type OcrProvider = "google" | "claude" | "openai" | "tesseract";

export interface OcrResult {
  provider: OcrProvider;
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

const AI_PROMPT = `Analyze this image from a precious metals trading WhatsApp chat. Extract financial details.

Return ONLY a JSON object with these fields (omit fields that don't apply):
{
  "type": "payment" | "barlist" | "receipt" | "unknown",
  "amount": number,
  "currency": "USDT" | "HKD" | "USD" | "AED",
  "sender_wallet": "wallet address if visible",
  "receiver_wallet": "wallet address if visible",
  "transaction_id": "tx hash if visible",
  "date": "date if visible",
  "status": "confirmed" | "pending" | "sent",
  "weight_grams": number,
  "bar_count": number,
  "raw_text": "all readable text from the image"
}

Return ONLY the JSON, no markdown, no explanation.`;

function parseAiResponse(text: string, provider: OcrProvider): OcrResult {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { ...parsed, provider };
    }
  } catch {}
  return { provider, type: "unknown", raw_text: text };
}

// ─── 1. Google Cloud Vision (FREE — 1,000/month) ───
async function ocrGoogle(imageBuffer: Buffer, apiKey: string): Promise<OcrResult> {
  const base64 = imageBuffer.toString("base64");

  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [
          { type: "TEXT_DETECTION" },
          { type: "DOCUMENT_TEXT_DETECTION" },
        ],
      }],
    }),
  });

  const data = await res.json();
  const rawText = data.responses?.[0]?.fullTextAnnotation?.text ?? data.responses?.[0]?.textAnnotations?.[0]?.description ?? "";

  return parseOcrText(rawText, "google");
}

// ─── 2. Claude Vision (~$0.01-0.03/image) ───
async function ocrClaude(imageBuffer: Buffer, mimeType: string, apiKey: string): Promise<OcrResult> {
  const base64 = imageBuffer.toString("base64");
  const mediaType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";

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
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: AI_PROMPT },
        ],
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";
  return parseAiResponse(text, "claude");
}

// ─── 3. GPT-4o-mini (~$0.003/image) ───
async function ocrOpenAI(imageBuffer: Buffer, mimeType: string, apiKey: string): Promise<OcrResult> {
  const base64 = imageBuffer.toString("base64");
  const mediaType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
          { type: "text", text: AI_PROMPT },
        ],
      }],
    }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "{}";
  return parseAiResponse(text, "openai");
}

// ─── 4. Built-in OCR (system binary — safe, no shell injection) ───
async function ocrTesseract(imageBuffer: Buffer): Promise<OcrResult> {
  // Uses execFileSync which is safe — no shell, no user input in arguments
  const { execFileSync } = await import("child_process");
  const fs = await import("fs");
  const os = await import("os");
  const path = await import("path");

  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const inputPath = path.join(tmpDir, `ocr_in_${ts}.jpg`);
  const outputBase = path.join(tmpDir, `ocr_out_${ts}`);

  try {
    fs.writeFileSync(inputPath, imageBuffer);
    // execFileSync is safe — arguments are an array, not a shell string
    execFileSync("tesseract", [inputPath, outputBase, "-l", "eng+chi_sim+chi_tra+ara"], {
      timeout: 30000,
      stdio: "pipe",
    });
    const text = fs.readFileSync(outputBase + ".txt", "utf8");
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputBase + ".txt"); } catch {}
    return parseOcrText(text, "tesseract");
  } catch {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputBase + ".txt"); } catch {}
    return {
      provider: "tesseract",
      type: "unknown",
      raw_text: "Could not extract text from this image. Try a clearer photo, or select Google Cloud Vision (free, 1000 images/month) for better accuracy.",
    };
  }
}

// ─── Parse raw OCR text into structured data ───
function parseOcrText(rawText: string, provider: OcrProvider): OcrResult {
  const text = rawText.trim();
  const result: OcrResult = { provider, type: "unknown", raw_text: text };

  // Detect USDT payment
  const usdtMatch = text.match(/[-+]?\s*([\d,]+(?:\.\d+)?)\s*USDT/i);
  if (usdtMatch) {
    result.type = "payment";
    result.amount = parseFloat(usdtMatch[1].replace(/,/g, ""));
    result.currency = "USDT";
  }

  // Detect HKD
  const hkdMatch = text.match(/(?:HK\$|HKD|港幣)\s*([\d,]+(?:\.\d+)?)/i);
  if (hkdMatch && !usdtMatch) {
    result.type = "payment";
    result.amount = parseFloat(hkdMatch[1].replace(/,/g, ""));
    result.currency = "HKD";
  }

  // Detect USD
  const usdMatch = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (usdMatch && !usdtMatch && !hkdMatch) {
    result.type = "payment";
    result.amount = parseFloat(usdMatch[1].replace(/,/g, ""));
    result.currency = "USD";
  }

  // Detect wallet addresses (TRC-20 start with T, 34 chars)
  const wallets = text.match(/T[A-Za-z0-9]{33}/g);
  if (wallets) {
    if (wallets.length >= 1) result.sender_wallet = wallets[0];
    if (wallets.length >= 2) result.receiver_wallet = wallets[1];
  }

  // Detect transaction hash
  const txMatch = text.match(/(?:交易哈希|Transaction ID|hash|哈希)[:\s]*([a-f0-9]{10,})/i);
  if (txMatch) result.transaction_id = txMatch[1];

  // Detect date
  const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/?\d{0,4})\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (dateMatch) result.date = dateMatch[0];

  // Detect status
  if (/confirm|確認中|confirmed|確認/i.test(text)) {
    result.status = /確認中|pending/i.test(text) ? "pending" : "confirmed";
  } else if (/sent|已發送|Sent/i.test(text)) {
    result.status = "sent";
  }

  // Detect weight (barlist/weighing)
  const weightMatch = text.match(/([\d,]+(?:\.\d+)?)\s*(?:grams?|g\b|公斤|kg|GRAMS)/i);
  if (weightMatch) {
    result.type = "barlist";
    const w = parseFloat(weightMatch[1].replace(/,/g, ""));
    result.weight_grams = /kg|公斤/.test(weightMatch[0]) ? w * 1000 : w;
  }

  // Detect bar count
  const barMatch = text.match(/(\d+)\s*(?:pcs?|bars?|条|個|Pcs)/i);
  if (barMatch) {
    result.bar_count = parseInt(barMatch[1]);
    if (result.type === "unknown") result.type = "barlist";
  }

  return result;
}

// ─── Main entry point — tries providers in order based on config ───
export async function analyzeImage(
  imageBuffer: Buffer,
  mimeType: string,
  config: {
    provider?: OcrProvider;
    google_api_key?: string;
    anthropic_api_key?: string;
    openai_api_key?: string;
  } = {}
): Promise<OcrResult> {
  const provider = config.provider ?? detectBestProvider(config);

  try {
    switch (provider) {
      case "google":
        if (config.google_api_key) return await ocrGoogle(imageBuffer, config.google_api_key);
        break;
      case "claude":
        if (config.anthropic_api_key) return await ocrClaude(imageBuffer, mimeType, config.anthropic_api_key);
        break;
      case "openai":
        if (config.openai_api_key) return await ocrOpenAI(imageBuffer, mimeType, config.openai_api_key);
        break;
      case "tesseract":
        return await ocrTesseract(imageBuffer);
    }
  } catch {
    // Fall through to tesseract
  }

  // Fallback: always try Tesseract (free, local)
  try {
    return await ocrTesseract(imageBuffer);
  } catch {
    return { provider: "tesseract", type: "unknown", raw_text: "OCR failed" };
  }
}

function detectBestProvider(config: {
  google_api_key?: string;
  anthropic_api_key?: string;
  openai_api_key?: string;
}): OcrProvider {
  if (config.google_api_key) return "google";
  if (config.anthropic_api_key) return "claude";
  if (config.openai_api_key) return "openai";
  return "tesseract"; // Always available, always free
}
