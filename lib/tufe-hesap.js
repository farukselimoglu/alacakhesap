/*
 * TÜFE endeks değerlerinden TÜİK'in yayımladığı dört değişim oranını hesaplar
 * ve veri/tufe.js tablosuyla birleştirir. Ağ erişimi yok; scripts/tufe-guncelle.js kullanır.
 *
 * Endeks haritası: { 'YYYY-MM': sayı }
 */
'use strict';

const anahtar = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

function ayKaydir(y, m, fark) {
  const t = y * 12 + (m - 1) + fark;
  return [Math.floor(t / 12), (t % 12) + 1];
}

/** Ay için endeks değeri (yoksa undefined) */
function deger(idx, y, m, fark = 0) {
  const [yy, mm] = ayKaydir(y, m, fark);
  return idx[anahtar(yy, mm)];
}

const yuzde = (a, b) => Math.round(((a / b) - 1) * 10000) / 100; // 2 ondalık

/**
 * Bir ay için oranlar. Gerekli geçmiş eksikse ilgili oran null döner.
 * aylik: önceki aya göre · yillik: önceki yılın aynı ayına göre
 * aralik: önceki yılın Aralık ayına göre · onikimort: on iki aylık ortalamalara göre
 */
function aylikOranlar(idx, y, m) {
  const v = deger(idx, y, m);
  if (v === undefined) return null;
  const onceki = deger(idx, y, m, -1);
  const gecenYil = deger(idx, y, m, -12);
  const aralik = idx[anahtar(y - 1, 12)];
  let son12 = 0, onceki12 = 0, tam = true;
  for (let i = 0; i < 12; i++) {
    const a = deger(idx, y, m, -i), b = deger(idx, y, m, -i - 12);
    if (a === undefined || b === undefined) { tam = false; break; }
    son12 += a; onceki12 += b;
  }
  return {
    aylik: onceki !== undefined ? yuzde(v, onceki) : null,
    yillik: gecenYil !== undefined ? yuzde(v, gecenYil) : null,
    aralik: aralik !== undefined ? yuzde(v, aralik) : null,
    onikimort: tam ? yuzde(son12, onceki12) : null,
  };
}

/**
 * Eski bazlı (2003=100) ve yeni bazlı (2025=100) seriyi tek seride birleştirir.
 * Ortak aylarda yeni seri esas alınır; eski seri, ortak ayların ortalamasına göre
 * oranlanarak yeni seri ölçeğine çekilir (zincirleme). Ortak ay yoksa hata verir.
 */
function serileriBagla(eski, yeni) {
  const ortak = Object.keys(yeni).filter(k => eski[k] !== undefined);
  if (!Object.keys(eski).length) return { ...yeni };
  if (!ortak.length) throw new Error('Eski ve yeni seride ortak ay yok; seriler bağlanamaz.');
  const ort = ks => ks.reduce((t, k) => t + Number(ks.src[k]), 0) / ks.length;
  const e = Object.assign([...ortak], { src: eski });
  const n = Object.assign([...ortak], { src: yeni });
  const katsayi = ort(n) / ort(e);
  const sonuc = {};
  for (const [k, v] of Object.entries(eski)) sonuc[k] = v * katsayi;
  for (const [k, v] of Object.entries(yeni)) sonuc[k] = v;
  return sonuc;
}

/**
 * Hesaplanan oranları tabloya ekler. Mevcut (0 olmayan) değerlere dokunmaz;
 * onları hesaplananla karşılaştırıp farkları raporlar.
 */
function tabloyaEkle(tablo, idx, { baslangicYili = 2005, tolerans = 0.05 } = {}) {
  const eklenen = [], farklar = [], kontrolEdilen = [];
  const aylar = Object.keys(idx).sort();
  for (const k of aylar) {
    const [y, m] = k.split('-').map(Number);
    if (y < baslangicYili) continue;
    const o = aylikOranlar(idx, y, m);
    if (!o) continue;
    for (const tur of ['onikimort', 'yillik', 'aylik', 'aralik']) {
      if (o[tur] === null) continue;
      const data = tablo[tur].data;
      if (!data[y]) data[y] = new Array(12).fill(0);
      const mevcut = data[y][m - 1];
      if (!mevcut) {
        data[y][m - 1] = o[tur];
        eklenen.push({ ay: k, tur, deger: o[tur] });
      } else {
        const fark = Math.round((o[tur] - mevcut) * 100) / 100;
        kontrolEdilen.push({ ay: k, tur, mevcut, hesaplanan: o[tur], fark });
        if (Math.abs(fark) > tolerans) farklar.push({ ay: k, tur, mevcut, hesaplanan: o[tur], fark });
      }
    }
  }
  return { eklenen, farklar, kontrolEdilen };
}

/** EVDS JSON yanıtını { 'YYYY-MM': sayı } haritasına çevirir */
function evdsAyristir(json, seriKodu) {
  const alan = seriKodu.replace(/\./g, '_');
  const idx = {};
  for (const it of json.items || []) {
    const ham = it[alan];
    if (ham === null || ham === undefined || ham === '') continue;
    const v = Number(String(ham).replace(',', '.'));
    if (!isFinite(v) || v <= 0) continue;
    const t = String(it.Tarih || it.tarih || '').match(/^(\d{4})-(\d{1,2})/);
    if (!t) continue;
    idx[anahtar(+t[1], +t[2])] = v;
  }
  return idx;
}

/** veri/tufe.js dosya içeriğini üretir (yıllar sıralı, her yıl tek satır) */
function tabloDosyasi(tablo, guncelleme) {
  let s = `/*
 * TÜİK Tüketici Fiyat Endeksi değişim oranları (%).
 * Her yıl için 12 ay (Ocak..Aralık); 0 = henüz açıklanmadı.
 * Bu dosya scripts/tufe-guncelle.js tarafından güncellenir (aylık GitHub görevi).
 * Mevcut değerler asla üzerine yazılmaz, yalnızca eksik aylar doldurulur.
 * Son otomatik güncelleme: ${guncelleme}
 */
(function (root) {
const TUFE_DATA = {
`;
  for (const tur of ['onikimort', 'yillik', 'aylik', 'aralik']) {
    s += `  ${tur}: {\n    tr: ${JSON.stringify(tablo[tur].tr)},\n    data: {\n`;
    for (const y of Object.keys(tablo[tur].data).map(Number).sort((a, b) => a - b)) {
      s += `      ${y}:[${tablo[tur].data[y].join(',')}],\n`;
    }
    s += `    }\n  },\n`;
  }
  s += `};

  if (typeof module === 'object' && module.exports) module.exports = TUFE_DATA;
  else root.TUFE_DATA = TUFE_DATA;
})(typeof self !== 'undefined' ? self : this);
`;
  return s;
}

module.exports = { aylikOranlar, serileriBagla, tabloyaEkle, evdsAyristir, tabloDosyasi, anahtar };
