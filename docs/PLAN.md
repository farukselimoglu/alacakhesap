# AlacakHesap — Platform Planı

## Hedef

- 8–10 hukuki hesaplama aracı. **Araçlar herkese ücretsiz**, giriş gerekmez.
- Giriş yapan kullanıcı hesaplamalarını **kaydedip** sonra açabilir.
- Gelir: **reklam** (ücretsiz kullanıcılar) + **aylık Pro üyelik** (reklamsız + ek özellikler).
- Yayın: GitHub'a push → Vercel otomatik deploy.

## Önerilen teknoloji

| Katman | Seçim | Neden |
|---|---|---|
| Uygulama | **Next.js (App Router)** | Vercel'in kendi framework'ü; statik araç sayfaları + giriş/hesap sayfaları aynı projede. SEO için sunucu tarafı render. |
| Barındırma | **Vercel** | GitHub bağlantısı: `main` → canlı site, her PR → önizleme linki. |
| Giriş + Veritabanı | **Supabase** (Postgres + Auth, Frankfurt bölgesi) | E-posta/Google girişi hazır, satır bazlı yetki (RLS) ile her kullanıcı yalnızca kendi kaydını görür. Ücretsiz katman başlangıç için yeterli. |
| Ödeme / abonelik | **iyzico Abonelik** (alternatif: PayTR) | Türkiye'de şirket/şahıs şirketiyle çalışıyor. Stripe Türkiye'deki satıcıyı doğrudan desteklemiyor. Yurt dışı şirket varsa Paddle / Lemon Squeezy (vergi ve faturayı kendileri yönetir). |
| Reklam | **Google AdSense** | Pro kullanıcıda reklam bileşeni hiç yüklenmez. |
| Hesap motoru | `lib/` altında saf JS modülleri + `node --test` testleri | Aynı kod hem tarayıcıda hem sunucuda çalışır; oran değişince tek yerden güncellenir. |

## Temel ilke: hesaplama tarayıcıda yapılır

Araçlar istemci tarafında çalışır, sunucu maliyeti yoktur ve girişsiz kullanım mümkündür.
Giriş yapan kullanıcı "Kaydet" dediğinde yalnızca **girdiler** (JSON) veritabanına yazılır.
Açılınca hesap, o günkü güncel oran tablosuyla yeniden yapılır. İstenirse kayıt anındaki sonuç özeti de saklanır.

### Veri modeli (ilk sürüm)

```sql
profiles      (id uuid PK = auth.users.id, ad, plan text default 'free', pro_bitis timestamptz, created_at)
hesaplamalar  (id uuid PK, user_id uuid FK, arac text, baslik text, girdi jsonb,
               sonuc_ozet jsonb, klasor_id uuid null, created_at, updated_at)
klasorler     (id uuid PK, user_id uuid FK, ad text)            -- Pro: dosya/müvekkil klasörleri
abonelikler   (id, user_id, saglayici text, saglayici_ref text, durum text, donem_bitis, ...)
```

Her tabloda RLS: `user_id = auth.uid()`. Abonelik durumu yalnızca ödeme sağlayıcısının webhook'u ile güncellenir (sunucu tarafı, gizli anahtarla).

## Ücretsiz ve Pro

| Özellik | Misafir | Ücretsiz üye | Pro |
|---|---|---|---|
| Tüm hesaplama araçları | ✓ | ✓ | ✓ |
| PDF yazdır / Excel indir | ✓ | ✓ | ✓ |
| Hesap kaydetme | — | 5 kayıt | Sınırsız |
| Reklamsız | — | — | ✓ |
| Kendi büro logosu / antetli PDF | — | — | ✓ |
| Klasörler (müvekkil / dosya) | — | — | ✓ |
| Toplu Excel içe aktarma, şablonlar | — | — | ✓ |
| Oran değişince kayıtlı hesaplar için e-posta bildirimi | — | — | ✓ |

Fiyat önerisi: aylık ~149–249 ₺, yıllık ödemede 2 ay bedava. Bunu rakip araçlara bakarak netleştirmek gerekir.

## Araç listesi önerisi (8–10)

1. **Kira takip & alacak** (hazır, `araclar/kira-takip.html`)
2. **Kanuni faiz hesaplama**: tutar + vade + bitiş tarihi, dönemsel kırılım (motor hazır: `lib/faiz.js`)
3. **Ticari / avans faizi**: TCMB avans oranı dönemleri (3095 md.2)
4. **Kıdem ve ihbar tazminatı**: tavan, damga vergisi, gelir vergisi
5. **Yıllık izin ücreti / fazla mesai** alacakları
6. **Avukatlık ücreti (AAÜT)**: nispi ve maktu tarifeye göre
7. **Yargı harç ve masrafları**: başvuru, peşin, karar harcı
8. **Nafaka artışı**: TÜFE'ye göre güncel nafaka ve birikmiş alacak
9. **Süre hesaplama**: tebliğ, itiraz, istinaf ve temyiz süreleri, resmî tatiller dahil
10. **İcra takip hesabı**: asıl alacak + işlemiş faiz + masraf, takip sonrası faiz

## Veri güncelleme (en kritik risk)

Hesap araçlarının değeri doğru oranlara bağlı. Tüm oran ve endeks verileri tek yerde tutulmalı:

- `lib/faiz.js`: kanuni faiz dönemleri. **7589 s. Kanun sonrası oran her yıl 1 Ocak'ta** (31 Aralık reeskont × %80), gerekirse 1 Temmuz'da değişebilir. **Ocak 2027'de ilk güncelleme yapılmalı.**
- TÜFE endeksleri: her ayın 3'ünde TÜİK açıklar. Şu an kira aracında Mart 2026'ya kadar veri var.
- Avans faizi, AAÜT, harç tarifeleri: yılbaşında değişir.

Öneri: verileri `veri/*.json` dosyalarına taşımak, her değişikliği test + PR ile yapmak, sitede "Son güncelleme: …" göstermek. İleride Vercel Cron ile TCMB/TÜİK'te yeni veri var mı diye kontrol edip **otomatik PR açmak** (değeri doğrudan canlıya yazmamak).

## Yasal / KVKK

- Gizlilik politikası, KVKK aydınlatma metni, çerez onayı (AdSense için gerekli), kullanım koşulları.
- Kaydedilen hesaplarda müvekkil adı gibi kişisel veriler olabilir: veritabanı AB bölgesinde, yalnızca kullanıcının erişimi (RLS), hesap silinince veriler de silinir. Kullanıcıya "isim yerine dosya no yazabilirsiniz" önerisi.
- Her araçta "bilgilendirme amaçlıdır" uyarısı korunur.

## Yol haritası

| Faz | İçerik | Sonuç |
|---|---|---|
| **0 — şimdi** | Statik HTML araçlar + ortak `lib/` motoru + testler. Vercel'e repo bağlanır. | Site yayında, araçlar ücretsiz. |
| **1** | Next.js'e geçiş; her araç bir sayfa/bileşen. `lib/` aynen taşınır. SEO sayfaları (araç başına açıklama metni). | Arama motorundan trafik almaya hazır. |
| **2** | Supabase girişi + "Kaydet / Hesaplarım" sayfası. | Ücretsiz üyelik. |
| **3** | AdSense + KVKK sayfaları + çerez onayı. | Reklam geliri. |
| **4** | iyzico abonelik + Pro özellikleri (reklamsız, antetli PDF, klasörler). | Pro gelir. |
| **5** | Kalan araçlar, oran değişim bildirimleri, otomatik veri kontrolü. | |

## Vercel kurulumu (Faz 0)

1. vercel.com → GitHub ile giriş → "Add New Project" → `alacakhesap` reposunu seç.
2. Framework: **Other**. Build komutu boş, çıktı klasörü kök (`.`).
3. Deploy. Bundan sonra `main`'e her push canlıya çıkar, her PR için önizleme linki gelir.
4. Alan adı: Project → Settings → Domains → `alacakhesap.com`.
