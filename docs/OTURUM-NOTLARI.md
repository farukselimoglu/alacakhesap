# Oturum Notları — 21–23 Ekim 2026

Bu dosya, ilk Claude Code oturumunda yapılanları ve kalan işleri özetler.
Yeni bir oturumda Claude'a "docs/OTURUM-NOTLARI.md dosyasını oku, kaldığımız yerden devam edelim" demen yeterli.

## Yapılanlar

### 1. Kira aracındaki faiz hatası düzeltildi (`araclar/kira-takip.html`)
- **Hata:** Faiz oranı alacağın vade tarihine göre tek bir oran olarak seçiliyordu. 2023 vadeli bir alacağın 2024 sonrası günleri de %9 ile hesaplanıyordu.
- **Düzeltme:** Faiz artık her gün o gün geçerli olan oranla işliyor ve oran dönemlerine bölünüyor. Ekranda her satır için "%9 × 942 g + %24 × 790 g + %31 × 83 g" gibi bir döküm, altta da dönem özet tablosu var. Excel çıktısında her dönem ayrı sütunda.

| Dönem | Oran | Dayanak |
|---|---|---|
| 01.01.2006 – 31.05.2024 | %9 | BKK 2005/9831 |
| 01.06.2024 – 30.07.2026 | %24 | CK 8485 (RG 21.05.2024/32552) |
| 31.07.2026 – | %31 | 7589 s. Kanun m.10 (RG 31.07.2026/33326) |

- 7589 sayılı Kanun sonrası oran = önceki yılın 31 Aralık TCMB reeskont oranı × %80. **Her Ocak'ta (gerekirse Temmuz'da) değişebilir. Ocak 2027'de `lib/faiz.js` güncellenmeli.**
- %31'in başlangıç tarihi 31.07.2026 alındı (RG yayım günü); bir kaynak 16.07.2026 diyor. Resmî Gazete'den teyit edilmeli.

### 2. Kira aracındaki diğer düzeltmeler
- **%25 kira tavanı:** Yalnızca 11.06.2022–01.07.2024 arasında yenilenen konut dönemlerine uygulanıyor. TÜFE %25'in altındaysa TÜFE kullanılıyor.
- **Eksik TÜİK verisi:** Artık sessizce atlanmıyor; uyarı çıkıyor ve oran elle girilebiliyor.
- **Zamanaşımı:** Açılıp kapatılabilir hale getirildi.

### 3. TÜFE verisi otomatik güncelleniyor
- **Kaynak:** TCMB EVDS3 API (`https://evds3.tcmb.gov.tr/igmevdsms-dis/`). Anahtar `key` başlığında gönderiliyor.
- **Seriler:** `TP.TUKFIY2025.GENEL` (TÜFE 2025=100 Genel) ve `TP.FG.J0` (eski 2003=100 seri). İkisi zincirlenerek dört oran hesaplanıyor: aylık, yıllık, Aralık'a göre, 12 aylık ortalama.
- **Veri:** `veri/tufe.js` Eylül 2026'ya kadar güncel (Eylül: aylık %1,84, yıllık %29,73).
- **Görev:** `.github/workflows/tufe-guncelle.yml` her ayın 3–6'sı arasında çalışır ve sadece eksik ayları ekleyen bir pull request açar. 2026 ve sonrası mevcut değerleri yeniden hesaplayıp kontrol eder; 36 değerin hepsi tuttu.
- **GitHub secret:** `EVDS_API_KEY` eklendi.

### 4. Altyapı
- **Ortak modüller:** `lib/faiz.js` (faiz motoru), `lib/tufe-hesap.js` (oran hesapları)
- **Testler:** `npm test`, 11 test
- **CI:** `.github/workflows/test.yml`
- **Ana sayfa:** `index.html`
- **Vercel ayarı:** `vercel.json`
- **Platform planı:** `docs/PLAN.md` (üyelik, reklam, Pro, araç listesi, yol haritası)

## Kalan işler (sırayla)

1. **`claude/jolly-babbage-lww8qq` dalını `main`'e birleştir.** Zamanlanmış görev ve Vercel `main`'den çalışır.
2. **Settings → Actions → General → Workflow permissions:** "Allow GitHub Actions to create and approve pull requests" kutusunu işaretle.
3. **Vercel:** vercel.com → Add New Project → `alacakhesap` → Framework: Other → Deploy.
4. **Birleştirme sonrası temizlik:** `tufe-guncelle.yml` içindeki `push: branches: ['claude/**']` deneme tetikleyicisi kaldırılabilir.
5. **Hukuki kontrol:** İş yeri kiralarında taraflar tacirse ticari (avans) faiz gerekebilir; araç şu an her durumda kanuni faiz kullanıyor.
6. **Sıradaki araç:** Kanuni faiz hesaplama aracı (motor hazır: `lib/faiz.js`).
7. **Ocak 2027:** Yeni kanuni faiz oranını `lib/faiz.js` içindeki `KANUNI_FAIZ_DONEMLERI` dizisine ekle.

## Önizleme
https://claude.ai/artifact/TneeY8ST2MCp9CDq9nsVkH (sadece hesap sahibi açabilir; GitHub'dan otomatik güncellenmez)
