// Bài luyện nói mẫu (dữ liệu mẫu). Audio tạo bằng giọng tổng hợp Windows (scripts/make-sample-audio.mjs),
// lưu ở public/samples/. segments: các cụm ý dùng cho Rhythm/Shadowing — mốc thời gian nằm trong sample-audio.json.
export const SAMPLE_VOICE = 'Microsoft Zira (giọng tổng hợp, en-US)';

export const SAMPLE_ITEMS = [
  {
    key: 'word-phenomenon',
    kind: 'word',
    title: 'Từ: phenomenon',
    text: 'phenomenon',
    rate: -2,
    notes: 'Trọng âm rơi vào âm tiết thứ hai: phe-NOM-e-non. Số nhiều: phenomena.',
  },
  {
    key: 'sentence-blue-one',
    kind: 'sentence',
    title: 'Câu: trọng âm đổi nghĩa',
    text: 'I wanted the blue one, not the green one.',
    rate: -1,
    phrases: ['I wanted the blue one,', 'not the green one.'],
    notes:
      'Nhấn BLUE để đối chiếu màu sắc (blue chứ không phải green). Nếu nhấn I ("I wanted the blue one") thì ý là: chính tôi muốn cái màu xanh, không phải người khác.',
  },
  {
    key: 'passage-slow-reading',
    kind: 'passage',
    title: 'Đoạn: The Art of Slow Reading (học thuật)',
    text: 'Slow reading is not merely reading at a lower speed. It is a deliberate practice of noticing: the choice of a verb, the rhythm of a clause, and the way a writer concedes a point before overturning it. Admittedly, this takes patience.',
    rate: -1,
    phrases: [
      'Slow reading',
      'is not merely reading',
      'at a lower speed.',
      'It is a deliberate practice',
      'of noticing:',
      'the choice of a verb,',
      'the rhythm of a clause,',
      'and the way a writer concedes a point',
      'before overturning it.',
      'Admittedly,',
      'this takes patience.',
    ],
    notes: 'Đoạn văn học thuật: luyện ngắt theo cụm ý, nhấn từ nội dung, đọc nhẹ các từ chức năng (of, a, the, at).',
  },
];
