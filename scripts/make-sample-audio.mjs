// Tạo lại audio mẫu cho Speaking (chỉ chạy trên Windows có System.Speech):
//   node scripts/make-sample-audio.mjs
// Kết quả: public/samples/<key>.wav + src/modules/speaking/sample-audio.json (mốc thời gian theo cụm).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SAMPLE_ITEMS } from '../src/modules/speaking/sample-items.js';

const tmp = path.resolve('.run/audio');
fs.mkdirSync(tmp, { recursive: true });
const input = path.join(tmp, 'input.json');
fs.writeFileSync(input, JSON.stringify(SAMPLE_ITEMS.map(({ key, text, rate }) => ({ key, text, rate }))));
execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/make-sample-audio.ps1', '-OutDir', tmp, '-InputJson', input], { stdio: 'inherit' });

const out = {};
fs.mkdirSync('public/samples', { recursive: true });
for (const item of SAMPLE_ITEMS) {
  const wav = path.join(tmp, `${item.key}.wav`);
  fs.copyFileSync(wav, `public/samples/${item.key}.wav`);
  const duration = (fs.statSync(wav).size - 44) / 32000; // 16 kHz, 16 bit, mono
  const raw = fs.readFileSync(path.join(tmp, `${item.key}.words.json`), 'utf8').replace(/^﻿/, '');
  const words = [].concat(JSON.parse(raw || '[]'));
  // Mỗi cụm bắt đầu tại từ đầu tiên của nó (theo vị trí ký tự trong văn bản).
  const phrases = item.phrases || [item.text];
  let cursor = 0;
  const starts = phrases.map((p) => {
    const at = item.text.indexOf(p, cursor);
    cursor = at + p.length;
    const w = words.find((x) => x.pos >= at);
    return w ? w.ms / 1000 : 0;
  });
  out[item.key] = {
    duration: Math.round(duration * 100) / 100,
    segments: phrases.map((text, i) => ({
      text,
      start: Math.max(0, Math.round((starts[i] - (i ? 0.05 : 0)) * 100) / 100),
      end: Math.round((i + 1 < starts.length ? starts[i + 1] : duration) * 100) / 100,
    })),
  };
}
fs.writeFileSync('src/modules/speaking/sample-audio.json', `${JSON.stringify(out, null, 2)}\n`);
console.info('[audio] đã tạo', Object.keys(out).join(', '));
