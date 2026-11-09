// Nhập đề từ dữ liệu có cấu trúc (JSON): dùng cho đề mẫu, và về sau cho trích xuất PDF / AI.
// Đề nhập vào luôn đi qua cùng kiểm tra như khi soạn tay, và mặc định là bản nháp.
import { validate } from '#lib/validate.js';
import * as repo from './ielts.repo.js';
import { testSchema } from './ielts.schema.js';
import { savePassage, saveGroup, saveQuestion } from './ielts.service.js';
import { SAMPLE_TEST, SAMPLE_TEST_KEY } from './sample-test.js';

export async function importTest(data, { origin = 'mine', status = 'draft', sampleKey = null } = {}) {
  const meta = validate(testSchema, { ...data, time_limit_minutes: data?.time_limit_minutes ?? 60 });
  if (!meta.ok) return meta;
  if (!Array.isArray(data.passages) || !Array.isArray(data.groups)) {
    return { ok: false, errors: { _form: 'The JSON needs "passages" and "groups" arrays.' } };
  }
  const testId = await repo.createTest({ ...meta.data, origin, status: 'draft', sample_key: sampleKey });
  const passageIds = [];
  for (const [i, p] of data.passages.entries()) {
    const r = await savePassage(testId, null, { title: p.title, body: p.body, position: i + 1 });
    if (!r.ok) return fail(testId, `Passage ${i + 1}: ${Object.values(r.errors)[0]}`);
    passageIds.push((await repo.listPassages(testId)).at(-1).id);
  }
  for (const [gi, g] of data.groups.entries()) {
    const r = await saveGroup(testId, null, {
      passage_id: passageIds[(g.passage || 1) - 1], position: gi + 1, type: g.type, instructions: g.instructions,
      options_text: (g.options || []).map((o) => `${o.key}. ${o.text}`).join('\n'), word_limit: g.word_limit,
    });
    if (!r.ok) return fail(testId, `Group ${gi + 1}: ${Object.values(r.errors)[0]}`);
    for (const q of g.questions || []) {
      const qr = await saveQuestion(testId, r.data.id, null, {
        ...q, options_text: (q.options || []).map((o) => `${o.key}. ${o.text}`).join('\n'), accepted_text: (q.accepted || []).join('\n'),
      });
      if (!qr.ok) return fail(testId, `Question ${q.number}: ${Object.values(qr.errors)[0]}`);
    }
  }
  if (status === 'published') await repo.setStatus(testId, 'published');
  return { ok: true, data: { id: testId } };
}
async function fail(testId, message) {
  await repo.deleteTest(testId);
  return { ok: false, errors: { _form: message } };
}

export function parseImportJson(text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (err) {
    return { ok: false, errors: { json: `Invalid JSON: ${err.message}` } };
  }
}

/** Đảm bảo có ít nhất một đề mẫu tự soạn (chạy khi khởi động, không tạo trùng). */
export async function ensureSampleTest() {
  const existing = await repo.findTestBySampleKey(SAMPLE_TEST_KEY);
  if (existing) {
    // Làm mới chữ của đề mẫu (VD: sau khi đổi ngôn ngữ) mà không đụng tới các lượt làm bài.
    await repo.updateTest(existing.id, { title: SAMPLE_TEST.title, description: SAMPLE_TEST.description, time_limit_minutes: SAMPLE_TEST.time_limit_minutes });
    for (const q of SAMPLE_TEST.groups.flatMap((g) => g.questions)) await repo.updateSampleQuestionText(existing.id, q.number, q);
    return;
  }
  await importTest(SAMPLE_TEST, { origin: 'sample', status: 'published', sampleKey: SAMPLE_TEST_KEY });
}
