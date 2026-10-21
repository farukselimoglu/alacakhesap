/*
 * Kanuni (adi) faiz motoru — tüm hesaplama araçlarının ortak kullandığı modül.
 *
 * Faiz her gün, o gün yürürlükte olan oranla işler. Bir alacağın faiz aralığı
 * birden fazla oran dönemine yayılıyorsa aralık dönemlere bölünür ve her parça
 * kendi oranıyla hesaplanır (bileşiksiz, yıl = 365 gün).
 *
 * Oran tablosunu güncellemek için yalnızca KANUNI_FAIZ_DONEMLERI dizisine yeni
 * satır eklemek yeterlidir. 7589 sayılı Kanun sonrası oran her yıl 1 Ocak'ta
 * (önceki yılın 31 Aralık TCMB reeskont oranının %80'i) ve gerekirse 1 Temmuz'da
 * (30 Haziran oranı 5 puan veya daha fazla farklıysa) değişebilir.
 *
 * Tarayıcıda `window.Faiz`, Node'da `require('./faiz')` olarak kullanılır.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Faiz = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // baslangic: oranın yürürlüğe girdiği gün (dahil). Bitiş = bir sonraki satırın başlangıcı.
  const KANUNI_FAIZ_DONEMLERI = [
    { baslangic: '2005-01-01', oran: 12, dayanak: 'BKK 2004/8189' },
    { baslangic: '2006-01-01', oran: 9, dayanak: 'BKK 2005/9831 (RG 30.12.2005)' },
    { baslangic: '2024-06-01', oran: 24, dayanak: 'CK 8485 (RG 21.05.2024/32552)' },
    { baslangic: '2026-07-31', oran: 31, dayanak: '7589 s. Kanun m.10 (RG 31.07.2026/33326) — 31.12.2025 reeskont %38,75 × %80' },
  ];

  const GUN_MS = 864e5;

  // Tarihi saat diliminden bağımsız gün numarasına çevirir (yaz saati kaymalarını önler).
  function gunNo(t) {
    if (typeof t === 'string') {
      const [y, m, d] = t.split('-').map(Number);
      return Date.UTC(y, m - 1, d) / GUN_MS;
    }
    return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / GUN_MS;
  }

  function gunNoTarih(n) {
    const d = new Date(n * GUN_MS);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  function donemler(tablo) {
    const t = tablo || KANUNI_FAIZ_DONEMLERI;
    return t.map((p, i) => ({
      bas: gunNo(p.baslangic),
      bit: i + 1 < t.length ? gunNo(t[i + 1].baslangic) - 1 : Infinity, // dahil
      oran: p.oran,
      dayanak: p.dayanak,
      baslangic: p.baslangic,
    }));
  }

  /** Verilen gün yürürlükteki yıllık oran (%) */
  function oranGun(tarih, tablo) {
    const g = gunNo(tarih);
    let oran = null;
    for (const p of donemler(tablo)) if (g >= p.bas) oran = p.oran;
    return oran;
  }

  /**
   * Vade (temerrüt) tarihinden hesap tarihine kadar dönemsel faiz.
   * Faiz vadeden sonraki günden başlar, hesap günü dahildir: gün = hesap − vade.
   * Dönüş: { toplam, gun, parcalar: [{baslangic, bitis, gun, oran, faiz, dayanak}] }
   */
  function donemselFaiz(anapara, vade, hesapTarihi, tablo) {
    const ilk = gunNo(vade) + 1;
    const son = gunNo(hesapTarihi);
    const sonuc = { toplam: 0, gun: Math.max(0, son - ilk + 1), parcalar: [] };
    if (!(anapara > 0) || son < ilk) return sonuc;

    const liste = donemler(tablo);
    if (ilk < liste[0].bas) {
      throw new Error('Faiz tablosu ' + liste[0].baslangic + ' öncesini kapsamıyor.');
    }
    for (const p of liste) {
      const a = Math.max(ilk, p.bas);
      const b = Math.min(son, p.bit);
      if (a > b) continue;
      const gun = b - a + 1;
      const faiz = (anapara * p.oran * gun) / 36500;
      sonuc.parcalar.push({
        baslangic: gunNoTarih(a),
        bitis: gunNoTarih(b),
        gun,
        oran: p.oran,
        faiz,
        dayanak: p.dayanak,
      });
      sonuc.toplam += faiz;
    }
    return sonuc;
  }

  return { KANUNI_FAIZ_DONEMLERI, donemselFaiz, oranGun, gunNo, gunNoTarih, donemler };
});
