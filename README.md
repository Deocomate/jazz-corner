# Jazz Corner — tự học tiếng Anh C1–C2 & IELTS Academic

Website cá nhân, chạy local cho một người (giao diện tiếng Anh): đọc sách như Kindle, Notebook có lịch ôn, IELTS Reading tương tác, luyện nói (phát âm, nhịp điệu, đọc to, shadowing). Các luồng chính dùng được **không cần AI**.

Menu: **Today · Books · IELTS · Speaking · Notebook · Progress**. Trang `/status` liệt kê tính năng đã có và tính năng giai đoạn sau.

## Cài đặt & chạy

Cần Node.js 22 trở lên.

```bash
npm install
cp .env.example .env        # đổi SESSION_SECRET thành chuỗi ngẫu nhiên bất kỳ
npm run seed                # (tuỳ chọn) nạp sách mẫu PDF + EPUB, đề Reading mẫu, bài luyện nói mẫu
npm run dev                 # mở http://localhost:3000
```

- Dữ liệu nằm trong `data/`: `data/app.db` (SQLite) và `data/uploads/` (sách, PDF đề, bản ghi âm). Sao lưu = chép thư mục `data/`.
- Đề Reading mẫu và bài luyện nói mẫu được tự tạo khi khởi động; `npm run seed` thêm 2 sách mẫu. Chạy nhiều lần không tạo trùng. Mọi dữ liệu mẫu có nhãn **Dữ liệu mẫu**.
- Word of the Day được chọn mỗi ngày từ sách bạn đang đọc và các đề IELTS đã duyệt; khi chưa có sách/đề thì dùng bộ từ chọn lọc.
- Notebook là một cuốn sổ: mỗi ngày một trang, lật bằng nút hoặc phím ←/→, có mục lục.
- Ghi âm cần quyền micro: dùng Chrome/Edge/Firefox mở `http://localhost:3000` và bấm **Cho phép** khi được hỏi.

## Lệnh

| Lệnh | Việc |
|------|------|
| `npm run dev` | Chạy chế độ phát triển (tự tải lại khi sửa code) |
| `npm start` | Chạy bình thường |
| `npm run seed` | Nạp dữ liệu mẫu |
| `npm test` | Chạy toàn bộ test |
| `npm run check` | Tự kiểm tra: cú pháp, CSS, test, SQL an toàn, script inline, cấu trúc |
| `npm run vendor` | Chép lại pdf.js vào `public/vendor/` (sau khi nâng cấp `pdfjs-dist`) |
| `node scripts/make-sample-audio.mjs` | Tạo lại audio mẫu Speaking (Windows, giọng tổng hợp System.Speech) |

## Nhập đề IELTS

IELTS › **Soạn đề mới** (từng bài đọc, nhóm câu, câu hỏi) hoặc **Nhập đề (JSON)**. Đề luôn là bản nháp cho đến khi bạn bấm **Duyệt đề**. Định dạng JSON: xem `src/modules/ielts/sample-test.js`.

## Cấu trúc

```
src/modules/
  today/      Today (Word of the Day, Đọc tiếp, IELTS), Progress, /status
  books/      thư viện, trình đọc PDF (pdf.js) & EPUB (tự giải nén + làm sạch), bookmark, highlight
  notebook/   mục ngôn ngữ + lỗi IELTS, lọc, hàng ôn theo ngày
  ielts/      soạn/duyệt/nhập đề, làm bài (Luyện / Làm đề hẹn giờ), chấm, kết quả
  speaking/   bài luyện, phân tích nhịp, dữ liệu phát âm, bản ghi âm
src/lib/      zip.js + epub.js (đọc EPUB), rhythm.js (gợi ý nhịp), storage.js (tệp tải lên)
public/js/    reader/*, ielts-take.js, speaking.js, speaking/*, selection.js (thanh thao tác khi bôi chọn)
scripts/      seed.mjs, sample-files.mjs (tạo PDF/EPUB mẫu), make-sample-audio.*
```
