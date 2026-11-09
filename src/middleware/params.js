// Kiểm tra tham số URL dùng chung.
//   router.param('id', numericId);  -> req.params.id luôn là số nguyên dương, sai thì 404.
// Dùng được cho mọi tên tham số (id, groupId, questionId…): Express truyền tên ở đối số thứ 5.
import { notFound } from '#lib/errors.js';

export function numericId(req, res, next, value, name = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return next(notFound());
  req.params[name] = id;
  next();
}
