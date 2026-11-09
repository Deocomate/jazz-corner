// Dịch máy Anh → Việt (câu/đoạn ngắn, và dự phòng khi Wiktionary không có mục từ).
// DeepL nếu có DEEPL_API_KEY (dịch tự nhiên hơn), không được thì MyMemory (không cần khoá).
import { config } from '#config';

const TIMEOUT_MS = 5000;
const HEADERS = { 'user-agent': 'JazzCorner/0.1 (personal study app)' };
export const MAX_TRANSLATE_CHARS = 500;

const isEnabled = () => config.vietnamese.enabled;

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const decodeEntities = (s) =>
  String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

// Khoá DeepL Free kết thúc bằng ":fx" → api-free.deepl.com; khoá Pro → api.deepl.com.
const deeplUrl = () => config.vietnamese.deeplUrl || (config.vietnamese.deeplKey.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate');

/** DeepL (dịch tự nhiên hơn). Trả về chuỗi, hoặc null khi không có khoá/lỗi/hết hạn mức. */
async function translateDeepL(q) {
  if (!config.vietnamese.deeplKey) return null;
  try {
    const res = await fetch(deeplUrl(), {
      method: 'POST',
      headers: { ...HEADERS, 'content-type': 'application/json', authorization: `DeepL-Auth-Key ${config.vietnamese.deeplKey}` },
      body: JSON.stringify({ text: [q], source_lang: 'EN', target_lang: 'VI' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null; // 403 khoá sai, 456 hết 500.000 ký tự/tháng → dùng MyMemory
    const json = await res.json();
    return String(json.translations?.[0]?.text || '').replace(/\s+/g, ' ').trim() || null;
  } catch {
    return null;
  }
}

/** MyMemory (miễn phí, không cần khoá; dịch khá cứng). */
async function translateMyMemory(q) {
  try {
    const json = await getJson(`${config.vietnamese.translateUrl}?${new URLSearchParams({ q, langpair: 'en|vi' })}`);
    if (Number(json.responseStatus) !== 200 || json.quotaFinished) return null;
    return decodeEntities(json.responseData?.translatedText || '')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return null;
  }
}

/** Dịch máy Anh → Việt: DeepL nếu có khoá, không được thì MyMemory. Trả về chuỗi, hoặc null khi không dịch được. */
export async function translate(text) {
  if (!isEnabled()) return null;
  const q = String(text).replace(/\s+/g, ' ').trim().slice(0, MAX_TRANSLATE_CHARS);
  if (!q) return null;
  const out = (await translateDeepL(q)) || (await translateMyMemory(q));
  return out && out.toLowerCase() !== q.toLowerCase() ? out : null;
}

