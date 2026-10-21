#!/usr/bin/env node
/*
 * TCMB EVDS'ten TÜİK TÜFE endeksini çekip veri/tufe.js tablosundaki eksik ayları doldurur.
 *
 * Ortam değişkenleri:
 *   EVDS_API_KEY       (zorunlu) EVDS API anahtarı — GitHub secret
 *   EVDS_TUFE_SERIES   TÜFE 2025=100 Genel endeks seri kodu. Boşsa EVDS'te aranır.
 *   EVDS_ESKI_SERIES   TÜFE 2003=100 Genel endeks seri kodu (varsayılan TP.FG.J0)
 *   EVDS_BASE          EVDS servis adresi (varsayılan https://evds2.tcmb.gov.tr/service/evds)
 *
 * Çıktılar: veri/tufe.js (güncellenmiş), tufe-rapor.md (PR açıklaması),
 *           GITHUB_OUTPUT: degisti=true|false, durum=tamam|kontrol
 */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('../lib/tufe-hesap');

const KOK = path.join(__dirname, '..');
const TABLO = process.env.TUFE_TABLO || path.join(KOK, 'veri', 'tufe.js');
const RAPOR = process.env.TUFE_RAPOR || path.join(KOK, 'tufe-rapor.md');
const BASE = (process.env.EVDS_BASE || 'https://evds2.tcmb.gov.tr/service/evds').replace(/\/$/, '');
const KEY = process.env.EVDS_API_KEY;
const ESKI = process.env.EVDS_ESKI_SERIES || 'TP.FG.J0';

const kucuk = s => String(s || '').toLocaleLowerCase('tr');
const metin = o => Object.values(o || {}).filter(v => typeof v === 'string').join(' ');

async function evds(yol) {
  const r = await fetch(`${BASE}/${yol}`, { headers: { key: KEY, Accept: 'application/json' } });
  const govde = await r.text();
  if (!r.ok) throw new Error(`EVDS ${r.status}: ${yol}\n${govde.slice(0, 300)}`);
  if (process.env.EVDS_DEBUG) console.log(`[EVDS] ${yol.replace(/key=[^&]*/, 'key=***')} → ${r.status} ${govde.slice(0, 400)}`);
  try { return JSON.parse(govde); } catch { throw new Error(`EVDS JSON dönmedi: ${yol}\n${govde.slice(0, 300)}`); }
}

const liste = j => (Array.isArray(j) ? j : j.items || j.data || []);

/** EVDS kategorilerinde "Tüketici Fiyat Endeksi (2025=100)" genel endeks serisini arar */
async function seriBul() {
  const adaylar = [];
  const kategoriler = liste(await evds('categories/type=json'));
  for (const k of kategoriler.filter(k => kucuk(metin(k)).includes('fiyat'))) {
    const kId = k.CATEGORY_ID ?? k.categoryId ?? k.id;
    const gruplar = liste(await evds(`datagroups/mode=2&code=${kId}&type=json`));
    for (const g of gruplar) {
      const gm = kucuk(metin(g));
      if (!(gm.includes('tüketici') && gm.includes('2025'))) continue;
      const gKod = g.DATAGROUP_CODE ?? g.datagroupCode ?? g.code;
      const seriler = liste(await evds(`serieList/type=json&code=${gKod}`));
      for (const s of seriler) {
        const kod = s.SERIE_CODE ?? s.serieCode ?? s.code;
        const ad = s.SERIE_NAME ?? s.serieName ?? metin(s);
        adaylar.push({ kod, ad, grup: g.DATAGROUP_NAME ?? gKod, genel: /genel|general/i.test(ad) });
      }
    }
  }
  return adaylar;
}

async function seriCek(kod, baslangic) {
  const bugun = new Date();
  const bitis = `31-12-${bugun.getFullYear()}`;
  const j = await evds(`series=${kod}&startDate=01-01-${baslangic}&endDate=${bitis}&type=json&frequency=5`);
  return H.evdsAyristir(j, kod);
}

function cikti(ad, deger) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${ad}=${deger}\n`);
}

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const ayAdi = k => { const [y, m] = k.split('-'); return `${AY[+m - 1]} ${y}`; };
const TUR = { onikimort: '12 aylık ort.', yillik: 'Yıllık', aylik: 'Aylık', aralik: "Aralık'a göre" };

async function main() {
  if (!KEY) throw new Error('EVDS_API_KEY tanımlı değil (GitHub → Settings → Secrets and variables → Actions).');
  const rapor = ['## TÜFE verisi güncellemesi', ''];

  let yeniKod = process.env.EVDS_TUFE_SERIES;
  if (!yeniKod) {
    const adaylar = await seriBul();
    const genel = adaylar.filter(a => a.genel);
    rapor.push('### Seri kodu otomatik arandı', '', '| Kod | Ad | Grup |', '|---|---|---|',
      ...adaylar.slice(0, 30).map(a => `| \`${a.kod}\` | ${a.ad} | ${a.grup} |`), '');
    if (genel.length !== 1) {
      rapor.push(`**Tek bir "Genel" endeks serisi bulunamadı (${genel.length} aday).** ` +
        'Doğru kodu GitHub → Settings → Secrets and variables → Actions → Variables altına `EVDS_TUFE_SERIES` adıyla ekleyin.');
      fs.writeFileSync(RAPOR, rapor.join('\n'));
      console.log(rapor.join('\n'));
      cikti('degisti', 'false');
      process.exitCode = 1;
      return;
    }
    yeniKod = genel[0].kod;
    rapor.push(`Kullanılan seri: \`${yeniKod}\` (${genel[0].ad}). Doğruysa \`EVDS_TUFE_SERIES\` değişkeni olarak kaydedin.`, '');
  }

  const eski = await seriCek(ESKI, 2003);
  const yeni = await seriCek(yeniKod, 2003);
  if (!Object.keys(yeni).length) throw new Error(`${yeniKod} serisi boş döndü.`);
  const idx = H.serileriBagla(eski, yeni);
  const sonAy = Object.keys(yeni).sort().pop();

  const tablo = require(TABLO);
  const once = JSON.stringify(tablo);
  const { eklenen, farklar, kontrolEdilen } = H.tabloyaEkle(tablo, idx);

  // Yalnızca son 3 yılın kontrollerini raporla (eski yıllarda baz farkı beklenir)
  const sinirYil = new Date().getFullYear() - 1;
  const yakinFark = farklar.filter(f => +f.ay.slice(0, 4) >= sinirYil);
  const yakinKontrol = kontrolEdilen.filter(f => +f.ay.slice(0, 4) >= sinirYil);

  rapor.push(`Kaynak: TCMB EVDS · yeni seri \`${yeniKod}\` · eski seri \`${ESKI}\` · son veri: **${ayAdi(sonAy)}**`, '');

  if (eklenen.length) {
    rapor.push('### Eklenen değerler', '', '| Ay | Tür | Oran (%) |', '|---|---|---:|',
      ...eklenen.map(e => `| ${ayAdi(e.ay)} | ${TUR[e.tur]} | ${e.deger.toFixed(2)} |`), '');
  } else rapor.push('Yeni ay yok; tablo zaten güncel.', '');

  rapor.push('### Doğrulama', '',
    `Tabloda zaten bulunan ${yakinKontrol.length} değer (${sinirYil} ve sonrası) EVDS verisinden yeniden hesaplandı.`);
  if (yakinFark.length) {
    rapor.push(`**⚠️ ${yakinFark.length} değerde 0,05 puandan büyük fark var. Birleştirmeden önce TÜİK bülteniyle karşılaştırın.**`, '',
      '| Ay | Tür | Tablodaki | Hesaplanan | Fark |', '|---|---|---:|---:|---:|',
      ...yakinFark.map(f => `| ${ayAdi(f.ay)} | ${TUR[f.tur]} | ${f.mevcut} | ${f.hesaplanan} | ${f.fark} |`), '');
  } else if (yakinKontrol.length) {
    rapor.push('✅ Tümü 0,05 puan içinde tutuyor.', '');
  }
  rapor.push('', 'Birleştirmeden önce son ayı TÜİK bülteniyle karşılaştırın: https://data.tuik.gov.tr (Enflasyon ve Fiyat → Tüketici Fiyat Endeksi).');

  const degisti = JSON.stringify(tablo) !== once;
  if (degisti) fs.writeFileSync(TABLO, H.tabloDosyasi(tablo, new Date().toISOString().slice(0, 10)));
  fs.writeFileSync(RAPOR, rapor.join('\n'));
  console.log(rapor.join('\n'));
  cikti('degisti', String(degisti));
  cikti('durum', yakinFark.length ? 'kontrol' : 'tamam');
  cikti('son_ay', ayAdi(sonAy));
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
