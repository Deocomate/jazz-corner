// SQL cho bài luyện nói và bản ghi âm.
import { all, get, run } from '#db';

export const listItems = ({ origin } = {}) =>
  origin === 'sample'
    ? all("SELECT * FROM speaking_items WHERE origin = 'sample' ORDER BY id")
    : all("SELECT * FROM speaking_items WHERE origin <> 'sample' ORDER BY COALESCE(last_practiced_at, created_at) DESC, id DESC LIMIT 30");

export const findItem = (id) => get('SELECT * FROM speaking_items WHERE id = ?', [id]);
export const findBySampleKey = (key) => get('SELECT * FROM speaking_items WHERE sample_key = ?', [key]);
export const findByNotebookItem = (notebookId) =>
  get('SELECT * FROM speaking_items WHERE notebook_item_id = ? ORDER BY id DESC LIMIT 1', [notebookId]);

export async function createItem(i) {
  const { id } = await run(
    `INSERT INTO speaking_items (kind, title, text, original_text, origin, sample_key, source_type, source_label, source_url,
       notebook_item_id, audio_url, audio_kind, audio_voice, segments_json, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      i.kind, i.title ?? null, i.text, i.original_text ?? null, i.origin ?? 'mine', i.sample_key ?? null, i.source_type ?? 'manual',
      i.source_label ?? null, i.source_url ?? null, i.notebook_item_id ?? null, i.audio_url ?? null, i.audio_kind ?? null,
      i.audio_voice ?? null, i.segments ? JSON.stringify(i.segments) : null, i.notes ?? null,
    ],
  );
  return id;
}

export const updateSampleAudio = (id, i) =>
  run('UPDATE speaking_items SET audio_url = ?, audio_kind = ?, audio_voice = ?, segments_json = ? WHERE id = ?', [
    i.audio_url, i.audio_kind, i.audio_voice, JSON.stringify(i.segments), id,
  ]);

export const saveMarkup = (id, markup) =>
  run(`UPDATE speaking_items SET markup_json = ?, updated_at = datetime('now') WHERE id = ?`, [JSON.stringify(markup), id]);

export const saveNotes = (id, notes) => run(`UPDATE speaking_items SET notes = ?, updated_at = datetime('now') WHERE id = ?`, [notes, id]);
export const touchPracticed = (id) => run(`UPDATE speaking_items SET last_practiced_at = datetime('now') WHERE id = ?`, [id]);
export const deleteItem = (id) => run('DELETE FROM speaking_items WHERE id = ?', [id]);

// --- Bản ghi ---
export const listRecordings = (itemId) => all('SELECT * FROM speaking_recordings WHERE item_id = ? ORDER BY id DESC', [itemId]);
export const findRecording = (id) => get('SELECT * FROM speaking_recordings WHERE id = ?', [id]);

export async function createRecording(r) {
  const { id } = await run(
    `INSERT INTO speaking_recordings (item_id, mode, stored_name, mime, size_bytes, duration_ms, target_text)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [r.item_id, r.mode, r.stored_name, r.mime, r.size_bytes, r.duration_ms ?? null, r.target_text ?? null],
  );
  return id;
}

export const updateRecording = (id, note, needsReview) =>
  run('UPDATE speaking_recordings SET note = ?, needs_review = ? WHERE id = ?', [note, needsReview ? 1 : 0, id]);
export const deleteRecording = (id) => run('DELETE FROM speaking_recordings WHERE id = ?', [id]);

// --- Thống kê cho Progress ---
export const recentRecordings = (limit = 10) =>
  all(
    `SELECT r.*, i.title AS item_title, i.text AS item_text, i.kind AS item_kind
     FROM speaking_recordings r JOIN speaking_items i ON i.id = r.item_id ORDER BY r.id DESC LIMIT ?`,
    [limit],
  );
export const flaggedRecordings = () =>
  all(
    `SELECT r.*, i.title AS item_title, i.text AS item_text FROM speaking_recordings r
     JOIN speaking_items i ON i.id = r.item_id WHERE r.needs_review = 1 ORDER BY r.id DESC LIMIT 20`,
  );
export const recordingTimes = () => all('SELECT created_at FROM speaking_recordings');
