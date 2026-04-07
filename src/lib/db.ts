import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      metal TEXT NOT NULL,
      purity TEXT NOT NULL,
      is_pure INTEGER NOT NULL DEFAULT 0,
      quantity_grams REAL NOT NULL,
      pure_equivalent_grams REAL NOT NULL,
      price_per_oz REAL NOT NULL,
      direction TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'locked',
      date TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      direction TEXT NOT NULL,
      mode TEXT NOT NULL,
      from_location TEXT NOT NULL DEFAULT '',
      to_location TEXT NOT NULL DEFAULT '',
      linked_deal_id TEXT,
      date TEXT NOT NULL,
      FOREIGN KEY (linked_deal_id) REFERENCES deals(id)
    );

    CREATE TABLE IF NOT EXISTS prices (
      metal TEXT PRIMARY KEY,
      price_usd REAL NOT NULL,
      prev_close REAL NOT NULL,
      change REAL NOT NULL DEFAULT 0,
      change_pct REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'demo',
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id TEXT PRIMARY KEY,
      contact_name TEXT NOT NULL,
      contact_location TEXT NOT NULL,
      direction TEXT NOT NULL,
      message TEXT NOT NULL,
      is_lock INTEGER NOT NULL DEFAULT 0,
      linked_deal_id TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // Add contact_name to deals if not exists
  const cols = db.prepare("PRAGMA table_info(deals)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "contact_name")) {
    db.prepare("ALTER TABLE deals ADD COLUMN contact_name TEXT DEFAULT ''").run();
  }
}
