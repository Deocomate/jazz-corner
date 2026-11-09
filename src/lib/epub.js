// Đọc cấu trúc EPUB: tên sách, tác giả, thứ tự chương (spine), mục lục và ảnh bìa.
// Chỉ dùng regex cho XML vì các tệp OPF/NCX có cấu trúc đơn giản và ổn định.
import path from 'node:path';
import { readZipIndex, extractEntry, ZipError } from './zip.js';

const decodeEntities = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3]) : null;
};

/** Ghép đường dẫn tương đối trong EPUB (luôn dạng posix, bỏ #fragment). */
export function resolveHref(baseDir, href) {
  const clean = decodeURIComponent(href.split('#')[0]);
  return path.posix.normalize(path.posix.join(baseDir, clean)).replace(/^\.\//, '');
}

function firstText(xml, tagPattern) {
  const m = xml.match(new RegExp(`<(?:[a-z]+:)?${tagPattern}[^>]*>([\\s\\S]*?)</(?:[a-z]+:)?${tagPattern}>`, 'i'));
  return m ? stripTags(m[1]) : null;
}

function parseToc(zip, entries, manifest, opfDir, spinePaths) {
  const navItem = manifest.find((m) => (m.properties || '').split(/\s+/).includes('nav'));
  if (navItem) {
    const xml = extractEntry(zip, entries, navItem.path)?.toString('utf8') ?? '';
    const navBlock = xml.match(/<nav[^>]*epub:type\s*=\s*["']toc["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? xml;
    const dir = path.posix.dirname(navItem.path);
    const items = [...navBlock.matchAll(/<a\s[^>]*>[\s\S]*?<\/a>/gi)]
      .map((m) => ({ label: stripTags(m[0]), href: attr(m[0], 'href') }))
      .filter((x) => x.href && x.label)
      .map((x) => ({ label: x.label, path: resolveHref(dir, x.href) }));
    if (items.length) return items;
  }
  const ncxItem = manifest.find((m) => m.mediaType === 'application/x-dtbncx+xml');
  if (ncxItem) {
    const xml = extractEntry(zip, entries, ncxItem.path)?.toString('utf8') ?? '';
    const dir = path.posix.dirname(ncxItem.path);
    const items = [...xml.matchAll(/<navPoint[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content[^>]*src\s*=\s*["']([^"']+)["']/gi)]
      .map((m) => ({ label: stripTags(m[1]), path: resolveHref(dir, m[2]) }));
    if (items.length) return items;
  }
  return spinePaths.map((p, i) => ({ label: `Part ${i + 1}`, path: p }));
}

/**
 * Phân tích EPUB từ Buffer. Ném ZipError với thông báo dễ hiểu nếu tệp hỏng.
 * Trả về { title, author, spine: [path], toc: [{label, path, chapter}], coverPath, entries }.
 */
export function parseEpub(zip) {
  const entries = readZipIndex(zip);
  const container = extractEntry(zip, entries, 'META-INF/container.xml');
  if (!container) throw new ZipError('META-INF/container.xml is missing — this is not a standard EPUB file.');
  const rootTag = container.toString('utf8').match(/<rootfile\s[^>]*>/i)?.[0];
  const opfPath = rootTag && attr(rootTag, 'full-path');
  const opfBuf = opfPath && extractEntry(zip, entries, opfPath);
  if (!opfBuf) throw new ZipError('The OPF file that describes the book was not found.');

  const opf = opfBuf.toString('utf8');
  const opfDir = path.posix.dirname(opfPath) === '.' ? '' : path.posix.dirname(opfPath);
  const manifest = [...opf.matchAll(/<item\s[^>]*>/gi)].map((m) => ({
    id: attr(m[0], 'id'),
    path: resolveHref(opfDir, attr(m[0], 'href') || ''),
    mediaType: attr(m[0], 'media-type'),
    properties: attr(m[0], 'properties'),
  }));
  const byId = new Map(manifest.map((m) => [m.id, m]));
  const spine = [...opf.matchAll(/<itemref\s[^>]*>/gi)]
    .map((m) => byId.get(attr(m[0], 'idref')))
    .filter((m) => m && entries.has(m.path))
    .map((m) => m.path);
  if (!spine.length) throw new ZipError('The EPUB has no readable chapters.');

  const coverMeta = opf.match(/<meta\s[^>]*name\s*=\s*["']cover["'][^>]*>/i)?.[0];
  const coverItem =
    manifest.find((m) => (m.properties || '').split(/\s+/).includes('cover-image')) ||
    (coverMeta && byId.get(attr(coverMeta, 'content')));
  const coverPath = coverItem && /^image\//.test(coverItem.mediaType || '') ? coverItem.path : null;

  const chapterOf = (p) => spine.indexOf(p);
  const toc = parseToc(zip, entries, manifest, opfDir, spine)
    .map((t) => ({ ...t, chapter: chapterOf(t.path) }))
    .filter((t) => t.chapter >= 0);

  return {
    title: firstText(opf, 'title'),
    author: firstText(opf, 'creator'),
    spine,
    toc,
    coverPath,
    entries,
  };
}

const MIME = {
  '.xhtml': 'application/xhtml+xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.css': 'text/css',
};
export const mimeFor = (p) => MIME[path.posix.extname(p).toLowerCase()] || 'application/octet-stream';
