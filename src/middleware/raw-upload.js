// Nhận tệp gửi thẳng trong thân request (fetch(url, { body: file })), không cần multipart.
// Tên tệp gốc gửi qua header `x-file-name` (đã encodeURIComponent).
import express from 'express';
import { config } from '#config';

export const rawUpload = express.raw({ type: () => true, limit: `${config.maxUploadMb}mb` });

export function uploadedFileName(req) {
  try {
    return decodeURIComponent(req.get('x-file-name') || '').slice(0, 255);
  } catch {
    return '';
  }
}
