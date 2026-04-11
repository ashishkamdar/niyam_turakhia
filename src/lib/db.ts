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

    CREATE TABLE IF NOT EXISTS pending_deals (
      id TEXT PRIMARY KEY,
      whatsapp_message_id TEXT NOT NULL,
      sender_phone TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      raw_message TEXT NOT NULL,
      received_at TEXT NOT NULL,

      deal_type TEXT,
      direction TEXT,
      qty_grams REAL,
      metal TEXT,
      purity TEXT,
      rate_usd_per_oz REAL,
      premium_type TEXT,
      premium_value REAL,
      party_alias TEXT,

      parse_errors TEXT,

      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at TEXT,
      reviewer_notes TEXT,

      screenshot_url TEXT,
      screenshot_ocr TEXT,

      -- Dispatch lifecycle (migration v9). When an approved deal is
      -- pushed out to OroSoft (Pakka) or SBS Excel (Kachha), these
      -- columns record when + where + any response string for the UI.
      dispatched_at TEXT,
      dispatched_to TEXT,
      dispatch_response TEXT,
      dispatch_batch_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pending_deals_status ON pending_deals(status);
    CREATE INDEX IF NOT EXISTS idx_pending_deals_received ON pending_deals(received_at);

    -- Named PINs for the maker-checker app. Multiple physical users can
    -- share a single PIN (e.g. "Staff" is used by 15+ people). Individual
    -- staff are distinguished by their session row (IP + user agent).
    CREATE TABLE IF NOT EXISTS auth_pins (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      pin TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Active and historical login sessions. Cookie value = sessions.id.
    -- last_seen is updated on every GET /api/auth heartbeat so the /users
    -- page can show who's online right now.
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      pin_id TEXT NOT NULL,
      ip TEXT NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      FOREIGN KEY (pin_id) REFERENCES auth_pins(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_last_seen ON auth_sessions(last_seen);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_pin_id ON auth_sessions(pin_id);
    CREATE INDEX IF NOT EXISTS idx_auth_pins_pin ON auth_pins(pin);
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
    {
      version: 6,
      description: "Add pending_deals table for maker-checker review pipeline",
      up: () => {
        // Table is created by CREATE TABLE IF NOT EXISTS above.
        // No ALTER needed — this is a new table.
      },
    },
    {
      version: 7,
      description: "Add auth_pins and auth_sessions + seed default PINs",
      up: () => {
        // Tables are created by CREATE TABLE IF NOT EXISTS above.
        // Seed the default PINs only if auth_pins is empty so we don't
        // clobber customized PINs on re-deploy.
        const count = (
          db.prepare("SELECT COUNT(*) as c FROM auth_pins").get() as { c: number }
        ).c;
        if (count === 0) {
          const now = new Date().toISOString();
          const insert = db.prepare(
            "INSERT INTO auth_pins (id, label, pin, role, created_at) VALUES (?, ?, ?, ?, ?)"
          );
          // Keep 639263 as Niyam's PIN so currently-logged-in users aren't
          // suddenly locked out when this migration runs. The other three
          // are placeholders Niyam can edit from the Users page.
          insert.run("pin_niyam", "Niyam", "639263", "admin", now);
          insert.run("pin_ashish", "Ashish", "520125", "admin", now);
          insert.run("pin_admin", "Admin", "999999", "admin", now);
          insert.run("pin_staff", "Staff", "111111", "staff", now);
        }
      },
    },
    {
      version: 8,
      description: "Add locked column to auth_pins for admin lock/unlock",
      up: () => {
        // On the server where v7 already ran, auth_pins exists without
        // the locked column. addColumnIfNotExists is a no-op if the
        // column happens to already exist (e.g. freshly created DB that
        // got the column via CREATE TABLE above).
        addColumnIfNotExists(db, "auth_pins", "locked", "INTEGER NOT NULL DEFAULT 0");
      },
    },
    {
      version: 9,
      description: "Add dispatch lifecycle columns to pending_deals",
      up: () => {
        addColumnIfNotExists(db, "pending_deals", "dispatched_at", "TEXT");
        addColumnIfNotExists(db, "pending_deals", "dispatched_to", "TEXT");
        addColumnIfNotExists(db, "pending_deals", "dispatch_response", "TEXT");
        addColumnIfNotExists(db, "pending_deals", "dispatch_batch_id", "TEXT");
      },
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
