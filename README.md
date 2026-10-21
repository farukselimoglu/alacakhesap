# AlacakHesap.com

Hukuk alanında alacak ve faiz hesaplama araçları sitesi.

- `index.html`: ana sayfa
- `araclar/`: hesaplama araçları (şu an: `kira-takip.html`)
- `lib/faiz.js`: ortak kanuni faiz motoru (oran dönemlerine bölerek hesaplar)
- `veri/tufe.js`: TÜİK TÜFE değişim oranları (aylık otomatik güncellenir)
- `lib/tufe-hesap.js`, `scripts/tufe-guncelle.js`: EVDS'ten TÜFE çekme ve oran hesabı
- `tests/`: testler (`npm test`)
- `docs/PLAN.md`: üyelik, reklam ve Pro modeli için platform planı

## Kanuni faiz oranları (3095 s. Kanun md.1)

| Başlangıç | Oran | Dayanak |
|---|---|---|
| 01.01.2006 | %9 | BKK 2005/9831 |
| 01.06.2024 | %24 | CK 8485 (RG 21.05.2024/32552) |
| 31.07.2026 | %31 | 7589 s. Kanun m.10 (RG 31.07.2026/33326): önceki yılın 31 Aralık TCMB reeskont oranının %80'i |

Oran değiştiğinde `lib/faiz.js` içindeki `KANUNI_FAIZ_DONEMLERI` dizisine yeni satır eklenir ve `npm test` çalıştırılır.

## TÜFE verisinin otomatik güncellenmesi

`.github/workflows/tufe-guncelle.yml` her ayın 3–6'sı arasında TCMB EVDS'ten TÜFE endeksini çeker,
dört oranı (aylık, yıllık, Aralık'a göre, 12 aylık ortalama) hesaplar ve yalnızca eksik ayları ekleyen
bir pull request açar. Tablodaki mevcut değerler yeniden hesaplanıp karşılaştırılır; 0,05 puandan büyük
fark varsa PR başlığı `[KONTROL GEREKLİ]` olur.

Gerekli ayarlar (GitHub → Settings → Secrets and variables → Actions):
- Secret `EVDS_API_KEY`: EVDS API anahtarı
- Variable `EVDS_TUFE_SERIES` (isteğe bağlı): TÜFE 2025=100 Genel seri kodu. Boşsa görev EVDS'te arar ve bulduğunu PR'da gösterir.
- Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests" açık olmalı.
