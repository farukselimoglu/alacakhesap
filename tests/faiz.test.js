const test = require('node:test');
const assert = require('node:assert/strict');
const { donemselFaiz, oranGun } = require('../lib/faiz');

const yakin = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('oran değişim günleri', () => {
  assert.equal(oranGun('2024-05-31'), 9);
  assert.equal(oranGun('2024-06-01'), 24);
  assert.equal(oranGun('2026-07-30'), 24);
  assert.equal(oranGun('2026-07-31'), 31);
});

test('tek dönem içinde kalan alacak', () => {
  // 01.01.2023 vade, 01.01.2024 hesap: 365 gün %9
  const r = donemselFaiz(1000, '2023-01-01', '2024-01-01');
  assert.equal(r.gun, 365);
  assert.equal(r.parcalar.length, 1);
  yakin(r.toplam, 90);
});

test('%9 → %24 geçişini bölerek hesaplar', () => {
  // 31.05.2024 vade: faiz 01.06.2024'ten başlar, tamamı %24
  const a = donemselFaiz(1000, '2024-05-31', '2024-06-30');
  assert.equal(a.parcalar.length, 1);
  assert.equal(a.parcalar[0].oran, 24);
  assert.equal(a.gun, 30);

  // 01.05.2024 vade, 30.06.2024 hesap: 30 gün %9 (02.05–31.05) + 30 gün %24
  const b = donemselFaiz(1000, '2024-05-01', '2024-06-30');
  assert.deepEqual(b.parcalar.map(p => [p.oran, p.gun]), [[9, 30], [24, 30]]);
  yakin(b.toplam, (1000 * 9 * 30 + 1000 * 24 * 30) / 36500);
});

test('üç dönemi kapsayan alacak (%9, %24, %31)', () => {
  const r = donemselFaiz(10000, '2023-01-01', '2026-10-21');
  assert.deepEqual(r.parcalar.map(p => p.oran), [9, 24, 31]);
  const gunler = r.parcalar.map(p => p.gun);
  // 02.01.2023–31.05.2024 = 516, 01.06.2024–30.07.2026 = 790, 31.07.2026–21.10.2026 = 83
  assert.deepEqual(gunler, [516, 790, 83]);
  assert.equal(r.gun, 516 + 790 + 83);
  yakin(r.toplam, (10000 * (9 * 516 + 24 * 790 + 31 * 83)) / 36500);
});

test('hesap tarihi vadeden önceyse faiz yok', () => {
  const r = donemselFaiz(1000, '2025-01-10', '2025-01-05');
  assert.equal(r.toplam, 0);
  assert.equal(r.gun, 0);
});
