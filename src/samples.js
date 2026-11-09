// Nạp dữ liệu mẫu tối thiểu khi khởi động (idempotent: chạy nhiều lần không tạo trùng).
// Dữ liệu mẫu luôn được gắn nhãn "Dữ liệu mẫu" để phân biệt với dữ liệu của bạn.
import { ensureSampleTest } from '#modules/ielts/ielts.service.js';
// [vibe:sample-imports]

export async function ensureSamples() {
  await ensureSampleTest();
  // [vibe:sample-calls]
}
