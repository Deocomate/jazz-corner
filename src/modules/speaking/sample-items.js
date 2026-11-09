// Bài luyện nói mẫu (dữ liệu mẫu). Audio tạo bằng giọng tổng hợp Windows (scripts/make-sample-audio.mjs),
// lưu ở public/samples/. segments: các cụm ý dùng cho Rhythm/Shadowing — mốc thời gian nằm trong sample-audio.json.
export const SAMPLE_VOICE = 'Microsoft Zira (synthetic voice, en-US)';

export const SAMPLE_ITEMS = [
  {
    key: 'word-phenomenon',
    kind: 'word',
    title: 'Word: phenomenon',
    text: 'phenomenon',
    rate: -2,
    notes: 'Stress falls on the second syllable: phe-NOM-e-non. Plural: phenomena.',
  },
  {
    key: 'sentence-blue-one',
    kind: 'sentence',
    title: 'Sentence: stress changes meaning',
    text: 'I wanted the blue one, not the green one.',
    rate: -1,
    phrases: ['I wanted the blue one,', 'not the green one.'],
    notes:
      'Stress BLUE to contrast colours (blue, not green). Stress I ("I wanted the blue one") and it means: I wanted it, not someone else.',
  },
  {
    key: 'passage-slow-reading',
    kind: 'passage',
    title: 'Passage: The Art of Slow Reading (academic)',
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
    notes: 'Academic passage: pause between thought groups, stress content words, reduce function words (of, a, the, at).',
  },
];
