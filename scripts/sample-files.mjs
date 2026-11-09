// Tạo tệp sách mẫu (PDF có lớp văn bản + EPUB) ngay trong bộ nhớ, không cần thư viện ngoài.
// Dùng cho `npm run seed` và cho test. Nội dung do dự án tự viết (không có bản quyền bên thứ ba).
import zlib from 'node:zlib';

// ---------- Nội dung ----------
export const ESSAY_TITLE = 'The Art of Slow Reading (Sample)';
export const ESSAY_PAGES = [
  [
    'The Art of Slow Reading',
    '',
    'In an age that rewards speed, slow reading can seem almost subversive.',
    'We skim headlines, scroll past paragraphs and mistake familiarity for',
    'understanding. Much as I sympathise with the view that time is scarce,',
    'I would argue that reading quickly often means reading nothing at all.',
    '',
    'Slow reading is not merely reading at a lower speed. It is a deliberate',
    'practice of noticing: the choice of a verb, the rhythm of a clause, the',
    'way a writer concedes a point before overturning it.',
  ],
  [
    'Noticing language',
    '',
    'Advanced learners rarely lack vocabulary in the narrow sense. What they',
    'lack is a feel for collocation and nuance. A careful reader notices that',
    'evidence is compelling rather than strong, and that a problem is tackled',
    'rather than fixed. Such details are seldom taught, yet they are precisely',
    'what distinguishes fluent writing from merely correct writing.',
    '',
    'Not only does slow reading sharpen comprehension, but it also builds a',
    'private store of phrases that can later be borrowed and adapted.',
  ],
  [
    'From reading to speaking',
    '',
    'The final step is to use what has been noticed. Reading a passage aloud',
    'reveals its rhythm: content words carry the stress, while small function',
    'words shrink and link together. Shadowing a good speaker, phrase by phrase,',
    'turns silent knowledge into something the mouth can actually produce.',
    '',
    'Admittedly, this takes patience. Nevertheless, a single page read slowly',
    'may teach more than a whole chapter devoured in haste.',
  ],
];

export const STORY_TITLE = "The Lighthouse Keeper's Notebook (Sample)";
export const STORY_CHAPTERS = [
  {
    title: 'Chapter 1: Arrival',
    paragraphs: [
      'The boat left me on the rocks just as the light began to fail. Rarely had I seen a sky so heavy, so reluctant to let the day go.',
      'The keeper, a wiry man in his sixties, greeted me with a nod rather than a word. It was, I would later learn, his way of saying a great deal.',
    ],
  },
  {
    title: 'Chapter 2: The Notebook',
    paragraphs: [
      'On the third evening he handed me a battered notebook. Every page was filled with weather, tides and, between them, the occasional sentence that had nothing to do with either.',
      '“Write down what you notice,” he said. “Not what you think you ought to notice.”',
      'Had I understood him then, I might have spared myself a great deal of trouble.',
    ],
  },
  {
    title: 'Chapter 3: The Storm',
    paragraphs: [
      'The storm arrived without ceremony. For two days the sea threw itself against the tower, and for two days we said almost nothing.',
      'When it was over, he opened the notebook to a blank page and wrote a single line: The sea does not argue; it simply insists.',
    ],
  },
];

// ---------- PDF ----------
const pdfEscape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** PDF nhiều trang, chữ Helvetica (có lớp văn bản để bôi chọn). */
export function buildSamplePdf(pages = ESSAY_PAGES, title = ESSAY_TITLE) {
  const objects = [];
  const add = (body) => objects.push(body) && objects.length;
  const catalogId = add(null);
  const pagesId = add(null);
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds = pages.map((lines) => {
    const ops = ['BT', '/F2 20 Tf', '72 740 Td', `(${pdfEscape(lines[0])}) Tj`, '/F1 12 Tf', '0 -34 Td', '16 TL'];
    for (const line of lines.slice(1)) ops.push(line ? `(${pdfEscape(line)}) Tj T*` : 'T*');
    ops.push('ET');
    const stream = ops.join('\n');
    const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    return add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> >>`,
    );
  });
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  const infoId = add(`<< /Title (${pdfEscape(title)}) >>`);

  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// ---------- ZIP (kiểu stored) + EPUB ----------
export function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of files) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildSampleEpub(chapters = STORY_CHAPTERS, title = STORY_TITLE) {
  const chapterFiles = chapters.map((c, i) => [
    `OEBPS/chapter${i + 1}.xhtml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>${xmlEscape(c.title)}</title></head><body><h1>${xmlEscape(c.title)}</h1>${c.paragraphs.map((p) => `<p>${xmlEscape(p)}</p>`).join('')}</body></html>`,
  ]);
  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">study-hub-sample-story</dc:identifier>
    <dc:title>${xmlEscape(title)}</dc:title>
    <dc:creator>Jazz Corner</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${chapters.map((_, i) => `<item id="c${i + 1}" href="chapter${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine>${chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('')}</spine>
</package>`;
  const nav = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head>
<body><nav epub:type="toc"><ol>${chapters.map((c, i) => `<li><a href="chapter${i + 1}.xhtml">${xmlEscape(c.title)}</a></li>`).join('')}</ol></nav></body></html>`;
  return buildZip([
    ['mimetype', 'application/epub+zip'],
    [
      'META-INF/container.xml',
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ],
    ['OEBPS/content.opf', opf],
    ['OEBPS/nav.xhtml', nav],
    ...chapterFiles,
  ]);
}
