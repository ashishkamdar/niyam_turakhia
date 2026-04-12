import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import path from "path";
import fs from "fs";

/**
 * Backup & Restore API
 *
 * GET  /api/backup           — list existing backups with metadata
 * POST /api/backup           — create a new backup (optionally encrypted)
 * POST /api/backup?action=restore  — restore from uploaded backup
 *
 * Backups are stored in <appDir>/backups/ as:
 *   prismx-backup-YYYYMMDD-HHMMSS.json        (unencrypted)
 *   prismx-backup-YYYYMMDD-HHMMSS.json.enc    (encrypted with AES-256-GCM)
 *
 * The backup file is a JSON containing:
 *   { version, created_at, created_by, encrypted, db_size, screenshot_count,
 *     tables: { deals: [...rows], pending_deals: [...rows], ... } }
 *
 * Encrypted backups use AES-256-GCM with a key derived from the user's
 * passphrase via scrypt. The salt + IV + auth tag are prepended to the
 * ciphertext so the file is self-contained for decryption.
 *
 * Admin+ role required for both backup and restore.
 */

const BACKUP_DIR = path.join(process.cwd(), "backups");
const BACKUP_VERSION = 1;

// Tables to back up — ordered so restore can insert in FK-safe order
const BACKUP_TABLES = [
  "settings",
  "prices",
  "meta_config",
  "auth_pins",
  "auth_sessions",
  "schema_version",
  "deals",
  "payments",
  "deliveries",
  "settlements",
  "whatsapp_messages",
  "parsed_deals",
  "pending_deals",
  "stock_opening",
  "audit_log",
  "parties",
  "dispatch_log",
];

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function encrypt(data: string, passphrase: string): Buffer {
  const salt = randomBytes(32);
  const key = scryptSync(passphrase, salt, 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: salt(32) + iv(16) + authTag(16) + ciphertext
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

function decrypt(encBuffer: Buffer, passphrase: string): string {
  const salt = encBuffer.subarray(0, 32);
  const iv = encBuffer.subarray(32, 48);
  const authTag = encBuffer.subarray(48, 64);
  const ciphertext = encBuffer.subarray(64);
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * GET /api/backup — list existing backups
 */
export async function GET(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor || (actor.role !== "admin" && actor.role !== "super_admin")) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("prismx-backup-"))
    .sort()
    .reverse();

  const backups = files.map((filename) => {
    const filePath = path.join(BACKUP_DIR, filename);
    const stats = fs.statSync(filePath);
    const encrypted = filename.endsWith(".enc");
    return {
      filename,
      encrypted,
      size_bytes: stats.size,
      size_human: stats.size > 1024 * 1024
        ? `${(stats.size / 1024 / 1024).toFixed(1)} MB`
        : `${(stats.size / 1024).toFixed(0)} KB`,
      created_at: stats.mtime.toISOString(),
    };
  });

  return NextResponse.json({ backups, backup_dir: BACKUP_DIR });
}

/**
 * POST /api/backup
 *   body: { passphrase?: string }          — create backup (encrypt if passphrase provided)
 *   body: { action: "restore", passphrase?: string }  — restore (with file in multipart)
 *   body: { action: "download", filename: string }    — download a specific backup
 *   body: { action: "delete", filename: string }      — delete a backup
 */
export async function POST(req: NextRequest) {
  const actor = getCurrentUser(req);
  if (!actor || (actor.role !== "admin" && actor.role !== "super_admin")) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const db = getDb();
  const ct = req.headers.get("content-type") ?? "";

  // ── Restore from uploaded file ────────────────────────────────────
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const action = form.get("action") as string;
    const passphrase = form.get("passphrase") as string | null;

    if (action === "restore") {
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
      }

      let jsonStr: string;
      const fileBuffer = Buffer.from(await (file as Blob).arrayBuffer());
      const isEncrypted = (file as File).name?.endsWith(".enc") || false;

      if (isEncrypted) {
        if (!passphrase) {
          return NextResponse.json(
            { ok: false, error: "This backup is encrypted. Provide the passphrase used during backup." },
            { status: 400 }
          );
        }
        try {
          jsonStr = decrypt(fileBuffer, passphrase);
        } catch {
          return NextResponse.json(
            { ok: false, error: "Decryption failed — wrong passphrase or corrupted file." },
            { status: 400 }
          );
        }
      } else {
        jsonStr = fileBuffer.toString("utf8");
      }

      let backup: Record<string, unknown>;
      try {
        backup = JSON.parse(jsonStr);
      } catch {
        return NextResponse.json(
          { ok: false, error: "Invalid backup file — not valid JSON." },
          { status: 400 }
        );
      }

      if ((backup.version as number) !== BACKUP_VERSION) {
        return NextResponse.json(
          { ok: false, error: `Unsupported backup version: ${backup.version}. Expected: ${BACKUP_VERSION}` },
          { status: 400 }
        );
      }

      // Restore each table
      const tables = backup.tables as Record<string, Record<string, unknown>[]>;
      let restoredRows = 0;

      const txn = db.transaction(() => {
        for (const table of BACKUP_TABLES) {
          const rows = tables[table];
          if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

          // Clear the table first
          db.prepare(`DELETE FROM ${table}`).run();

          // Insert all rows
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => "?").join(",");
          const insert = db.prepare(
            `INSERT OR REPLACE INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`
          );
          for (const row of rows) {
            insert.run(...columns.map((c) => row[c] ?? null));
            restoredRows++;
          }
        }
      });
      txn();

      logAudit(db, {
        actor: { label: actor.label, pinId: actor.pin_id },
        action: "restore_backup",
        targetTable: "all",
        summary: `Restored backup (${restoredRows} rows across ${Object.keys(tables).length} tables, encrypted: ${isEncrypted})`,
        metadata: { created_at: backup.created_at, created_by: backup.created_by, restored_rows: restoredRows },
      });

      return NextResponse.json({
        ok: true,
        restored_rows: restoredRows,
        tables_restored: Object.keys(tables).length,
      });
    }
  }

  // ── JSON body actions ─────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action as string | undefined;

  // ── Download ──────────────────────────────────────────────────────
  if (action === "download") {
    const filename = body.filename as string;
    if (!filename || filename.includes("..") || filename.includes("/")) {
      return NextResponse.json({ ok: false, error: "Invalid filename" }, { status: 400 });
    }
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ ok: false, error: "Backup not found" }, { status: 404 });
    }
    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────
  if (action === "delete") {
    const filename = body.filename as string;
    if (!filename || filename.includes("..") || filename.includes("/")) {
      return NextResponse.json({ ok: false, error: "Invalid filename" }, { status: 400 });
    }
    const filePath = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return NextResponse.json({ ok: true });
  }

  // ── Create backup ─────────────────────────────────────────────────
  const passphrase = body.passphrase as string | undefined;
  ensureBackupDir();

  // Export all tables
  const tables: Record<string, unknown[]> = {};
  let totalRows = 0;
  for (const table of BACKUP_TABLES) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      tables[table] = rows;
      totalRows += rows.length;
    } catch {
      tables[table] = [];
    }
  }

  // Screenshot count
  const screenshotDir = path.join(process.cwd(), "screenshots");
  let screenshotCount = 0;
  try {
    screenshotCount = fs.readdirSync(screenshotDir).length;
  } catch { /* no screenshots dir */ }

  const backupData = {
    version: BACKUP_VERSION,
    app: "PrismX",
    created_at: new Date().toISOString(),
    created_by: actor.label,
    encrypted: !!passphrase,
    db_size_rows: totalRows,
    table_count: BACKUP_TABLES.length,
    screenshot_count: screenshotCount,
    screenshot_note: screenshotCount > 0
      ? "Screenshots are stored on the filesystem in screenshots/. This backup contains database tables only. Use scripts/backup.sh for a full backup including image files."
      : "No screenshots on this server.",
    tables,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  let filename: string;
  let fileBuffer: Buffer;

  if (passphrase) {
    filename = `prismx-backup-${timestamp}.json.enc`;
    fileBuffer = encrypt(jsonStr, passphrase);
  } else {
    filename = `prismx-backup-${timestamp}.json`;
    fileBuffer = Buffer.from(jsonStr, "utf8");
  }

  const filePath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filePath, fileBuffer);

  logAudit(db, {
    actor: { label: actor.label, pinId: actor.pin_id },
    action: "create_backup",
    targetTable: "all",
    summary: `Created ${passphrase ? "encrypted" : "unencrypted"} backup: ${filename} (${totalRows} rows, ${BACKUP_TABLES.length} tables)`,
    metadata: { filename, rows: totalRows, encrypted: !!passphrase },
  });

  return NextResponse.json({
    ok: true,
    filename,
    encrypted: !!passphrase,
    rows: totalRows,
    tables: BACKUP_TABLES.length,
    screenshot_count: screenshotCount,
    size_bytes: fileBuffer.length,
    size_human: fileBuffer.length > 1024 * 1024
      ? `${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB`
      : `${(fileBuffer.length / 1024).toFixed(0)} KB`,
  });
}
