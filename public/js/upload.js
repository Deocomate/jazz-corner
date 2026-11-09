// Tải tệp lên từ ô chọn tệp hoặc kéo-thả: <input type=file data-upload-input data-upload-url="/api/...">
// Thành công: chuyển tới URL server trả về. Lỗi: hiện thông báo trong [data-upload-error].
const input = document.querySelector('[data-upload-input]');
const zone = document.querySelector('[data-dropzone]');
const status = document.querySelector('[data-upload-status]');
const errorBox = document.querySelector('[data-upload-error]');

async function upload(file) {
  if (!file) return;
  errorBox.hidden = true;
  status.textContent = `Uploading “${file.name}”…`;
  try {
    const data = await window.uploadFile(input.dataset.uploadUrl, file, file.name);
    status.textContent = 'Uploaded. Opening…';
    window.location.href = data.url;
  } catch (err) {
    status.textContent = '';
    errorBox.textContent = err.message;
    errorBox.hidden = false;
  } finally {
    input.value = '';
  }
}

input?.addEventListener('change', () => upload(input.files[0]));
zone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  zone.classList.add('bg-brand-50');
});
zone?.addEventListener('dragleave', () => zone.classList.remove('bg-brand-50'));
zone?.addEventListener('drop', (e) => {
  e.preventDefault();
  zone.classList.remove('bg-brand-50');
  upload(e.dataTransfer.files[0]);
});
