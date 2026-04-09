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
    runMigrations(_db);
  }
  return _db;
}

/**
 * Create tables if they don't exist.
 * This is the CURRENT full schema — new tables go here.
 * Existing tables are NOT modified by CREATE TABLE IF NOT EXISTS.
 */
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
      refining_cost_per_gram REAL NOT NULL DEFAULT 0,
      total_cost_usd REAL NOT NULL DEFAULT 0,
      direction TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'locked',
      date TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'manual',
      contact_name TEXT DEFAULT ''
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

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      linked_deal_id TEXT,
      buyer_type TEXT NOT NULL DEFAULT 'firm',
      buyer_name TEXT NOT NULL DEFAULT '',
      metal TEXT NOT NULL,
      weight_grams REAL NOT NULL,
      shipping_cost_usd REAL NOT NULL DEFAULT 0,
      destination TEXT NOT NULL DEFAULT 'hong_kong',
      status TEXT NOT NULL DEFAULT 'preparing',
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      linked_delivery_id TEXT,
      amount_received REAL NOT NULL DEFAULT 0,
      currency_received TEXT NOT NULL DEFAULT 'USD',
      payment_method TEXT NOT NULL DEFAULT '',
      amount_sent_to_dubai REAL NOT NULL DEFAULT 0,
      currency_sent TEXT NOT NULL DEFAULT 'AED',
      channel TEXT NOT NULL DEFAULT '',
      seller_paid TEXT NOT NULL DEFAULT '',
      seller_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS parsed_deals (
      id TEXT PRIMARY KEY,
      chat_source TEXT NOT NULL,
      date TEXT NOT NULL,
      metal TEXT NOT NULL,
      direction TEXT NOT NULL,
      quantity_grams REAL NOT NULL,
      price_per_oz REAL NOT NULL,
      premium_discount TEXT DEFAULT '',
      total_usdt REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'detected',
      participants TEXT DEFAULT '',
      raw_messages TEXT DEFAULT '',
      parsed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/**
 * Versioned migrations — each runs once and only once.
 * Add new migrations at the end. Never modify existing ones.
 * Each migration safely modifies existing tables without losing data.
 */
function runMigrations(db: Database.Database) {
  const currentVersion = (
    db.prepare("SELECT MAX(version) as v FROM schema_version").get() as { v: number | null }
  )?.v ?? 0;

  const migrations: { version: number; description: string; up: () => void }[] = [
    {
      version: 1,
      description: "Add contact_name to deals",
      up: () => {
        addColumnIfNotExists(db, "deals", "contact_name", "TEXT DEFAULT ''");
      },
    },
    {
      version: 2,
      description: "Add refining_cost_per_gram and total_cost_usd to deals",
      up: () => {
        addColumnIfNotExists(db, "deals", "refining_cost_per_gram", "REAL DEFAULT 0");
        addColumnIfNotExists(db, "deals", "total_cost_usd", "REAL DEFAULT 0");
      },
    },
    {
      version: 3,
      description: "Add deliveries and settlements tables",
      up: () => {
        // Tables are created by CREATE TABLE IF NOT EXISTS above.
        // This migration exists so existing DBs get the version bumped.
        // No ALTER needed — these are new tables.
      },
    },
    {
      version: 4,
      description: "Add parsed_deals table for WhatsApp chat bot",
      up: () => {
        // Table is created by CREATE TABLE IF NOT EXISTS above.
        // No ALTER needed — this is a new table.
      },
    },
    {
      version: 5,
      description: "Add meta_config table for WhatsApp Business API",
      up: () => {},
    },
  ];

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      migration.up();
      db.prepare("INSERT OR REPLACE INTO schema_version (version) VALUES (?)").run(migration.version);
    }
  }
}

/**
 * Safely add a column to an existing table — no-op if column already exists.
 */
function addColumnIfNotExists(db: Database.Database, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}
