// Thanh thao tác nổi khi bôi chọn văn bản trong một vùng (sách, bài đọc IELTS).
//   attachSelectionBar(container, bar, { onAction(action, text, range), onShow?(text, range),
//                                        onHide?(), isEnabled?(), topInset?() })
// - Theo dõi vùng chọn qua `selectionchange` (chuột, bàn phím, kéo tay cầm trên cảm ứng), có độ trễ
//   ngắn để không nhảy theo từng ký tự; khi đang kéo chuột thì chờ nhả chuột.
// - Thanh nằm trên vùng chọn; không đủ chỗ (bị thanh công cụ dính trên che) hoặc trên màn hình
//   cảm ứng (menu chọn của hệ điều hành nằm phía trên) thì đặt xuống dưới.

const coarse = () => window.matchMedia?.('(pointer: coarse)').matches;

export function attachSelectionBar(container, bar, { onAction, onShow, onHide, isEnabled = () => true, topInset = () => 8 }) {
  let current = null;
  let mouseDown = false;
  let timer = null;

  const hide = () => {
    const wasShown = !bar.hidden;
    bar.hidden = true;
    current = null;
    if (wasShown) onHide?.();
  };

  const read = () => {
    const sel = window.getSelection();
    if (!isEnabled() || !sel || sel.isCollapsed || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return null;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    return text ? { text, range: range.cloneRange() } : null;
  };

  const update = () => {
    const found = read();
    if (!found) {
      // Đang bấm nút trên thanh → giữ nguyên.
      if (!bar.contains(document.activeElement)) hide();
      return;
    }
    const isNew = current?.text !== found.text;
    current = found;
    bar.hidden = false;
    place(found.range);
    // onShow có thể đổi nội dung thanh → đo lại vị trí khi xong.
    if (isNew && onShow) Promise.resolve(onShow(found.text, found.range)).then(() => current?.text === found.text && place(found.range)).catch(() => {});
  };

  const schedule = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(update, ms);
  };

  const place = (range) => {
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const h = bar.offsetHeight;
    const w = bar.offsetWidth;
    const touch = coarse();
    const above = rect.top - h - 10;
    let top = !touch && above >= topInset() ? above : rect.bottom + (touch ? 30 : 10);
    top = Math.min(Math.max(top, topInset()), window.innerHeight - h - 8);
    let left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), document.documentElement.clientWidth - w - 8);
    // Bảng nghĩa (góc phải dưới trên máy tính) đang mở và bị thanh đè lên → dời thanh sang trái bảng.
    const sheet = document.querySelector('[data-lookup-sheet]:not([hidden])');
    if (sheet) {
      const s = sheet.getBoundingClientRect();
      const overlaps = left + w > s.left && left < s.right && top + h > s.top && top < s.bottom;
      if (overlaps && s.left - w - 8 >= 8) left = s.left - w - 8;
    }
    bar.style.top = `${window.scrollY + top}px`;
    bar.style.left = `${window.scrollX + left}px`;
  };

  container.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouseDown = true;
  });
  document.addEventListener('mouseup', () => {
    if (!mouseDown) return;
    mouseDown = false;
    schedule(10);
  });
  document.addEventListener('selectionchange', () => {
    if (mouseDown) return; // đang kéo chọn bằng chuột: chờ nhả chuột
    schedule(coarse() ? 350 : 120);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !bar.hidden) {
      hide();
      window.getSelection()?.removeAllRanges();
    }
  });

  bar.addEventListener('mousedown', (e) => e.preventDefault()); // giữ vùng chọn khi bấm nút
  bar.addEventListener('click', (e) => {
    const button = e.target.closest('[data-sel-action]');
    if (!button || !current) return;
    const { text, range } = current;
    // Nút có data-sel-keep: làm việc mà vẫn giữ vùng chọn (vd. Dịch).
    if (button.hasAttribute('data-sel-keep')) return onAction(button.dataset.selAction, text, range);
    hide();
    window.getSelection()?.removeAllRanges();
    onAction(button.dataset.selAction, text, range);
  });
  window.addEventListener('scroll', () => current && !bar.hidden && place(current.range), { passive: true });
  window.addEventListener('resize', () => current && !bar.hidden && place(current.range));
  return { hide };
}
