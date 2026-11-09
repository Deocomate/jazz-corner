// Trang Notebook: danh sách + lọc, thêm/sửa/xoá, chi tiết, ôn tập.
import { buildPagination, parsePage } from '#lib/pagination.js';
import { localDateOf } from '#lib/dates.js';
import { KIND_OPTIONS, LANGUAGE_KINDS, SOURCE_OPTIONS, SUGGESTED_TAGS } from './notebook.schema.js';
import * as service from './notebook.service.js';

const FILTER_KINDS = [{ value: 'language', label: 'Tất cả trừ lỗi IELTS' }, ...KIND_OPTIONS];

/** Gom mục theo ngày ghi (giờ Việt Nam) để hiển thị như từng trang sổ tay. */
function groupByDay(items) {
  const days = [];
  for (const item of items) {
    const date = localDateOf(item.created_at);
    if (days.at(-1)?.date !== date) days.push({ date, items: [] });
    days.at(-1).items.push(item);
  }
  return days;
}

const renderForm = (res, { item = null, values = {}, errors = {}, status = 200 }) =>
  res.status(status).render('notebook/form', {
    title: item ? 'Sửa mục Notebook' : 'Thêm mục Notebook',
    item,
    values,
    errors,
    kindOptions: item?.kind === 'ielts_mistake' ? KIND_OPTIONS.filter((k) => k.value === 'ielts_mistake') : LANGUAGE_KINDS,
    suggestedTags: SUGGESTED_TAGS,
  });

export async function index(req, res) {
  const page = parsePage(req.query, 24);
  const filters = {
    q: String(req.query.q || '').trim().slice(0, 100),
    kind: String(req.query.kind || ''),
    source: String(req.query.source || ''),
    tag: String(req.query.tag || ''),
  };
  const [{ items, total }, dueCount, tags] = await Promise.all([
    service.listItems(filters, page),
    service.countDue(),
    service.listTags(),
  ]);
  res.render('notebook/index', {
    title: 'Notebook',
    items,
    days: groupByDay(items),
    quickKinds: LANGUAGE_KINDS,
    total,
    dueCount,
    filters,
    hasFilters: Object.values(filters).some(Boolean),
    kindOptions: FILTER_KINDS,
    sourceOptions: SOURCE_OPTIONS,
    tagOptions: tags.map((t) => ({ value: t, label: t })),
    pagination: buildPagination({ ...page, total, query: filters }),
  });
}

export async function quickCapture(req, res) {
  const result = await service.quickCapture(req.body);
  if (!result.ok) {
    req.flash('error', Object.values(result.errors)[0]);
    return res.redirect('/notebook');
  }
  req.flash('success', result.data.due_date ? 'Đã ghi vào sổ và thêm vào hàng ôn.' : 'Đã ghi vào sổ.');
  res.redirect(`/notebook#item-${result.data.id}`);
}

export async function toggleQueue(req, res) {
  const on = req.body.on === '1';
  await service.setInQueue(req.params.id, on);
  req.flash('success', on ? 'Đã đưa vào hàng ôn từ hôm nay.' : 'Đã bỏ khỏi hàng ôn.');
  res.redirect(`/notebook/${req.params.id}`);
}

export function newForm(req, res) {
  renderForm(res, { values: { kind: req.query.kind || 'note' } });
}

export async function create(req, res) {
  const result = await service.createItem({ ...req.body, source_type: 'manual' });
  if (!result.ok) return renderForm(res, { values: req.body, errors: result.errors, status: 422 });
  req.flash('success', result.data.due_date ? 'Đã ghi vào sổ. Mục này có trong hàng ôn hôm nay.' : 'Đã ghi vào sổ.');
  res.redirect(`/notebook/${result.data.id}`);
}

export async function show(req, res) {
  const item = await service.getItem(req.params.id);
  res.render('notebook/show', { title: item.content, item });
}

export async function editForm(req, res) {
  const item = await service.getItem(req.params.id);
  renderForm(res, { item, values: item });
}

export async function update(req, res) {
  const item = await service.getItem(req.params.id);
  const result = await service.updateItem(item.id, req.body);
  if (!result.ok) return renderForm(res, { item, values: { ...req.body, kind: item.kind }, errors: result.errors, status: 422 });
  req.flash('success', 'Đã lưu thay đổi.');
  res.redirect(`/notebook/${item.id}`);
}

export async function destroy(req, res) {
  await service.deleteItem(req.params.id);
  req.flash('success', 'Đã xoá mục khỏi Notebook.');
  res.redirect('/notebook');
}

export async function reviewPage(req, res) {
  const [queue, dueCount] = await Promise.all([service.dueItems(1), service.countDue()]);
  res.render('notebook/review', { title: 'Ôn tập', item: queue[0] || null, dueCount });
}

export async function review(req, res) {
  const result = await service.review(req.params.id, req.body);
  if (result.ok) {
    req.flash('success', result.data.intervalDays ? `Đã nhớ — gặp lại sau ${result.data.intervalDays} ngày.` : 'Sẽ ôn lại vào ngày mai.');
  }
  res.redirect('/notebook/review');
}
