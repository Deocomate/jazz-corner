// Tô sáng một đoạn văn bản trong vùng chứa (chương EPUB hoặc lớp văn bản PDF).
// So khớp bỏ qua khác biệt khoảng trắng, vì vậy đoạn trải qua nhiều thẻ vẫn tìm được.

function textNodes(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('.endOfContent') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

/** Xây chuỗi đã chuẩn hoá khoảng trắng + bảng ánh xạ vị trí -> (node, offset). */
function buildIndex(container) {
  const map = [];
  let text = '';
  let lastSpace = true;
  for (const node of textNodes(container)) {
    const value = node.nodeValue;
    for (let i = 0; i < value.length; i++) {
      const isSpace = /\s/.test(value[i]);
      if (isSpace && lastSpace) continue;
      text += isSpace ? ' ' : value[i].toLowerCase();
      map.push({ node, offset: i });
      lastSpace = isSpace;
    }
    // Ranh giới giữa các node (VD giữa hai dòng PDF) coi như một khoảng trắng.
    if (!lastSpace) {
      text += ' ';
      map.push({ node, offset: value.length });
      lastSpace = true;
    }
  }
  return { text, map };
}

const normalize = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Bọc đoạn khớp đầu tiên bằng <mark class="...">. Trả về phần tử mark đầu tiên hoặc null. */
export function markText(container, needle, className = 'hl', attrs = {}) {
  const target = normalize(needle || '');
  if (!target || !container) return null;
  const { text, map } = buildIndex(container);
  let start = text.indexOf(target);
  if (start < 0) return null;
  const end = start + target.length - 1;

  // Gom theo từng text node để bọc từng đoạn riêng (không phá cấu trúc thẻ).
  const segments = new Map();
  for (let i = start; i <= end; i++) {
    const { node, offset } = map[i];
    if (offset >= node.nodeValue.length) continue;
    const seg = segments.get(node) || { from: offset, to: offset };
    seg.from = Math.min(seg.from, offset);
    seg.to = Math.max(seg.to, offset);
    segments.set(node, seg);
  }
  let first = null;
  for (const [node, { from, to }] of segments) {
    const range = document.createRange();
    range.setStart(node, from);
    range.setEnd(node, to + 1);
    const mark = document.createElement('mark');
    mark.className = className;
    for (const [k, v] of Object.entries(attrs)) mark.setAttribute(k, v);
    range.surroundContents(mark);
    first ??= mark;
  }
  return first;
}

/** Gỡ các mark theo class (VD xoá tô sáng tạm thời). */
export function unmark(container, className) {
  container.querySelectorAll(`mark.${className}`).forEach((m) => m.replaceWith(...m.childNodes));
  container.normalize();
}
