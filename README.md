# AlacakHesap.com

Hukuk alanında alacak ve faiz hesaplama araçları sitesi.

- `index.html`: ana sayfa
- `araclar/`: hesaplama araçları (şu an: `kira-takip.html`)
- `lib/faiz.js`: ortak kanuni faiz motoru (oran dönemlerine bölerek hesaplar)
- `tests/`: hesap motoru testleri (`npm test`)
- `docs/PLAN.md`: üyelik, reklam ve Pro modeli için platform planı

## Kanuni faiz oranları (3095 s. Kanun md.1)

| Başlangıç | Oran | Dayanak |
|---|---|---|
| 01.01.2006 | %9 | BKK 2005/9831 |
| 01.06.2024 | %24 | CK 8485 (RG 21.05.2024/32552) |
| 31.07.2026 | %31 | 7589 s. Kanun m.10 (RG 31.07.2026/33326): önceki yılın 31 Aralık TCMB reeskont oranının %80'i |

Oran değiştiğinde `lib/faiz.js` içindeki `KANUNI_FAIZ_DONEMLERI` dizisine yeni satır eklenir ve `npm test` çalıştırılır.
