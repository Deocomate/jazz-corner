// Nghiệp vụ Speaking: tạo bài luyện từ nhiều nguồn, phân tích nhịp, bản ghi âm.
import { notFound } from '#lib/errors.js';
import { validate } from '#lib/validate.js';
import { analyzeRhythm, splitSentences, phraseTexts } from '#lib/rhythm.js';
import { saveFile, removeFile } from '#lib/storage.js';
import { config } from '#config';
import * as repo from './speaking.repo.js';
import * as notebook from '#modules/notebook/notebook.service.js';
import { itemSchema, markupSchema, recordingNoteSchema, guessKind, RECORDING_MODES, SOURCE_LABELS, modesFor, defaultMode } from './speaking.schema.js';
import { lookupPronunciation } from './pronunciation-data.js';
import { SAMPLE_ITEMS, SAMPLE_VOICE } from './sample-items.js';
import sampleAudio from './sample-audio.json' with { type: 'json' };

const parseJson = (s, fallback) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};

export function decorate(item) {
  if (!item) return item;
  const segments = parseJson(item.segments_json, null);
  const markup = parseJson(item.markup_json, { stress: {} });
  return {
    ...item,
    segments,
    markup,
    sourceLabel: SOURCE_LABELS[item.source_type],
    modes: modesFor(item.kind),
    defaultMode: defaultMode(item.kind),
    hasEdits: Object.keys(markup.stress || {}).length > 0,
  };
}

export async function listItems() {
  const [samples, mine] = await Promise.all([repo.listItems({ origin: 'sample' }), repo.listItems()]);
  return { samples: samples.map(decorate), mine: mine.map(decorate) };
}

export async function getItem(id) {
  const item = await repo.findItem(id);
  if (!item) throw notFound('Không tìm thấy bài luyện.');
  return decorate(item);
}

/** Dữ liệu cho trang luyện: phân tích nhịp, câu, cụm, phát âm (nếu có dữ liệu đáng tin cậy). */
export function practiceData(item) {
  const givenPhrases = item.segments?.length > 1 ? item.segments.map((s) => s.text) : null;
  const rhythm = analyzeRhythm(item.text, { stressOverrides: item.markup.stress || {}, phrases: givenPhrases });
  let globalIndex = 0;
  for (const sentence of rhythm) for (const phrase of sentence.phrases) phrase.globalIndex = globalIndex++;
  const words = item.text.trim().split(/\s+/);
  const pronunciation = item.kind === 'word' ? words.map((w) => lookupPronunciation(w.replace(/[^a-zA-Z'-]/g, ''), item.original_text || '')).filter(Boolean) : [];
  return {
    rhythm,
    phrases: item.segments?.length ? item.segments : phraseTexts(rhythm).map((text) => ({ text })),
    sentences: splitSentences(item.text),
    pronunciation,
    missingPronunciation: item.kind === 'word' && pronunciation.length === 0,
  };
}

export async function createItem(input, { origin = 'mine' } = {}) {
  const result = validate(itemSchema, input);
  if (!result.ok) return result;
  const d = result.data;
  const id = await repo.createItem({
    ...d,
    kind: d.kind || guessKind(d.text),
    original_text: d.original_text && d.original_text !== d.text ? d.original_text : d.original_text ?? null,
    origin,
  });
  return { ok: true, data: { id } };
}

/** Mở thẳng một mục Notebook sang Speaking (tái dùng bài đã tạo nếu có). */
export async function fromNotebook(notebookId) {
  const entry = await notebook.getItem(notebookId);
  const existing = await repo.findByNotebookItem(entry.id);
  if (existing) return existing.id;
  return repo.createItem({
    kind: guessKind(entry.content),
    title: entry.content.slice(0, 120),
    text: entry.content,
    original_text: entry.excerpt || null,
    source_type: 'notebook',
    source_label: `Notebook · ${entry.content.slice(0, 80)}`,
    source_url: `/notebook/${entry.id}`,
    notebook_item_id: entry.id,
  });
}

export async function saveMarkup(id, input) {
  await getItem(id);
  const result = validate(markupSchema, input);
  if (!result.ok) return result;
  await repo.saveMarkup(id, { stress: result.data.stress });
  return { ok: true, data: null };
}

export async function saveNotes(id, notes) {
  await getItem(id);
  await repo.saveNotes(id, String(notes || '').trim().slice(0, 5000) || null);
}

export async function deleteItem(id) {
  await getItem(id);
  for (const r of await repo.listRecordings(id)) await removeFile('recordings', r.stored_name);
  await repo.deleteItem(id);
}

/** Lưu nội dung luyện vào Notebook để ôn lại (không tạo trùng). */
export async function saveToNotebook(id) {
  const item = await getItem(id);
  const kind = item.kind === 'word' ? 'word' : 'pattern';
  return notebook.createItem(
    { kind, content: item.text.slice(0, 500), excerpt: item.original_text || undefined, note: item.notes || undefined, tags: 'Speaking', source_type: 'speaking', source_label: `Speaking · ${item.title || item.text.slice(0, 60)}`, source_url: `/speaking/items/${item.id}` },
    { origin: item.origin === 'ai' ? 'ai' : 'mine', dedupeKey: `speaking:${item.id}` },
  );
}

// --- Bản ghi âm ---
const AUDIO_TYPES = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };

export async function saveRecording(itemId, buffer, { mime, mode, durationMs, target }) {
  await getItem(itemId);
  const baseMime = String(mime || '').split(';')[0].trim().toLowerCase();
  const ext = AUDIO_TYPES[baseMime];
  if (!buffer?.length || !ext) return { ok: false, errors: { _form: 'Bản ghi trống hoặc định dạng âm thanh không được hỗ trợ.' } };
  if (!RECORDING_MODES.includes(mode)) return { ok: false, errors: { _form: 'Chế độ luyện không hợp lệ.' } };
  const storedName = await saveFile('recordings', buffer, ext);
  const id = await repo.createRecording({
    item_id: itemId, mode, stored_name: storedName, mime: baseMime, size_bytes: buffer.length,
    duration_ms: Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : null,
    target_text: target ? String(target).slice(0, 1000) : null,
  });
  await repo.touchPracticed(itemId);
  return { ok: true, data: { id } };
}

export async function getRecording(id) {
  const r = await repo.findRecording(id);
  if (!r) throw notFound('Không tìm thấy bản ghi.');
  return r;
}

export const listRecordings = (itemId) => repo.listRecordings(itemId);

export async function updateRecording(id, input) {
  const rec = await getRecording(id);
  const result = validate(recordingNoteSchema, input);
  if (!result.ok) return result;
  await repo.updateRecording(id, result.data.note ?? null, result.data.needs_review);
  return { ok: true, data: rec };
}

export async function deleteRecording(id) {
  const rec = await getRecording(id);
  await repo.deleteRecording(id);
  await removeFile('recordings', rec.stored_name);
  return rec;
}

// --- Cho Progress ---
export const recentRecordings = (limit) => repo.recentRecordings(limit);
export const flaggedRecordings = () => repo.flaggedRecordings();
export async function sessionStats() {
  const rows = await repo.recordingTimes();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const days = new Set(rows.map((r) => day.format(new Date(`${r.created_at.replace(' ', 'T')}Z`))));
  return { days: days.size, total: rows.length };
}

/** Bài mẫu (từ, câu, đoạn) kèm audio tổng hợp có mốc thời gian. Không tạo trùng. */
export async function ensureSampleItems() {
  for (const s of SAMPLE_ITEMS) {
    const audio = sampleAudio[s.key];
    const data = {
      kind: s.kind, title: s.title, text: s.text, notes: s.notes, origin: 'sample', sample_key: s.key, source_type: 'sample',
      source_label: 'Bài mẫu', audio_url: audio ? `/samples/${s.key}.wav` : null, audio_kind: audio ? 'synthetic' : null,
      audio_voice: audio ? SAMPLE_VOICE : null, segments: audio?.segments ?? null,
    };
    const existing = await repo.findBySampleKey(s.key);
    if (!existing) await repo.createItem(data);
    else if (audio && !existing.audio_url) await repo.updateSampleAudio(existing.id, data);
  }
}
