// Tra nghĩa từ Merriam-Webster Collegiate Dictionary API cho Word of the Day.
// Kết quả được lưu cùng từ của ngày (daily_words) nên mỗi từ chỉ tra một lần.
import { config } from '#config';

const TIMEOUT_MS = 5000;

export const mwPageUrl = (word) => `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`;

export const isConfigured = () => Boolean(config.merriamWebster.apiKey);

/** Bỏ mã định dạng của MW: {it}…{/it}, {bc}, {sx|word||}, {a_link|word}, {d_link|word|id}… */
export function cleanMarkup(text) {
  return String(text)
    .replace(/\{(?:sx|a_link|d_link|i_link|et_link|mat|dxt)\|([^|}]*)[^}]*\}/g, '$1')
    .replace(/\{bc\}/g, '')
    .replace(/\{ldquo\}/g, '“')
    .replace(/\{rdquo\}/g, '”')
    .replace(/\{\/?[a-z_]+[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lấy các câu ví dụ ("vis") trong phần def của một mục. */
function examplesOf(entry, limit = 2) {
  const out = [];
  const walk = (node) => {
    if (out.length >= limit || !node) return;
    if (Array.isArray(node)) {
      if (node[0] === 'vis' && Array.isArray(node[1])) {
        for (const v of node[1]) if (out.length < limit && v.t) out.push(cleanMarkup(v.t));
        return;
      }
      node.forEach(walk);
    } else if (typeof node === 'object') {
      Object.values(node).forEach(walk);
    }
  };
  walk(entry.def);
  return out;
}

export const AUDIO_ORIGIN = 'https://media.merriam-webster.com';

/** Tệp phát âm MW (giọng người thật, Anh-Mỹ). Quy tắc thư mục theo tài liệu API của MW. */
export function audioUrl(name) {
  if (!name || !/^[\w-]+$/.test(name)) return null;
  const dir = name.startsWith('bix') ? 'bix' : name.startsWith('gg') ? 'gg' : /^[a-z]/i.test(name) ? name[0].toLowerCase() : 'number';
  return `${AUDIO_ORIGIN}/audio/prons/en/us/mp3/${dir}/${name}.mp3`;
}

/**
 * Chuyển JSON của API thành dữ liệu hiển thị. Không thấy từ → API trả mảng chuỗi gợi ý → null.
 * Chỉ giữ mục khớp với từ (headword hoặc dạng từ trong meta.stems), tối đa 3 mục.
 */
export function parseEntries(json, word) {
  if (!Array.isArray(json) || !json.length || typeof json[0] !== 'object') return null;
  const key = word.toLowerCase();
  const matches = json.filter((e) => {
    const head = String(e.meta?.id || '').split(':')[0].toLowerCase();
    return e.shortdef?.length && (head === key || (e.meta?.stems || []).some((s) => s.toLowerCase() === key));
  });
  const entries = (matches.length ? matches : json.filter((e) => e.shortdef?.length)).slice(0, 3).map((e) => ({
    headword: String(e.hwi?.hw || e.meta.id.split(':')[0]).replace(/\*/g, '·'),
    pos: e.fl || null,
    pronunciation: e.hwi?.prs?.[0]?.mw || null,
    audio: audioUrl(e.hwi?.prs?.find((p) => p.sound?.audio)?.sound.audio),
    definitions: e.shortdef.map(cleanMarkup),
    examples: examplesOf(e),
  }));
  return entries.length ? { word: entries[0].headword.replace(/·/g, ''), entries, url: mwPageUrl(word) } : null;
}

/**
 * Tra một từ. Trả về { found: true, ... } / { found: false } (từ không có trong MW),
 * hoặc null khi chưa có khoá hay lỗi mạng (để lần tải trang sau thử lại).
 */
export async function lookup(word) {
  if (!isConfigured()) return null;
  const url = `${config.merriamWebster.baseUrl}/${encodeURIComponent(word.toLowerCase())}?key=${encodeURIComponent(config.merriamWebster.apiKey)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const json = await res.json(); // khoá sai → API trả chữ thường, không phải JSON → nhảy vào catch
    const parsed = parseEntries(json, word);
    return parsed ? { found: true, ...parsed } : { found: false, url: mwPageUrl(word) };
  } catch {
    return null;
  }
}
