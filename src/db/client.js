// Kết nối SQLite:
//  - file local (dev/VPS): dùng node:sqlite có sẵn trong Node, không cần thư viện native
//    (chạy được trên cả CentOS 7 / glibc cũ).
//  - Turso (host free, libsql://...): nạp @libsql/client khi cần, cùng API.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '#config';

const { url, authToken } = config.db;
const isLocalFile = url.startsWith('file:');

/** Bọc node:sqlite thành client có cùng giao diện với @libsql/client (execute, executeMultiple, batch). */
function createLocalClient(file) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const sqlite = new DatabaseSync(file);
  const bind = (args) => args.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));

  const execute = async (stmt) => {
    const { sql, args = [] } = typeof stmt === 'string' ? { sql: stmt } : stmt;
    const statement = sqlite.prepare(sql);
    if (statement.columns().length > 0) {
      return { rows: statement.all(...bind(args)), rowsAffected: 0, lastInsertRowid: null };
    }
    const result = statement.run(...bind(args));
    return { rows: [], rowsAffected: Number(result.changes), lastInsertRowid: result.lastInsertRowid };
  };

  return {
    execute,
    async executeMultiple(sql) {
      sqlite.exec(sql);
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of statements) results.push(await execute(stmt));
        sqlite.exec('COMMIT');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

async function createDb() {
  if (isLocalFile) return createLocalClient(url.slice('file:'.length));
  const { createClient } = await import('@libsql/client');
  return createClient({ url, authToken });
}

export const db = await createDb();

/** Áp dụng các thiết lập SQLite nên có. Gọi một lần lúc khởi động. */
export async function initDb() {
  if (isLocalFile) {
    // WAL cho phép nhiều người đọc trong lúc có người ghi.
    await db.execute('PRAGMA journal_mode = WAL');
    await db.execute('PRAGMA busy_timeout = 5000');
  }
  await db.execute('PRAGMA foreign_keys = ON');
}

const toPlain = (row) => Object.fromEntries(Object.entries(row));

/** Lấy nhiều dòng. Luôn dùng tham số `?`, không nối chuỗi SQL. */
export async function all(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows.map(toPlain);
}

/** Lấy một dòng hoặc null. */
export async function get(sql, args = []) {
  const rows = await all(sql, args);
  return rows[0] ?? null;
}

/** Chạy INSERT/UPDATE/DELETE. Trả về id vừa thêm và số dòng bị ảnh hưởng. */
export async function run(sql, args = []) {
  const result = await db.execute({ sql, args });
  return {
    id: result.lastInsertRowid == null ? null : Number(result.lastInsertRowid),
    changes: result.rowsAffected,
  };
}

/** Chạy nhiều câu lệnh trong một transaction (tất cả thành công hoặc không câu nào). */
export async function transaction(statements) {
  return db.batch(statements, 'write');
}

/** True khi chạy trên host free có ổ đĩa tạm (Render) mà vẫn dùng file SQLite → dữ liệu sẽ mất. */
export const usingEphemeralDb = () => config.onRender && isLocalFile;
