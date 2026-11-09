// Chép thư viện chạy trên trình duyệt (pdf.js) từ node_modules vào public/vendor.
// Chạy lại sau khi nâng cấp pdfjs-dist: npm run vendor
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('node_modules/pdfjs-dist');
const dest = path.resolve('public/vendor/pdfjs');
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const file of ['build/pdf.min.mjs', 'build/pdf.worker.min.mjs']) {
  fs.copyFileSync(path.join(src, file), path.join(dest, path.basename(file)));
}
for (const dir of ['cmaps', 'standard_fonts']) {
  fs.cpSync(path.join(src, dir), path.join(dest, dir), { recursive: true });
}
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(dest, 'LICENSE'));
console.info('[vendor] đã chép pdf.js vào public/vendor/pdfjs');
