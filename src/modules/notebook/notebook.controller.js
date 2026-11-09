// Notebook như một cuốn sổ: mỗi ngày một trang (lật trang, mục lục), tìm kiếm, thêm/sửa/xoá, ôn tập.
import { buildPagination, parsePage } from '#lib/pagination.js';
import { localDateOf } from '#lib/dates.js';
import { KIND_OPTIONS, LANGUAGE_KINDS, SOURCE_OPTIONS, SUGGESTED_TAGS } from './notebook.schema.js';
import * as service from './notebook.service.js';

const FILTER_KINDS = [{ value: 'language', label: 'Everything except IELTS mistakes' }, ...KIND_OPTIONS];

/** Gom kết quả tìm kiếm theo ngày để biết mỗi mục nằm ở trang nào. */
function groupByDay(items, pages) {
  const pageOf = new Map(pages.map((p) => [p.date, p.number]));
  const days = [];
  for (const item of items) {
    const date = localDateOf(item.created_at);
    if (days.at(-1)?.date !== date) days.push({ date, page: pageOf.get(date), items: [] });
    days.at(-1).items.push(item);
  }
  return days;
}

const renderForm = (res, { item = null, values = {}, errors = {}, status = 200 }) =>
  res.status(status).render('notebook/form', {
    title: item ? 'Edit note' : 'New note',
    item,
    values,
    errors,
    kindOptions: item?.kind === 'ielts_mistake' ? KIND_OPTIONS.filter((k) => k.value === 'ielts_mistake') : LANGUAGE_KINDS,
    suggestedTags: SUGGESTED_TAGS,
  });

export async function index(req, res) {
  const filters = {
    q: String(req.query.q || '').trim().slice(0, 100),
    kind: String(req.query.kind || ''),
    source: String(req.query.source || ''),
    tag: String(req.query.tag || ''),
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const [pages, dueCount, tags] = await Promise.all([service.notebookPages(), service.countDue(), service.listTags()]);
  const common = {
    title: 'Notebook',
    pages,
    dueCount,
    filters,
    hasFilters,
    kindOptions: FILTER_KINDS,
    sourceOptions: SOURCE_OPTIONS,
    tagOptions: tags.map((t) => ({ value: t, label: t })),
    quickKinds: LANGUAGE_KINDS,
  };

  // Tìm kiếm / lọc: danh sách kết quả trên mọi trang.
  if (hasFilters) {
    const paging = parsePage(req.query, 30);
    const { items, total } = await service.listItems(filters, paging);
    return res.render('notebook/search', {
      ...common,
      total,
      days: groupByDay(items, pages),
      pagination: buildPagination({ ...paging, total, query: filters }),
    });
  }

  // Đọc sổ: một trang = một ngày. Mặc định mở trang mới nhất (hôm nay).
  const requested = Number.parseInt(req.query.page, 10);
  const number = Number.isInteger(requested) ? Math.min(Math.max(1, requested), pages.length) : pages.length;
  const page = pages[number - 1];
  res.render('notebook/index', {
    ...common,
    page,
    items: await service.itemsOnDate(page.date),
    prev: number > 1 ? number - 1 : null,
    next: number < pages.length ? number + 1 : null,
    lastPage: pages.length,
    scripts: ['/js/notebook-pages.js'],
  });
}

export async function quickCapture(req, res) {
  const result = await service.quickCapture(req.body);
  if (!result.ok) {
    req.flash('error', Object.values(result.errors)[0]);
    return res.redirect('/notebook');
  }
  req.flash('success', result.data.due_date ? 'Written in your notebook and added to today’s review.' : 'Written in your notebook.');
  res.redirect(`/notebook#item-${result.data.id}`);
}

export async function toggleQueue(req, res) {
  const on = req.body.on === '1';
  await service.setInQueue(req.params.id, on);
  req.flash('success', on ? 'Added to your review queue from today.' : 'Removed from your review queue.');
  res.redirect(`/notebook/${req.params.id}`);
}

export function newForm(req, res) {
  renderForm(res, { values: { kind: req.query.kind || 'note' } });
}

export async function create(req, res) {
  const result = await service.createItem({ ...req.body, source_type: 'manual' });
  if (!result.ok) return renderForm(res, { values: req.body, errors: result.errors, status: 422 });
  req.flash('success', result.data.due_date ? 'Saved. It is in today’s review queue.' : 'Saved to your notebook.');
  res.redirect(`/notebook/${result.data.id}`);
}

export async function show(req, res) {
  const item = await service.getItem(req.params.id);
  const pages = await service.notebookPages();
  const page = pages.find((p) => p.date === localDateOf(item.created_at));
  res.render('notebook/show', { title: item.content, item, page });
}

export async function editForm(req, res) {
  const item = await service.getItem(req.params.id);
  renderForm(res, { item, values: item });
}

export async function update(req, res) {
  const item = await service.getItem(req.params.id);
  const result = await service.updateItem(item.id, req.body);
  if (!result.ok) return renderForm(res, { item, values: { ...req.body, kind: item.kind }, errors: result.errors, status: 422 });
  req.flash('success', 'Changes saved.');
  res.redirect(`/notebook/${item.id}`);
}

export async function destroy(req, res) {
  await service.deleteItem(req.params.id);
  req.flash('success', 'Deleted from your notebook.');
  res.redirect('/notebook');
}

export async function reviewPage(req, res) {
  const [queue, dueCount] = await Promise.all([service.dueItems(1), service.countDue()]);
  res.render('notebook/review', { title: 'Review', item: queue[0] || null, dueCount });
}

export async function review(req, res) {
  const result = await service.review(req.params.id, req.body);
  if (result.ok) {
    const days = result.data.intervalDays;
    req.flash('success', days ? `Remembered — see it again in ${days} day${days > 1 ? 's' : ''}.` : 'You will review it again tomorrow.');
  }
  res.redirect('/notebook/review');
}
