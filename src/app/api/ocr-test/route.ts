import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analyzeImage, type OcrProvider } from "@/lib/image-ocr";
import { getMetaConfig } from "@/lib/meta-whatsapp";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";

  // Get OCR config from DB
  const db = getDb();
  const config = getMetaConfig(db);
  const provider = (config.ocr_provider ?? "tesseract") as OcrProvider;

  const result = await analyzeImage(buffer, mimeType, {
    provider,
    google_api_key: config.google_api_key,
    anthropic_api_key: config.anthropic_api_key,
    openai_api_key: config.openai_api_key,
  });

  return NextResponse.json(result);
}
