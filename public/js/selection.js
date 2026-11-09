// Thanh thao tác nổi khi bôi chọn văn bản trong một vùng (sách, bài đọc IELTS).
//   attachSelectionBar(container, bar, { onAction(action, text, range), isEnabled() })

export function attachSelectionBar(container, bar, { onAction, isEnabled = () => true }) {
  let current = null;

  const hide = () => {
    bar.hidden = true;
    current = null;
  };

  const show = () => {
    const sel = window.getSelection();
    if (!isEnabled() || !sel || sel.isCollapsed || !sel.rangeCount) return hide();
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return hide();
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 1) return hide();
    current = { text, range: range.cloneRange() };
    const rect = range.getBoundingClientRect();
    bar.hidden = false;
    const top = window.scrollY + rect.top - bar.offsetHeight - 8;
    const left = window.scrollX + rect.left + rect.width / 2 - bar.offsetWidth / 2;
    bar.style.top = `${Math.max(window.scrollY + 8, top)}px`;
    bar.style.left = `${Math.min(Math.max(8, left), document.documentElement.clientWidth - bar.offsetWidth - 8)}px`;
  };

  // Chờ trình duyệt cập nhật vùng chọn rồi mới đo vị trí.
  const later = () => setTimeout(show, 10);
  container.addEventListener('mouseup', later);
  container.addEventListener('keyup', (e) => e.shiftKey && later());
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) setTimeout(() => !bar.contains(document.activeElement) && hide(), 150);
  });
  // Trên cảm ứng: hiện thanh khi người dùng nhấc tay sau khi chọn.
  container.addEventListener('touchend', () => setTimeout(show, 350));

  bar.addEventListener('mousedown', (e) => e.preventDefault()); // giữ vùng chọn khi bấm nút
  bar.addEventListener('click', (e) => {
    const button = e.target.closest('[data-sel-action]');
    if (!button || !current) return;
    const { text, range } = current;
    hide();
    window.getSelection()?.removeAllRanges();
    onAction(button.dataset.selAction, text, range);
  });
  window.addEventListener('scroll', () => !bar.hidden && show(), { passive: true });
  return { hide };
}
