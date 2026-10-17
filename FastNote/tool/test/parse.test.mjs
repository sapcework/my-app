import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const here = new URL('.', import.meta.url);
const html = readFileSync(new URL('../fastnote-export.html', here), 'utf8');
const code = html.match(/<script id="parser">([\s\S]*?)<\/script>/)[1]; // 解析部分だけを取り出す
const ctx = vm.createContext({ crypto: globalThis.crypto, TextEncoder });
vm.runInContext(code + '\n;globalThis.api = { parseBackup, verifyHash, toCsv, formatDate };', ctx);
const { verifyHash, toCsv } = ctx.api;
const parseBackup = s => JSON.parse(JSON.stringify(ctx.api.parseBackup(s))); // vm 側の配列を通常の配列にして比較できるようにする

const sample = name => readFileSync(new URL(`../../sample/${name}`, here), 'utf8');
const make = body => createHash('sha1').update(body, 'utf8').digest('hex') + '#' + body; // 正しいハッシュ付きのバックアップを作る
const entry = (id, ts, len, title) => `^!${id};;#00FF0000;${ts};;#FFFFFFFF;${len};;{\\"reminder\\":0};${title}`; // JSON 文字列内に埋める形

test('メモなしのバックアップは0件', async () => {
  const r = parseBackup(sample('FastNotepad_2026-07-16_'));
  assert.equal(r.notes.length, 0);
  assert.deepEqual(r.warnings, []);
  assert.equal(await verifyHash(r), true);
});

test('サンプル1〜3の件数と本文', async () => {
  const expect = { '1': ['123\nあいう'], '2': ['123\nあいう', '456\nえおか'], '3': ['123\nあいう', '456\nえおか', '高速メモ帳\nきくけ'] };
  for (const [n, bodies] of Object.entries(expect)) {
    const r = parseBackup(sample(`FastNotepad_2026-07-16_${n}`));
    assert.deepEqual(r.notes.map(x => x.body), bodies, `sample ${n}`);
    assert.deepEqual(r.warnings, [], `sample ${n}`);
    assert.equal(await verifyHash(r), true, `sample ${n}`);
  }
});

test('サンプル4：編集後の本文・更新日時・項目', async () => {
  const r = parseBackup(sample('FastNotepad_2026-07-16_4'));
  assert.equal(await verifyHash(r), true);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.notes.length, 3);
  const [a, b, c] = r.notes;
  assert.equal(a.id, 'ba8dqhdjibuo521c');
  assert.equal(a.body, '123\nあいう\na');
  assert.equal(a.updatedAt, 1784185594);
  assert.equal(a.length, 9);
  assert.equal(a.title, '123');
  assert.equal(a.textColor, '#00FF0000');
  assert.equal(a.bgColor, '#FFFFFFFF');
  assert.equal(a.reminder, '{"reminder":0}');
  assert.equal(a.status, '正常');
  assert.equal(b.id, '8na67rhfr0f96196');
  assert.equal(c.title, '高速メモ帳');
  assert.deepEqual(r.notes.map(x => x.order), [1, 2, 3]);
});

test('本文やタイトルに区切り文字・記号・絵文字が含まれても壊れない', async () => {
  const t1 = 'a^!b;c{[!*|@]}d';
  const b1 = t1 + '\n"引用",カンマ\r\n😀{}}';
  const b2 = 'x';
  const index = entry('aaaaaaaaaaaaaaaa', 1784182773, [...b1].length, t1) + entry('bbbbbbbbbbbbbbbb', 1784183000, 1, 'x');
  const data = JSON.stringify({ _aaaaaaaaaaaaaaaa: b1, _bbbbbbbbbbbbbbbb: b2 });
  const r = parseBackup(make(`{"index":"${index}"}{[!*|@]}{}{[!*|@]}${data}`));
  assert.equal(await verifyHash(r), true);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.notes.map(n => [n.title, n.body]), [[t1, b1], ['x', 'x']]);
});

test('ハッシュ不一致を検出する', async () => {
  const s = sample('FastNotepad_2026-07-16_1').replace('あいう', 'かきく');
  const r = parseBackup(s);
  assert.equal(await verifyHash(r), false);
});

test('BOM と末尾の改行があっても読める', async () => {
  const r = parseBackup('﻿' + sample('FastNotepad_2026-07-16_2') + '\r\n');
  assert.equal(r.notes.length, 2);
  assert.equal(await verifyHash(r), true);
});

test('一覧と本文の食い違い・文字数違い・2番目のデータを警告する', () => {
  const index = entry('aaaaaaaaaaaaaaaa', 1, 99, 'A') + entry('cccccccccccccccc', 2, 1, 'C');
  const data = JSON.stringify({ _aaaaaaaaaaaaaaaa: 'A', _bbbbbbbbbbbbbbbb: 'B\n本文' });
  const r = parseBackup(make(`{"index":"${index}"}{[!*|@]}{"folder":1}{[!*|@]}${data}`));
  assert.deepEqual(r.notes.map(n => [n.id[0], n.status]), [['a', '正常'], ['c', '本文なし'], ['b', 'index なし']]);
  assert.equal(r.notes[2].title, 'B');
  const w = r.warnings.join('\n');
  assert.match(w, /文字数/);
  assert.match(w, /本文がありません/);
  assert.match(w, /一覧にありません/);
  assert.match(w, /2 番目のデータが空ではありません/);
});

test('形式が違うファイルはエラー', () => {
  assert.throws(() => parseBackup('hello'), /バックアップ形式ではありません/);
  assert.throws(() => parseBackup('zz#{}'), /ハッシュが不正/);
  assert.throws(() => parseBackup(make('{"index":""}{}{}')), /区切りが見つかりません/);
  assert.throws(() => parseBackup(make('{"index":"')), /途中で終わっています/);
});

test('CSV は BOM 付き・CRLF・引用符を二重化・本文の改行を保持', () => {
  const csv = toCsv([{ order: 1, id: 'id1', title: 'T', body: 'a"b,c\nd', updatedAt: 0, textColor: '#00FF0000', bgColor: '#FFFFFFFF', length: 7, reminder: '{"reminder":0}', status: '正常' }]);
  assert.ok(csv.startsWith('﻿"表示順","ID","タイトル","本文"'));
  assert.ok(csv.endsWith('\r\n'));
  assert.ok(csv.includes('"a""b,c\nd"'));
  assert.ok(csv.includes('"{""reminder"":0}"'));
  assert.equal(csv.split('\r\n').length, 3); // ヘッダー・1行・末尾の空
});
