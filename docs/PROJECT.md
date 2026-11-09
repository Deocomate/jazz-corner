# Study Hub

> Sổ tay dự án. Claude đọc file này ĐẦU mỗi phiên làm việc và cập nhật CUỐI mỗi nhiệm vụ,
> để lần sau (hoặc người khác) tiếp tục được ngay mà không phải hỏi lại.

## Mục đích
- Ai dùng: một người học (cá nhân), chạy local trên máy Windows.
- Giải quyết việc gì: tự học tiếng Anh C1–C2 qua sách/truyện tự tải lên, luyện IELTS Academic (mục tiêu band 8.0–9.0), luyện nói (phát âm, trọng âm, nhịp điệu, ngữ điệu, đọc to, shadowing).
- Ngôn ngữ: menu và tiêu đề trang bằng tiếng Anh; giao diện còn lại tiếng Việt; nội dung học giữ tiếng Anh.

## Link
- Link chia sẻ / production: (chưa deploy — chạy local `npm run dev`)
- Repo: (chưa có)

## Tính năng
<!-- Cập nhật trạng thái: [x] xong · [ ] dự kiến -->
- [x] Khung ứng dụng, điều hướng 6 mục (desktop: thanh trên; mobile: thanh tab dưới), trang /status
- [x] Today: Word of the Day (bộ 20 từ chọn lọc, ổn định theo ngày, lưu không trùng), Đọc tiếp, Tiếp tục làm bài / Xem lại lỗi
- [x] Books: tải PDF/EPUB (báo lỗi rõ), thư viện có bìa + tiến độ, trình đọc: mục lục, bookmark, highlight, ghi chú, sáng/tối, cỡ chữ EPUB, zoom PDF, tự lưu vị trí, báo trang PDF thiếu lớp văn bản
- [x] Bôi chọn trong sách → Highlight / Ghi chú / Lưu vào Notebook / Luyện nói (giữ trích đoạn, tên sách, vị trí; mở lại đúng chỗ và tô sáng)
- [x] Notebook: 4 loại mục ngôn ngữ + lỗi IELTS, tìm kiếm, lọc loại/nguồn/nhãn, thêm/sửa/xoá, hàng ôn theo ngày (Đã nhớ 1→3→7→15… ngày, Ôn lại = ngày mai)
- [x] IELTS Reading: kho đề, soạn đề thủ công, nhập JSON → bản nháp, duyệt (kiểm tra lỗi đề), gắn PDF nguồn; MCQ / TFNG / Matching Headings / Completion (giới hạn từ + biến thể); Luyện (kiểm tra từng câu) và Làm đề (hẹn giờ, giữ hạn nộp khi tải lại, tự nộp khi hết giờ); kết quả có bằng chứng + giải thích; lưu câu sai kèm lý do; bôi chọn → Luyện nói (Luyện/kết quả)
- [x] Speaking: bài mẫu từ/câu/đoạn có audio tổng hợp + mốc thời gian; tự nhập; từ Notebook / Books / IELTS (chỉnh được, giữ bản gốc); Pronunciation (IPA chỉ khi có dữ liệu đáng tin cậy, đoán từ loại theo câu gốc), Rhythm and Intonation (cụm ý, nhấn, đọc nhẹ, nối âm, chỉnh tay), Read Aloud theo câu, Shadowing 3 bước; minimal pairs; ghi âm, nghe lại, so sánh với mẫu, ghi chú, cần ôn; xử lý micro bị chặn
- [x] Progress: sách đang đọc, mục đến hạn, lượt ôn, kết quả Reading, dạng câu hay sai, lý do sai lặp lại, buổi luyện Speaking, bản ghi cần ôn
- [ ] OCR cho PDF scan; Tra nhanh / Phân tích câu
- [ ] Word of the Day lấy từ sách đang đọc
- [ ] Trích xuất đề từ PDF, tạo đề bằng AI (vào bản nháp)
- [ ] IELTS Listening, Writing, Speaking Part 1–3, thi thử tổng hợp, chấm band AI
- [ ] Speaking: tạo bài bằng AI, phân tích âm/chấm tự động, đồng bộ transcript theo từ, audio người đọc giọng Anh
- [ ] Notebook: bài tập điền cụm, phân biệt sắc thái, viết câu có phản hồi

## Dữ liệu (bảng chính)
| Bảng | Mô tả |
|------|-------|
| _migrations | (hệ thống) các migration đã chạy |
| books | sách tải lên (tệp ở data/uploads/books), vị trí đọc, tiến độ |
| bookmarks, highlights | đánh dấu trong sách (highlight không tự vào hàng ôn) |
| notebook_items | mục ngôn ngữ + lỗi IELTS, nguồn/vị trí, lịch ôn, dedupe_key chống trùng |
| ielts_tests / ielts_passages / ielts_groups / ielts_questions | đề tương tác (tách khỏi PDF nguồn; có cột audio/transcript/hình để dành cho Listening) |
| ielts_attempts | lượt làm bài: câu trả lời, đánh dấu, hạn nộp, ảnh chụp kết quả lúc nộp |
| speaking_items | bài luyện nói, nguồn, audio mẫu + mốc thời gian, chỉnh trọng âm |
| speaking_recordings | bản ghi âm (tệp ở data/uploads/recordings), ghi chú, cần ôn |

## Quyết định quan trọng
- Stack: Node.js 22 + Express 5 + Handlebars + Tailwind CSS 4 + SQLite (libsql) — theo skill vibe-coder (prompt gốc gợi ý Next.js; người dùng gọi skill nên giữ stack chuẩn của skill).
- pdf.js (`pdfjs-dist` 4.10, chép vào public/vendor) cho PDF: giữ bố cục + lớp văn bản để bôi chọn. Không dùng epub.js: EPUB được giải nén bằng zlib có sẵn (src/lib/zip.js), chương được làm sạch phía trình duyệt rồi mới hiển thị → kiểm soát highlight/cỡ chữ/vị trí và không chạy script trong sách.
- Tải tệp bằng thân request thô (`x-file-name`), không thêm multer.
- Audio mẫu: giọng tổng hợp Windows (Zira, en-US) có mốc thời gian theo từ → luôn ghi rõ "audio tổng hợp, không phải người đọc". Giọng Anh/nội dung tự nhập: Web Speech API của trình duyệt.
- Kết quả IELTS lưu ảnh chụp lúc nộp để sửa đề sau không đổi kết quả cũ.
- `numericId` nhận tên tham số (đối số thứ 5 của Express) — bản gốc template luôn ghi đè `req.params.id`.

## Nhật ký thay đổi
<!-- Mới nhất ở trên. Mỗi dòng: ngày — thay đổi — ai yêu cầu (nếu biết) -->
- 2026-11-09 — Bản đầu: Today, Books, Notebook, IELTS Reading, Speaking, Progress, dữ liệu mẫu, 38 test.
- 2026-11-09 — Khởi tạo dự án.
