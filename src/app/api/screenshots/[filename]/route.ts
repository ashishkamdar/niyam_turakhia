import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

/**
 * GET /api/screenshots/:filename
 *
 * Serves WhatsApp payment screenshots that the webhook saved to disk after
 * downloading them from Meta's Graph API. Files live in `<cwd>/screenshots/`
 * which is NOT in the git repo (see .gitignore) and is persistent across
 * deploys on the Nuremberg server.
 *
 * Security: the filename is strictly validated against a UUID + extension
 * pattern before the filesystem is touched. No path traversal possible.
 *
 * Caching: files are immutable once saved (filenames are UUIDs, never reused),
 * so we send aggressive Cache-Control so the browser only fetches each image
 * once per session.
 */

// UUID v4 format: 8-4-4-4-12 hex chars + one of a fixed set of image extensions
const FILENAME_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|jpeg|png|webp)$/i;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type Params = { params: Promise<{ filename: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { filename } = await params;

  if (!FILENAME_RE.test(filename)) {
    return new Response("Invalid filename", { status: 400 });
  }

  const filepath = path.join(process.cwd(), "screenshots", filename);

  try {
    const data = await fs.readFile(filepath);
    const ext = filename.toLowerCase().split(".").pop() ?? "jpg";
    const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch {
    return new Response("Screenshot not found", { status: 404 });
  }
}
