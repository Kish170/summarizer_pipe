import Database from "better-sqlite3";
import path from "path";
import os from "os";

const homeDir = os.homedir();

const dbPath = path.join(homeDir, ".screenpipe", "db.sqlite");

// Connect to the database
const db = new Database(dbPath, { verbose: console.log });

// Create the table if it doesn't exist
db.exec(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT NOT NULL
}`);


export default db;
