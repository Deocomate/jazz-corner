// Ghi âm bằng MediaRecorder. Xử lý rõ ràng các trường hợp micro bị từ chối hoặc không có.

export function micErrorMessage(err) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    return 'Trình duyệt này không hỗ trợ ghi âm. Hãy dùng Chrome, Edge hoặc Firefox bản mới (truy cập qua http://localhost).';
  }
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'Trình duyệt đang chặn micro. Bấm biểu tượng ổ khoá/micro ở thanh địa chỉ → cho phép Micro → tải lại trang. Trên Windows, kiểm tra thêm Settings › Privacy › Microphone. Bạn vẫn nghe mẫu được bình thường.';
  }
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
    return 'Không tìm thấy micro. Hãy cắm tai nghe/micro rồi thử lại. Bạn vẫn nghe mẫu được bình thường.';
  }
  if (err?.name === 'NotReadableError') return 'Micro đang được ứng dụng khác dùng. Đóng ứng dụng đó rồi thử lại.';
  return `Không bật được micro: ${err?.message || err}`;
}

const MIME_CHOICES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

export function createRecorder({ onTick }) {
  let media = null;
  let stream = null;
  let chunks = [];
  let startedAt = 0;
  let timer = null;

  return {
    get active() {
      return Boolean(media && media.state === 'recording');
    },
    async start() {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' });
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mimeType = MIME_CHOICES.find((m) => MediaRecorder.isTypeSupported?.(m));
      media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks = [];
      media.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      media.start();
      startedAt = Date.now();
      timer = setInterval(() => onTick(Date.now() - startedAt), 250);
    },
    /** Dừng và trả về { blob, durationMs }. */
    stop() {
      return new Promise((resolve) => {
        if (!media) return resolve(null);
        media.onstop = () => {
          clearInterval(timer);
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: (media.mimeType || 'audio/webm').split(';')[0] });
          const durationMs = Date.now() - startedAt;
          media = null;
          resolve({ blob, durationMs });
        };
        media.stop();
      });
    },
  };
}
