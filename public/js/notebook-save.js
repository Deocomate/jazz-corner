// Mở hộp thoại "Lưu vào Notebook" (partial notebook/save-dialog) và gửi lên /api/notebook.
//   await openNotebookDialog({ content, excerpt, kind, source: { type, label, url, bookId, location } })

export function openNotebookDialog({ content = '', excerpt = '', kind = 'word', meaning = '', source = {} } = {}) {
  const dialog = document.querySelector('[data-notebook-dialog]');
  const form = dialog.querySelector('[data-notebook-form]');
  const error = dialog.querySelector('[data-nb-error]');
  form.reset();
  error.hidden = true;
  form.kind.value = kind;
  form.content.value = content.slice(0, 500);
  form.excerpt.value = excerpt;
  form.meaning.value = meaning;
  dialog.querySelector('[data-nb-source]').textContent = source.label ? `Source: ${source.label}` : '';

  return new Promise((resolve) => {
    const onSubmit = async (event) => {
      event.preventDefault();
      error.hidden = true;
      try {
        const item = await window.api('/api/notebook', {
          method: 'POST',
          body: {
            kind: form.kind.value,
            content: form.content.value,
            excerpt: form.excerpt.value,
            meaning: form.meaning.value,
            tags: form.tags.value,
            source_type: source.type || 'manual',
            source_label: source.label || '',
            source_url: source.url || '',
            book_id: source.bookId || undefined,
            location: source.location || undefined,
          },
        });
        cleanup();
        dialog.close();
        resolve(item);
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    };
    const onClose = () => {
      cleanup();
      resolve(null);
    };
    const cleanup = () => {
      form.removeEventListener('submit', onSubmit);
      dialog.removeEventListener('close', onClose);
    };
    form.addEventListener('submit', onSubmit);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
    form.content.focus();
  });
}
