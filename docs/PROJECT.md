# Jazz Corner

> Sổ tay dự án. Claude đọc file này ĐẦU mỗi phiên làm việc và cập nhật CUỐI mỗi nhiệm vụ,
> để lần sau (hoặc người khác) tiếp tục được ngay mà không phải hỏi lại.

## Mục đích
- Ai dùng: một người học (cá nhân), chạy local trên máy Windows.
- Giải quyết việc gì: tự học tiếng Anh C1–C2 qua sách/truyện tự tải lên, luyện IELTS Academic (mục tiêu band 8.0–9.0), luyện nói (phát âm, trọng âm, nhịp điệu, ngữ điệu, đọc to, shadowing).
- Ngôn ngữ: toàn bộ giao diện web bằng tiếng Anh (người dùng yêu cầu 2026-11-09); tài liệu dự án và comment code bằng tiếng Việt.

## Link
- Link chia sẻ / production: https://jazz-corner.thceramics.admirable.site (VPS CentOS 7, nginx + systemd, xem `scripts/deploy-server.sh`)
- Repo: https://github.com/Deocomate/jazz-corner
- Coolify (Docker): xem mục "Deploy bằng Docker / Coolify" bên dưới

## Tính năng
<!-- Cập nhật trạng thái: [x] xong · [ ] dự kiến -->
- [x] Khung ứng dụng, điều hướng 6 mục (desktop: thanh trên; mobile: thanh tab dưới), trang /status
- [x] Today: Word of the Day lấy từ sách đang đọc (quanh vị trí đọc) và bài đọc IELTS đã duyệt, kèm câu gốc + link mở đúng đoạn; chỉ chọn từ C2 trở lên trong từ điển dự án (~190 mục, ~145 mục C2+; các mục C1 như "deliberate", "much as", "mitigate" chỉ dùng để giải nghĩa), nút "↻ Another word" bỏ qua vĩnh viễn từ không hợp lý và chọn từ khác; từ có trong từ điển dự án có nghĩa/sắc thái/collocations, mọi từ còn có nghĩa Merriam-Webster hiện ngay trên trang (từ loại, phiên âm, nghĩa, ví dụ; cần MW_API_KEY), lưu vào Notebook kèm nghĩa; bộ từ chọn lọc chỉ là dự phòng; lưu theo ngày (bảng daily_words)
- [x] Books: tải PDF/EPUB (báo lỗi rõ), thư viện có bìa + tiến độ, trình đọc: mục lục, bookmark, highlight, ghi chú, sáng/tối, cỡ chữ EPUB, zoom PDF, tự lưu vị trí, báo trang PDF thiếu lớp văn bản
- [x] Bôi chọn trong sách → thanh nhỏ Highlight / Save / Speak (+ Translate khi chọn câu dài); từ/cụm ≤ 4 từ tự hiện bảng nghĩa (tiếng Việt + Merriam-Webster) cố định ở đáy màn hình (điện thoại) hoặc góc phải dưới (máy tính), không che chữ, đóng bằng ✕/Esc/chạm trang; Lưu vào Notebook điền sẵn nghĩa EN · VI (giữ trích đoạn, tên sách, vị trí; mở lại đúng chỗ và tô sáng)
- [x] Notebook như một cuốn sổ thật: mỗi ngày một trang có số trang, lật trang trước/sau (nút + phím ←/→), mục lục, ô ghi nhanh trên trang hôm nay, loại Ghi chép (Note) tự do; tìm kiếm cho danh sách kết quả kèm "Go to page"
- [x] Notebook: 4 loại mục ngôn ngữ + lỗi IELTS, tìm kiếm, lọc loại/nguồn/nhãn, thêm/sửa/xoá, hàng ôn theo ngày (Đã nhớ 1→3→7→15… ngày, Ôn lại = ngày mai)
- [x] IELTS Reading: kho đề, soạn đề thủ công, nhập JSON → bản nháp, duyệt (kiểm tra lỗi đề), gắn PDF nguồn; MCQ / TFNG / Matching Headings / Completion (giới hạn từ + biến thể); Luyện (kiểm tra từng câu) và Làm đề (hẹn giờ, giữ hạn nộp khi tải lại, tự nộp khi hết giờ); kết quả có bằng chứng + giải thích; lưu câu sai kèm lý do; bôi chọn → Luyện nói (Luyện/kết quả)
- [x] Speaking: bài mẫu từ/câu/đoạn có audio tổng hợp + mốc thời gian; tự nhập; từ Notebook / Books / IELTS (chỉnh được, giữ bản gốc); Pronunciation (IPA chỉ khi có dữ liệu đáng tin cậy, đoán từ loại theo câu gốc), Rhythm and Intonation (cụm ý, nhấn, đọc nhẹ, nối âm, chỉnh tay), Read Aloud theo câu, Shadowing 3 bước; minimal pairs; ghi âm, nghe lại, so sánh với mẫu, ghi chú, cần ôn; xử lý micro bị chặn
- [x] Progress: sách đang đọc, mục đến hạn, lượt ôn, kết quả Reading, dạng câu hay sai, lý do sai lặp lại, buổi luyện Speaking, bản ghi cần ôn
- [ ] OCR cho PDF scan; Tra nhanh / Phân tích câu
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
| notebook_items | ghi chép tự do (note) + mục ngôn ngữ + lỗi IELTS, due_date NULL = không ôn, nguồn/vị trí, lịch ôn, dedupe_key chống trùng |
| ielts_tests / ielts_passages / ielts_groups / ielts_questions | đề tương tác (tách khỏi PDF nguồn; có cột audio/transcript/hình để dành cho Listening) |
| ielts_attempts | lượt làm bài: câu trả lời, đánh dấu, hạn nộp, ảnh chụp kết quả lúc nộp |
| speaking_items | bài luyện nói, nguồn, audio mẫu + mốc thời gian, chỉnh trọng âm |
| daily_words | Word of the Day đã chọn cho từng ngày (ổn định khi tải lại); data_json chứa cả kết quả tra Merriam-Webster (key `mw`) và nghĩa tiếng Việt (key `vi`) |
| skipped_words | từ người dùng bấm "Another word" bỏ qua — không chọn lại làm Word of the Day |
| speaking_recordings | bản ghi âm (tệp ở data/uploads/recordings), ghi chú, cần ôn |

## Deploy bằng Docker / Coolify
- Tệp: `Dockerfile` (2 giai đoạn, chạy bằng user `node`), `docker-compose.yml`, `.dockerignore`.
- Coolify: New Resource → Public/Private Repository → Build Pack **Docker Compose** → đường dẫn `/docker-compose.yml` → ô Domain của dịch vụ `app` nhập tên miền (cổng 3000).
- Cổng: compose chỉ dùng `expose: 3000`, không map `ports` ra máy chủ, nên không đụng cổng của dự án khác; Coolify (Traefik) nối domain vào container.
- Biến môi trường: `SESSION_SECRET` Coolify tự sinh (`SERVICE_PASSWORD_SESSION`); tuỳ chọn `MW_API_KEY`, `DEEPL_API_KEY`, `APP_NAME`, `APP_TIMEZONE`, `MAX_UPLOAD_MB`.
- Dữ liệu (SQLite + sách/PDF/ghi âm tải lên) nằm ở volume `jazz-corner-data` → `/app/data`; không xoá volume khi deploy lại. Sao lưu bằng cách copy volume này.
- Migration tự chạy khi app khởi động. Kiểm tra: `/healthz` trả `{"ok":true}`.

## Quyết định quan trọng
- Stack: Node.js 22 + Express 5 + Handlebars + Tailwind CSS 4 + SQLite (libsql) — theo skill vibe-coder (prompt gốc gợi ý Next.js; người dùng gọi skill nên giữ stack chuẩn của skill).
- pdf.js (`pdfjs-dist` 4.10, chép vào public/vendor) cho PDF: giữ bố cục + lớp văn bản để bôi chọn. Không dùng epub.js: EPUB được giải nén bằng zlib có sẵn (src/lib/zip.js), chương được làm sạch phía trình duyệt rồi mới hiển thị → kiểm soát highlight/cỡ chữ/vị trí và không chạy script trong sách.
- Tải tệp bằng thân request thô (`x-file-name`), không thêm multer.
- Audio mẫu Speaking (2026-11-09, người dùng thấy giọng chưa ổn): ưu tiên (1) file người đọc thật Merriam-Webster cho bài luyện từ khi accent Mỹ (chỉ mục có headword đúng bằng từ, nhớ trong RAM; lỗi phát thì chuyển sang giọng trình duyệt); (2) giọng trình duyệt tốt nhất — window.voices trong public/js/app.js xếp hạng Natural/Online/Google/Premium lên trước, ô chọn Voice nhớ lựa chọn theo accent (localStorage jc:voice:<lang>); văn bản dài đọc từng câu (tránh Chrome cắt giọng Google sau ~15s); (3) file Zira có mốc thời gian chỉ mặc định khi máy không có giọng tự nhiên. Luôn ghi rõ loại audio (người thật / tổng hợp).
- Kết quả IELTS lưu ảnh chụp lúc nộp để sửa đề sau không đổi kết quả cũ.
- Word of the Day: quét tối đa 3 sách mở gần nhất (vài trang/chương từ vị trí đang đọc) + bài đọc của tối đa 6 đề đã duyệt, chỉ một lần mỗi ngày; CHỈ chọn từ C2+ có trong từ điển dự án (bỏ các mục BASIC trong words.js); sách không có từ nào như vậy thì dùng bộ C2 dự phòng. Đã bỏ cách đoán "từ dài ≥ 9 chữ = khó" vì ra cả từ dễ (2026-11-12, người dùng thấy "much as" và từ dài vẫn dễ). Từ đã lưu cho hôm nay theo quy tắc cũ tự được chọn lại khi mở trang; không lặp từ trong 30 ngày và không chọn lại từ trong skipped_words (2026-11-12, người dùng thấy từ quá dễ).
- Từ điển ngoài: Merriam-Webster (người dùng chọn 2026-11-09, thay Cambridge). Dùng API chính thức Collegiate (dictionaryapi.com, khoá miễn phí trong `.env` → `MW_API_KEY`), không cào trang web. Tra một lần mỗi ngày, lưu trong daily_words; lỗi mạng/chưa có khoá thì không lưu để lần sau thử lại.
- Nghĩa tiếng Việt (2026-11-09, người dùng yêu cầu): Wiktionary tiếng Việt (vi.wiktionary.org, API MediaWiki, không cần khoá; mục từ tiếng Anh phần lớn từ Từ điển Anh–Việt FVDP, CC BY-SA) → thử dạng gốc (headword MW, bỏ đuôi -d/-ed/-ing/-s) → không có thì dịch máy (ghi rõ "machine translation"; cũng dùng cho nút Translate câu ≤ 500 ký tự): DeepL API Free nếu có DEEPL_API_KEY (2026-11-09, người dùng chọn vì MyMemory dịch cứng; 500.000 ký tự/tháng), lỗi/hết hạn mức/không có khoá thì MyMemory. Bảng nghĩa (2026-11-09): Merriam-Webster trước, nghĩa tiếng Việt sau và rút gọn (≤ 2 từ loại × 2 nghĩa, không ví dụ); nút loa phát file MW (media.merriam-webster.com, đã mở trong CSP media-src), mục nào không có file thì dùng giọng đọc trình duyệt. Code: src/modules/today/vietnamese.js, public/js/meaning.js. Tắt khi chạy test (VI_DICTIONARY=on để bật).
- `numericId` nhận tên tham số (đối số thứ 5 của Express) — bản gốc template luôn ghi đè `req.params.id`.

## Nhật ký thay đổi
- 2026-11-12 — Word of the Day khó hơn: thêm ~65 từ C2, loại mục cơ bản khỏi vòng chọn, chấm điểm từ lạ theo độ học thuật; nút "↻ Another word" đổi từ trong ngày và không chọn lại từ đã bỏ (migration 007 skipped_words) — người dùng yêu cầu.
- 2026-11-10 — Thêm Dockerfile + docker-compose cho Coolify (dùng `expose`, volume dữ liệu) — người dùng yêu cầu. Chưa build thử được vì Docker Desktop không chạy trên máy dev.
- 2026-11-12 — Word of the Day chỉ còn từ C2 trở lên: thêm ~75 từ/thành ngữ C2 (obfuscate, recalcitrant, ephemeral, a Pyrrhic victory…), chuyển các mục C1 (mitigate, scrutiny, albeit, much as…) sang nhóm chỉ giải nghĩa, bỏ chọn "từ dài bất kỳ" trong sách; từ cũ đã lưu hôm nay tự đổi — người dùng yêu cầu.
<!-- Mới nhất ở trên. Mỗi dòng: ngày — thay đổi — ai yêu cầu (nếu biết) -->
- 2026-11-09 — Rà soát trước khi bàn giao cho lập trình viên: thanh Highlight/Save/Speak né bảng nghĩa khi hai thứ chồng nhau (màn hình máy tính hẹp); tách dịch máy (DeepL/MyMemory) sang src/modules/today/translate.js; `npm run check` 0 lỗi 0 cảnh báo, 52 test đạt — người dùng yêu cầu.
- 2026-11-09 — Speaking: sắp xếp lại trang luyện theo vòng Nghe → Nói → So sánh — nội dung luyện lên đầu, các chế độ thành bước đánh số; thanh luyện Listen/Stop · Record · Compare (phát mẫu rồi lần thu mới nhất) · ⚙ (accent, giọng, tốc độ, loop) dính đáy trên điện thoại, thẻ dính cột phải trên máy tính; "Your latest take" ngay dưới nội dung, "Earlier takes" thu gọn + lọc theo chế độ; My notes thu gọn; nguồn/bản gốc/Notebook/xoá vào menu ⋯; Read Aloud chạm câu để chọn; phím C = so sánh — người dùng yêu cầu.
- 2026-11-09 — Speaking: giọng mẫu tốt hơn — bài luyện từ phát file người đọc thật Merriam-Webster (khung "Real speaker" theo từ loại); ô chọn Voice ưu tiên giọng neural (★), nhớ theo accent; đọc từng câu; dùng chung cho nút loa và minimal pairs — người dùng yêu cầu.
- 2026-11-09 — Sửa tràn ngang trên điện thoại (IELTS, Speaking, Notebook, Today): thẻ trong lưới được co (`.card` min-w-0); màn hình < 360px dùng cỡ chữ gốc 16px.
- 2026-11-09 — Điện thoại (< 640px): chữ to theo kiểu Merriam-Webster mobile (cỡ gốc 18px, nhãn ~12.5px, bảng nghĩa khi bôi chọn cũng to hơn), giảm padding thẻ để chữ rộng hơn; phiên âm không bị ngắt dòng — người dùng yêu cầu.
- 2026-11-09 — Mobile: thanh tab dưới chỉ còn icon (5 mục, nhãn vẫn có cho trình đọc màn hình); Progress chuyển lên thanh trên dạng icon; Feature status trên mobile thành icon ⓘ, logo nhỏ lại — người dùng yêu cầu.
- 2026-11-09 — Word of the Day: nghĩa tiếng Việt rút gọn (≤ 2 từ loại × 2 nghĩa, không ví dụ) và đặt sau Merriam-Webster; thêm nút loa phát âm cạnh mỗi mục MW (file MW, lỗi thì giọng trình duyệt) — người dùng yêu cầu.
- 2026-11-09 — Thêm nghĩa tiếng Việt (Word of the Day + bôi chọn trong sách) và nút Translate; làm lại thao tác bôi chọn trong sách: sửa lỗi bấm đúp chọn từ không hiện thanh, thanh nhỏ gọn đặt tránh thanh công cụ/menu cảm ứng, nghĩa chuyển sang bảng cố định — người dùng yêu cầu.
- 2026-11-09 — Đổi tên app thành Jazz Corner (tên hiển thị; thư mục/tên gói kỹ thuật vẫn là study-hub) — người dùng yêu cầu.
- 2026-11-09 — Word of the Day hiện nghĩa Merriam-Webster ngay trên trang (thay link Cambridge) — người dùng yêu cầu.
- 2026-11-09 — Giao diện chuyển hoàn toàn sang tiếng Anh; Notebook có trang đánh số + lật trang + mục lục; Word of the Day lấy từ sách và đề (pdf.js chạy cả phía server) — người dùng yêu cầu.
- 2026-11-09 — Notebook thành sổ tay theo ngày + ghi nhanh + loại Ghi chép (migration 005 dựng lại bảng để thêm loại) — người dùng yêu cầu.
- 2026-11-09 — Bản đầu: Today, Books, Notebook, IELTS Reading, Speaking, Progress, dữ liệu mẫu, 38 test.
- 2026-11-09 — Khởi tạo dự án.
