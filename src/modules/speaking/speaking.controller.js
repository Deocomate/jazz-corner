// Trang Speaking: chọn nội dung, luyện (phát âm, nhịp điệu, đọc to, shadowing), bản ghi âm.
import { notFound } from '#lib/errors.js';
import { filePath } from '#lib/storage.js';
import * as service from './speaking.service.js';
import { KIND_OPTIONS } from './speaking.schema.js';
import { MINIMAL_PAIRS } from './pronunciation-data.js';
import * as notebook from '#modules/notebook/notebook.service.js';

export async function index(req, res) {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const [items, nb] = await Promise.all([
    service.listItems(),
    notebook.listItems({ q, kind: 'language' }, { perPage: 12, offset: 0 }),
  ]);
  res.render('speaking/index', { title: 'Speaking', ...items, notebookItems: nb.items, q, kindOptions: KIND_OPTIONS });
}

const renderForm = (res, { values = {}, errors = {}, status = 200 }) =>
  res.status(status).render('speaking/form', { title: 'New speaking exercise', values, errors, kindOptions: KIND_OPTIONS, scripts: ['/js/speaking-new.js'] });

export const newForm = (req, res) => renderForm(res, { values: { text: String(req.query.text || '').slice(0, 3000) } });

export async function create(req, res) {
  const result = await service.createItem(req.body);
  if (!result.ok) return renderForm(res, { values: req.body, errors: result.errors, status: 422 });
  res.redirect(`/speaking/items/${result.data.id}`);
}

export async function fromNotebook(req, res) {
  const id = await service.fromNotebook(req.params.id);
  res.redirect(`/speaking/items/${id}`);
}

export async function practice(req, res) {
  const item = await service.getItem(req.params.id);
  const mode = item.modes.some((m) => m.value === req.query.mode) ? req.query.mode : item.defaultMode;
  const modeLabels = { pronunciation: 'Pronunciation', rhythm: 'Rhythm', read_aloud: 'Read Aloud', shadowing: 'Shadowing', minimal_pairs: 'Minimal pairs' };
  const recordings = (await service.listRecordings(item.id)).map((r) => ({ ...r, modeLabel: modeLabels[r.mode] }));
  const data = service.practiceData(item);
  const humanAudio = await service.humanAudio(item);
  const recordingModes = [...new Set(recordings.slice(1).map((r) => r.mode))].map((value) => ({ value, label: modeLabels[value] || value }));
  res.render('speaking/practice', {
    title: item.title || item.text.slice(0, 60),
    item,
    mode,
    recordings,
    recordingModes: recordingModes.length > 1 ? recordingModes : [],
    ...data,
    humanAudio,
    config: {
      id: item.id,
      kind: item.kind,
      mode,
      text: item.text,
      audioUrl: item.audio_url,
      audioVoice: item.audio_voice,
      humanAudio: humanAudio[0]?.url || null,
      segments: item.segments || null,
      phrases: data.phrases.map((p) => p.text),
      sentences: data.sentences,
    },
    scripts: ['/js/speaking.js'],
  });
}

export async function saveNotes(req, res) {
  await service.saveNotes(req.params.id, req.body.notes);
  req.flash('success', 'Notes saved.');
  res.redirect(`/speaking/items/${req.params.id}?mode=${encodeURIComponent(req.body.mode || '')}`);
}

export async function saveToNotebook(req, res) {
  const result = await service.saveToNotebook(req.params.id);
  req.flash('success', result.duplicate ? 'This is already in your Notebook.' : 'Saved to your Notebook for review.');
  res.redirect(`/speaking/items/${req.params.id}`);
}

export async function destroy(req, res) {
  await service.deleteItem(req.params.id);
  req.flash('success', 'The exercise and its recordings were deleted.');
  res.redirect('/speaking');
}

export const minimalPairs = (req, res) =>
  res.render('speaking/minimal-pairs', { title: 'Minimal pairs', pairs: MINIMAL_PAIRS, scripts: ['/js/minimal-pairs.js'] });

export async function audio(req, res) {
  const rec = await service.getRecording(req.params.id);
  const full = filePath('recordings', rec.stored_name);
  if (!full) throw notFound('The recording file is missing on this computer.');
  res.type(rec.mime).sendFile(full);
}

export async function updateRecording(req, res) {
  const result = await service.updateRecording(req.params.id, req.body);
  if (result.ok) req.flash('success', 'Recording note saved.');
  const rec = await service.getRecording(req.params.id);
  res.redirect(`/speaking/items/${rec.item_id}?mode=${rec.mode === 'minimal_pairs' ? '' : rec.mode}#rec-${rec.id}`);
}

export async function deleteRecording(req, res) {
  const rec = await service.deleteRecording(req.params.id);
  req.flash('success', 'Recording deleted.');
  res.redirect(`/speaking/items/${rec.item_id}?mode=${rec.mode}#recordings`);
}
