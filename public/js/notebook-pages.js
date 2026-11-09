// Notebook: turn pages with ← / →, open the contents dialog.
const book = document.querySelector('[data-notebook]');
const contents = document.querySelector('[data-contents]');

document.querySelector('[data-open-contents]')?.addEventListener('click', () => contents.showModal());

document.addEventListener('keydown', (e) => {
  if (!book || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest('input, textarea, select, dialog, [contenteditable]')) return;
  const target = e.key === 'ArrowLeft' ? book.dataset.prev : e.key === 'ArrowRight' ? book.dataset.next : null;
  if (target) {
    book.classList.add(e.key === 'ArrowLeft' ? 'is-turning-back' : 'is-turning');
    window.location.href = target;
  }
});
