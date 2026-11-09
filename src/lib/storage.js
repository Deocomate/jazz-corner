// Lưu tệp người dùng tải lên vào ổ đĩa (UPLOAD_DIR/<loại>/<tên ngẫu nhiên>).
// Tên tệp luôn do server tạo -> không có chuyện người dùng ghi đè hay đi ra ngoài thư mục.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '#config';

const KINDS = new Set(['books', 'covers', 'ielts', 'recordings']);
const SAFE_NAME = /^[a-f0-9]{32}\.[a-z0-9]{1,5}$/;

function dirFor(kind) {
  if (!KINDS.has(kind)) throw new Error(`Loại tệp không hợp lệ: ${kind}`);
  const dir = path.resolve(config.uploadDir, kind);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Ghi buffer ra tệp mới, trả về tên tệp đã lưu. */
export async function saveFile(kind, buffer, ext) {
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  await fs.promises.writeFile(path.join(dirFor(kind), name), buffer);
  return name;
}

/** Đường dẫn tuyệt đối của tệp đã lưu, hoặc null nếu tên không hợp lệ/không tồn tại. */
export function filePath(kind, name) {
  if (!name || !SAFE_NAME.test(name)) return null;
  const full = path.join(dirFor(kind), name);
  return fs.existsSync(full) ? full : null;
}

export async function readFile(kind, name) {
  const full = filePath(kind, name);
  return full ? fs.promises.readFile(full) : null;
}

export async function removeFile(kind, name) {
  const full = filePath(kind, name);
  if (full) await fs.promises.rm(full, { force: true });
}
