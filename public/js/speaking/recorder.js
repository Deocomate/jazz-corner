// Ghi âm bằng MediaRecorder. Xử lý rõ ràng các trường hợp micro bị từ chối hoặc không có.

export function micErrorMessage(err) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    return 'This browser cannot record audio. Use a recent Chrome, Edge or Firefox (opened at http://localhost).';
  }
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'The browser is blocking the microphone. Click the lock/microphone icon in the address bar → allow Microphone → reload the page. On Windows, also check Settings › Privacy › Microphone. You can still listen to the model audio.';
  }
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
    return 'No microphone found. Plug in a headset or microphone and try again. You can still listen to the model audio.';
  }
  if (err?.name === 'NotReadableError') return 'Another app is using the microphone. Close it and try again.';
  return `Could not start the microphone: ${err?.message || err}`;
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
