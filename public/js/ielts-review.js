// Trang kết quả IELTS: bôi chọn trong bài đọc để Luyện nói hoặc lưu vào Notebook.
import { attachSelectionBar } from './selection.js';
import { openNotebookDialog } from './notebook-save.js';
import { sendToSpeaking } from './speaking-handoff.js';

const bar = document.querySelector('[data-selection-bar][data-review]');
const config = JSON.parse(bar.dataset.config);
const source = { type: 'ielts', label: config.title, url: `/ielts/attempts/${config.id}/result` };

attachSelectionBar(document.querySelector('[data-review-passage]'), bar, {
  onAction: (action, text) => {
    if (action === 'speak') sendToSpeaking({ text, sourceType: 'ielts', sourceLabel: source.label, sourceUrl: source.url });
    if (action === 'notebook') openNotebookDialog({ content: text.split(' ').length <= 8 ? text : '', excerpt: text, source });
  },
});
