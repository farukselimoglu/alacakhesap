const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const H = require('../lib/tufe-hesap');

// Her ay %2 artan sahte endeks: 2023-01 = 100
function sahteEndeks(bas = [2023, 1], bit = [2026, 9], artis = 0.02, ilk = 100) {
  const idx = {};
  let v = ilk;
  for (let t = bas[0] * 12 + bas[1] - 1; t <= bit[0] * 12 + bit[1] - 1; t++) {
    idx[H.anahtar(Math.floor(t / 12), (t % 12) + 1)] = v;
    v *= 1 + artis;
  }
  return idx;
}

test('dört oranı endeksten hesaplar', () => {
  const o = H.aylikOranlar(sahteEndeks(), 2026, 4);
  assert.equal(o.aylik, 2);
  assert.equal(o.yillik, Math.round((1.02 ** 12 - 1) * 10000) / 100); // 26.82
  assert.equal(o.aralik, Math.round((1.02 ** 4 - 1) * 10000) / 100); // 8.24
  // Sabit büyümede 12 aylık ortalama değişim yıllık değişime eşittir
  assert.equal(o.onikimort, o.yillik);
});

test('yetersiz geçmişte 12 aylık ortalama null', () => {
  const o = H.aylikOranlar(sahteEndeks([2025, 1]), 2025, 6);
  assert.equal(o.onikimort, null);
  assert.equal(o.yillik, null);
  assert.equal(o.aylik, 2);
});

test('mevcut değerlere dokunmaz, eksikleri doldurur, farkı raporlar', () => {
  const tablo = { onikimort: { data: { 2026: [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0] } },
    yillik: { data: {} }, aylik: { data: {} }, aralik: { data: {} } };
  const r = H.tabloyaEkle(tablo, sahteEndeks(), { baslangicYili: 2026 });
  assert.deepEqual(tablo.onikimort.data[2026].slice(0, 3), [1, 2, 3]);
  assert.equal(tablo.onikimort.data[2026][3], 26.82);
  assert.equal(tablo.onikimort.data[2026][9], 0); // Ekim verisi yok
  assert.equal(r.farklar.length, 3);
  assert.equal(tablo.aylik.data[2026][8], 2);
});

test('eski ve yeni bazlı seriyi oranı bozmadan bağlar', () => {
  const tum = sahteEndeks([2023, 1], [2026, 6]);
  const eski = {}, yeni = {};
  for (const [k, v] of Object.entries(tum)) {
    if (k <= '2025-12') eski[k] = v * 3.7; // farklı ölçek (2003=100)
    if (k >= '2025-01') yeni[k] = v;
  }
  const bagli = H.serileriBagla(eski, yeni);
  const o = H.aylikOranlar(bagli, 2026, 3);
  assert.equal(o.onikimort, H.aylikOranlar(tum, 2026, 3).onikimort);
  assert.throws(() => H.serileriBagla({ '2020-01': 1 }, { '2025-01': 1 }));
});

test('EVDS yanıtını ayrıştırır', () => {
  const idx = H.evdsAyristir({ items: [
    { Tarih: '2026-1', TP_X_Y: '105.5' }, { Tarih: '2026-02', TP_X_Y: null }, { Tarih: '2026-3', TP_X_Y: 107 },
  ] }, 'TP.X.Y');
  assert.deepEqual(idx, { '2026-01': 105.5, '2026-03': 107 });
});

// Uçtan uca: sahte EVDS sunucusu, seri kodu araması dahil
test('betik sahte EVDS ile tabloyu günceller', async () => {
  const tum = sahteEndeks([2003, 1], [2026, 9], 0.01);
  const seri = (kod, kosul) => ({ items: Object.entries(tum).filter(([k]) => kosul(k))
    .map(([k, v]) => ({ Tarih: k.replace('-0', '-'), [kod.replace(/\./g, '_')]: String(v) })) });
  let gelenAnahtar;
  const sunucu = http.createServer((req, res) => {
    gelenAnahtar = req.headers.key;
    const u = decodeURIComponent(req.url);
    let j;
    if (u.includes('categories')) j = [{ CATEGORY_ID: 7, TOPIC_TITLE_TR: 'FİYAT ENDEKSLERİ' }];
    else if (u.includes('datagroups')) j = [{ DATAGROUP_CODE: 'bie_tufe25', DATAGROUP_NAME: 'Tüketici Fiyat Endeksi (2025=100)' },
      { DATAGROUP_CODE: 'bie_eski', DATAGROUP_NAME: 'Tüketici Fiyat Endeksi (2003=100) (Arşiv)' }];
    else if (u.includes('serieList')) j = [{ SERIE_CODE: 'TP.YENI.GENEL', SERIE_NAME: 'Genel Endeks' }, { SERIE_CODE: 'TP.YENI.GIDA', SERIE_NAME: 'Gıda' }];
    else if (u.includes('series=TP.FG.J0')) j = seri('TP.FG.J0', k => k <= '2025-12');
    else if (u.includes('series=TP.YENI.GENEL')) j = seri('TP.YENI.GENEL', k => k >= '2025-01');
    res.writeHead(j ? 200 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify(j || {}));
  });
  await new Promise(r => sunucu.listen(0, r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tufe-'));
  const tabloYol = path.join(dir, 'tufe.js');
  fs.copyFileSync(path.join(__dirname, '..', 'veri', 'tufe.js'), tabloYol);
  const ciktiYol = path.join(dir, 'out');
  try {
    await new Promise((ok, hata) => execFile(process.execPath, [path.join(__dirname, '..', 'scripts', 'tufe-guncelle.js')], {
      env: { ...process.env, EVDS_API_KEY: 'test-anahtar', EVDS_TUFE_SERIES: 'ara', EVDS_BASE: `http://localhost:${sunucu.address().port}`,
        TUFE_TABLO: tabloYol, TUFE_RAPOR: path.join(dir, 'rapor.md'), GITHUB_OUTPUT: ciktiYol },
    }, (e, out, err) => (e ? hata(new Error(err || out)) : ok())));
    const t = require(tabloYol);
    assert.equal(gelenAnahtar, 'test-anahtar');
    assert.equal(t.aylik.data[2026][8], 1); // Eylül 2026 eklendi
    assert.equal(t.aylik.data[2026][0], 4.84); // mevcut Ocak değeri korundu
    const rapor = fs.readFileSync(path.join(dir, 'rapor.md'), 'utf8');
    assert.match(rapor, /TP\.YENI\.GENEL/);
    assert.match(rapor, /Eyl 2026/);
    assert.match(fs.readFileSync(ciktiYol, 'utf8'), /degisti=true/);
  } finally {
    sunucu.close();
  }
});
