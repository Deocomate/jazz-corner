// Danh sách module (tính năng) của app. Thêm module mới: import router rồi thêm 1 dòng.
// Mỗi module nằm trong src/modules/<ten>/ với các file:
//   <ten>.routes.js     -> khai báo URL
//   <ten>.controller.js -> nhận request, gọi service, render view
//   <ten>.service.js    -> nghiệp vụ + kiểm tra dữ liệu
//   <ten>.repo.js       -> câu SQL (chỉ chỗ này được viết SQL)
//   <ten>.schema.js     -> schema zod cho form
//   <ten>.api.js        -> API JSON cho JS phía trình duyệt (nếu cần)
import todayRoutes from './today/today.routes.js';
import booksRoutes from './books/books.routes.js';
import booksApi from './books/books.api.js';
import notebookRoutes from './notebook/notebook.routes.js';
import notebookApi from './notebook/notebook.api.js';
import ieltsRoutes from './ielts/ielts.routes.js';
import ieltsApi from './ielts/ielts.api.js';
import speakingRoutes from './speaking/speaking.routes.js';
import speakingApi from './speaking/speaking.api.js';
import dictionaryApi from './today/dictionary.api.js';
// [vibe:module-imports]

export const modules = [
  { path: '/', router: todayRoutes },
  { path: '/books', router: booksRoutes },
  { path: '/api/books', router: booksApi },
  { path: '/notebook', router: notebookRoutes },
  { path: '/api/notebook', router: notebookApi },
  { path: '/ielts', router: ieltsRoutes },
  { path: '/api/ielts', router: ieltsApi },
  { path: '/speaking', router: speakingRoutes },
  { path: '/api/speaking', router: speakingApi },
  { path: '/api/dictionary', router: dictionaryApi },
  // [vibe:module-mounts]
];

export function registerModules(app) {
  for (const { path, router, middleware = [] } of modules) app.use(path, ...middleware, router);
}
