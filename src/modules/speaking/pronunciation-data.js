// Dữ liệu phát âm đã kiểm tra thủ công (IPA, âm tiết, trọng âm, khác biệt Anh–Mỹ).
// Chỉ hiển thị IPA cho từ có trong danh sách này — không đoán IPA cho từ khác.
// stress: vị trí âm tiết mang trọng âm chính (bắt đầu từ 0).
export const PRONUNCIATION = {
  phenomenon: [{ pos: 'noun', uk: '/fəˈnɒmɪnən/', us: '/fəˈnɑːmənɑːn/', syllables: ['phe', 'nom', 'e', 'non'], stress: 1, note: 'Anh: /ɒ/ ngắn; Mỹ: /ɑː/ dài và âm cuối /ɑːn/.' }],
  record: [
    { pos: 'noun', uk: '/ˈrekɔːd/', us: '/ˈrekərd/', syllables: ['rec', 'ord'], stress: 0, note: 'Danh từ: nhấn âm đầu — a REcord.' },
    { pos: 'verb', uk: '/rɪˈkɔːd/', us: '/rɪˈkɔːrd/', syllables: ['re', 'cord'], stress: 1, note: 'Động từ: nhấn âm sau — to reCORD.' },
  ],
  present: [
    { pos: 'noun/adj', uk: '/ˈpreznt/', us: '/ˈpreznt/', syllables: ['pres', 'ent'], stress: 0, note: 'Danh/tính từ: PREsent.' },
    { pos: 'verb', uk: '/prɪˈzent/', us: '/prɪˈzent/', syllables: ['pre', 'sent'], stress: 1, note: 'Động từ: preSENT.' },
  ],
  mitigate: [{ pos: 'verb', uk: '/ˈmɪtɪɡeɪt/', us: '/ˈmɪtɪɡeɪt/', syllables: ['mit', 'i', 'gate'], stress: 0, note: 'Mỹ thường đọc /t/ giữa thành âm vỗ nhẹ: /ˈmɪɾɪɡeɪt/.' }],
  ubiquitous: [{ pos: 'adjective', uk: '/juːˈbɪkwɪtəs/', us: '/juːˈbɪkwətəs/', syllables: ['u', 'biq', 'ui', 'tous'], stress: 1, note: '' }],
  exacerbate: [{ pos: 'verb', uk: '/ɪɡˈzæsəbeɪt/', us: '/ɪɡˈzæsərbeɪt/', syllables: ['ex', 'ac', 'er', 'bate'], stress: 1, note: 'Mỹ phát âm /r/ trong âm tiết thứ ba.' }],
  nuance: [{ pos: 'noun', uk: '/ˈnjuːɑːns/', us: '/ˈnuːɑːns/', syllables: ['nu', 'ance'], stress: 0, note: 'Anh có /j/ sau n (nyoo); Mỹ thường không.' }],
  ambiguous: [{ pos: 'adjective', uk: '/æmˈbɪɡjuəs/', us: '/æmˈbɪɡjuəs/', syllables: ['am', 'big', 'u', 'ous'], stress: 1, note: '' }],
  scrutiny: [{ pos: 'noun', uk: '/ˈskruːtəni/', us: '/ˈskruːtni/', syllables: ['scru', 'ti', 'ny'], stress: 0, note: 'Mỹ hay nuốt âm giữa: SCROOT-ny.' }],
  resilience: [{ pos: 'noun', uk: '/rɪˈzɪliəns/', us: '/rɪˈzɪliəns/', syllables: ['re', 'sil', 'i', 'ence'], stress: 1, note: '' }],
  inevitable: [{ pos: 'adjective', uk: '/ɪnˈevɪtəbl/', us: '/ɪnˈevɪtəbl/', syllables: ['in', 'ev', 'i', 'ta', 'ble'], stress: 1, note: '' }],
  hypothesis: [{ pos: 'noun', uk: '/haɪˈpɒθəsɪs/', us: '/haɪˈpɑːθəsɪs/', syllables: ['hy', 'poth', 'e', 'sis'], stress: 1, note: '' }],
  ship: [{ pos: 'noun', uk: '/ʃɪp/', us: '/ʃɪp/', syllables: ['ship'], stress: 0, note: '/ɪ/ ngắn, lưỡi thả lỏng.' }],
  sheep: [{ pos: 'noun', uk: '/ʃiːp/', us: '/ʃiːp/', syllables: ['sheep'], stress: 0, note: '/iː/ dài, môi căng sang hai bên.' }],
};

/** Cặp tối thiểu: hai từ khác nhau đúng một âm. */
export const MINIMAL_PAIRS = [
  { a: 'ship', b: 'sheep', sound: '/ɪ/ – /iː/', tip: '/ɪ/ ngắn và thả lỏng; /iː/ dài, môi căng.' },
  { a: 'full', b: 'fool', sound: '/ʊ/ – /uː/', tip: '/ʊ/ ngắn; /uː/ dài, môi tròn hơn.' },
  { a: 'bad', b: 'bed', sound: '/æ/ – /e/', tip: '/æ/ mở miệng rộng hơn, hàm hạ thấp.' },
  { a: 'cut', b: 'cart', sound: '/ʌ/ – /ɑː/', tip: '/ɑː/ dài và sâu hơn (giọng Anh).' },
  { a: 'think', b: 'sink', sound: '/θ/ – /s/', tip: '/θ/: đặt đầu lưỡi giữa hai hàm răng.' },
  { a: 'light', b: 'right', sound: '/l/ – /r/', tip: '/r/: lưỡi không chạm vòm miệng.' },
  { a: 'very', b: 'berry', sound: '/v/ – /b/', tip: '/v/: răng trên chạm môi dưới.' },
  { a: 'rice', b: 'rise', sound: '/s/ – /z/', tip: '/z/ có rung dây thanh; nguyên âm trước /z/ dài hơn.' },
];

const NOUN_CUES = new Set(['a', 'an', 'the', 'this', 'that', 'my', 'your', 'his', 'her', 'our', 'their', 'its', 'new', 'world', 'criminal', 'track']);
const VERB_CUES = new Set(['to', 'will', 'can', 'could', 'would', 'should', 'must', 'may', 'might', "didn't", "don't", "'ll", 'i', 'we', 'they', 'you']);

/**
 * Tra phát âm. Nếu từ có nhiều cách đọc, dùng câu gốc để đoán từ loại (gợi ý, người dùng vẫn chọn được).
 * Trả về { word, entries, suggested } hoặc null nếu chưa có dữ liệu đáng tin cậy.
 */
export function lookupPronunciation(word, context = '') {
  const key = String(word || '').toLowerCase().trim();
  const entries = PRONUNCIATION[key];
  if (!entries) return null;
  let suggested = 0;
  if (entries.length > 1 && context) {
    const tokens = context.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/);
    const i = tokens.indexOf(key);
    const prev = i > 0 ? tokens[i - 1] : '';
    if (VERB_CUES.has(prev)) suggested = entries.findIndex((e) => e.pos.includes('verb'));
    else if (NOUN_CUES.has(prev)) suggested = entries.findIndex((e) => e.pos.includes('noun'));
    if (suggested < 0) suggested = 0;
  }
  return { word: key, entries, suggested, fromContext: entries.length > 1 && Boolean(context) };
}
