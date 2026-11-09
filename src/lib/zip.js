// Đọc tệp ZIP (EPUB là một tệp ZIP) chỉ bằng thư viện có sẵn của Node.
// Hỗ trợ hai kiểu nén phổ biến: stored (0) và deflate (8).
import zlib from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export class ZipError extends Error {}

/** Trả về Map<tên tệp, { method, compressedSize, offset }>. Ném ZipError nếu không phải ZIP. */
export function readZipIndex(buffer) {
  const minEocd = Math.max(0, buffer.length - 65557);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= minEocd; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('Không phải tệp ZIP/EPUB hợp lệ.');

  const count = buffer.readUInt16LE(eocd + 10);
  let pos = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== CENTRAL_SIGNATURE) {
      throw new ZipError('Mục lục ZIP bị hỏng.');
    }
    const method = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const nameLength = buffer.readUInt16LE(pos + 28);
    const extraLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);
    const offset = buffer.readUInt32LE(pos + 42);
    const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLength);
    entries.set(name, { method, compressedSize, offset });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Giải nén một tệp trong ZIP. Trả về Buffer hoặc null nếu không có. */
export function extractEntry(buffer, entries, name) {
  const entry = entries.get(name);
  if (!entry) return null;
  const { offset, method, compressedSize } = entry;
  if (buffer.readUInt32LE(offset) !== LOCAL_SIGNATURE) throw new ZipError(`Tệp ${name} trong ZIP bị hỏng.`);
  const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
  const data = buffer.subarray(start, start + compressedSize);
  if (method === 0) return Buffer.from(data);
  if (method === 8) return zlib.inflateRawSync(data);
  throw new ZipError(`Kiểu nén ${method} chưa được hỗ trợ.`);
}
