# BERBERİNN · by Hakan Çetinkaya

Bornova / İzmir — karanlık lüks temalı, mobil öncelikli berber web sitesi.
Saf HTML5 + Tailwind CSS (CDN) + bağımlılıksız JavaScript. Derleme adımı gerekmez; klasörü olduğu gibi herhangi bir statik hostinge (Netlify, Vercel, GitHub Pages, cPanel) yükleyebilirsiniz.

```
index.html                 → Site
assets/css/style.css       → Tema, neon altın köşeler, animasyonlar
assets/js/main.js          → Hero video oynatıcı, galeri, lightbox
assets/js/media-manifest.js→ OTOMATİK üretilir (medya listesi)
raw-media/                 → SİZİN ham dosyalarınız
  ├─ videos/               → Uzun salon videoları (hero showreel'i buradan üretilir)
  ├─ photos/               → Fotoğraflar (galeri)
  └─ clips/                → Kısa kesim klipleri (galeride oynar)
media/                     → OTOMATİK üretilen web dosyaları (elle dokunmayın)
scripts/process-media.mjs  → Akıllı medya işleme
```

## Medyayı güncelleme (tek komut)

**İlk seferde bir kez** (sharp + FFmpeg otomatik iner):

```bash
npm install
```

**Her güncellemede:** dosyaları `raw-media/` içindeki ilgili klasöre atın ve çalıştırın:

```bash
npm run media
```

Hepsi bu. Ardından `npm run serve` ile http://localhost:5173 adresinden kontrol edin.

### Script ne yapar?
- **Videolar (`raw-media/videos/`)**: Tüm videoyu analiz eder (netlik, hareket, ışık, renk; sert kesmeleri eler), en iyi 4 farklı 5 sn'lik sahneyi seçer, sesi kaldırır ve **crossfade** geçişlerle ~17 sn'lik kesintisiz showreel üretir:
  `media/hero/hero.mp4` (16:9), `hero.webm`, `hero-mobile.mp4` (9:16, telefonlara özel), `poster.webp`.
  Showreel'de kullanılmayan en iyi 2 sahne de galeriye “kesim klibi” olarak eklenir.
- **Fotoğraflar (`raw-media/photos/`)**: WebP'ye çevirir, yüz/obje odaklı akıllı kırpar, bulanık ön-yükleme (LQIP) üretir ve Bento galeriye ekler.
  - Dosya adı `usta…` / `hakan…` ile başlarsa → “Ustalık” bölümündeki **usta portresi** olur.
  - Dosya adı `hero…` ile başlarsa → hero **poster görseli** olur.
  - Sıralama dosya adına göredir (`01-skin-fade.jpg`, `02-sakal.jpg` …); dosya adı galeride başlık olarak görünür.
- **Klipler (`raw-media/clips/`)**: Sessiz, sıkıştırılmış MP4 (maks. 12 sn) + poster.

### İnce ayar
```bash
npm run media -- --segments 3 --length 6 --xfade 1.2   # 3 sahne × 6 sn
npm run media -- --transition fadeblack                # geçiş tipi
npm run media -- --no-webm                             # daha hızlı
npm run media:photos                                   # sadece fotoğraflar
```

### FFmpeg yoksa?
`npm install` FFmpeg'i (`ffmpeg-static`) otomatik kurar. O da olmazsa script ham videoyu kopyalar ve **tarayıcıdaki akıllı oynatıcı** devreye girer: videoyu masaüstünde kare kare analiz edip en iyi aralıklar arasında yumuşak kararma/açılma + Ken Burns ile geçiş yapar (en iyi uyum için MP4/H.264 yükleyin). Belirli saniyeleri sabitlemek isterseniz `assets/js/media-manifest.js` içinde `"segments": [[12,17],[45,50],[80,85]]` yazabilirsiniz.

## Diğer düzenlemeler
- **Randevu linki**: tüm butonlar `https://www.viprandevusistemi.com.tr/s/berberin` adresine gider (`index.html` içinde arayıp değiştirin).
- **Fiyat göstermek**: hizmet kartındaki `<span class="price-tag"></span>` içine örn. `₺600` yazın; boşsa gizli kalır.
- **Alan adı**: yayına aldıktan sonra `index.html` içindeki JSON-LD'ye `"url": "https://alanadiniz.com"` ekleyin ve görsel yollarını tam adres yapın.
