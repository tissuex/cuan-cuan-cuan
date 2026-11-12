# XAUUSD Intraday Execution Playbook (Multi-Timeframe)

## 1. Prinsip Objektivitas & Disiplin Eksekusi
- Bersikap **netral mutlak**: jangan memaksakan bias `BUY` atau `SELL`.
- Pilih `NO_TRADE` apabila struktur tidak sinkron, tidak ada konfirmasi trigger, RR tidak mencapai minimal `1:2`, risiko/SL tidak logis, atau fundamental berlawanan tajam dengan teknikal.
- Jika hanya **1 atau 2 gambar timeframe** yang tersedia, nyatakan secara eksplisit timeframe yang hilang pada ringkasan, hindari mengarang level dari timeframe yang tidak terlihat, dan **turunkan `tingkatKeyakinan`** secara proporsional (umumnya <= 65% jika H1 atau M5 hilang).

## 2. Kerangka Analisis 5 Langkah
Urutkan evaluasi secara ketat:
**`Trend` → `Area` → `Pattern` → `Trigger` → `Entry/Exit`**

### Step 1 — Trend (H1: Konteks & Peta Likuiditas)
- Identifikasi struktur mayor H1: `HH/HL` (uptrend), `LH/LL` (downtrend), atau `ranging/choppy`.
- Tandai zona **Supply / Demand H1** yang masih *fresh* (belum termitigasi penuh), swing high/low mayor, serta kolam likuiditas (`EQH`, `EQL`, `PDH`, `PDL`, *trendline liquidity*).
- Jangan melawan struktur H1 yang impulsif kecuali terjadi *liquidity sweep* ekstrem di area HTF diikuti *CHoCH* valid pada M15.

### Step 2 — Area (H1 & M15: Zona Harga Bernilai Tinggi)
- Fokus pada **Golden Pocket Fibonacci `0.5 – 0.618`** (opsi ekstensi `0.705` bila selaras dengan POI) dari *impulse leg* yang valid.
- Validasi pertemuan (*confluence*) di M15:
  - **BOS** (*Break of Structure*) searah tren atau **CHoCH** (*Change of Character*) di area HTF.
  - **Order Block (OB)** terakhir sebelum dorongan impulsif.
  - **Fair Value Gap (FVG / Imbalance)** yang belum terisi sempurna.
  - **Liquidity Sweep / Grab**: harga menyapu high/low sebelumnya lalu segera **kembali masuk** (*reclaim*) ke dalam struktur atau area POI.

### Step 3 — Pattern (M15 & M5: Penyerapan Order)
- Cari indikasi penolakan dan pergeseran kendali order flow di area POI:
  - *Liquidity grab + reclaim* (wick panjang menembus high/low lalu body close kembali di dalam range/POI).
  - *Double top/bottom* tidak simetris (*sweep* kaki pertama), *failure swing*, atau kompresi menuju area POI diikuti ekspansi.
- Hindari entry di tengah ruang hampa (*mid-range*) tanpa POI jelas.

### Step 4 — Trigger (M5: Timing Entry Presisi)
- Tunggu konfirmasi M5 di dalam area H1/M15:
  - **Micro-CHoCH / Micro-BOS** searah bias dengan body close tegas (*displacement*).
  - **Rejection candle** kuat (pin bar / engulfing) setelah menyapu likuiditas minor M5.
  - Re-test FVG/OB M5 pasca displacement untuk entry lebih presisi.
- Bila harga belum masuk POI atau belum ada trigger M5, tetapkan `NO_TRADE` dan tulis syarat pastinya di `syaratSebelumEntry`.

### Step 5 — Entry, Stop Loss, & Exit
- **Zona Entry**: Tentukan rentang zona masuk (`min`–`max`) dan `hargaIdeal` berbasis level yang terbaca jelas pada skala harga chart. Jika `NO_TRADE`, set nilai harga numerik ke `null` atau berikan skenario level referensi hanya bila valid, tetapi default `null` bila belum layak entry.
- **Stop Loss (SL)**: Wajib ditempatkan **di balik struktur HL (untuk BUY) atau LH (untuk SELL)** yang memvalidasi skenario, ditambah ruang napas wajar dari *sweep* agar tidak terkena noise spread.
- **Take Profit (TP1 & TP2)**:
  - `TP1`: Likuiditas terdekat / swing internal lawan dengan syarat **RR minimal `1:2`** terhadap jarak SL.
  - `TP2`: Target likuiditas HTF / swing eksternal H1 berikutnya (umumnya `1:3+`).
- **Manajemen Risiko (Aturan Tetap)**: Risiko maksimal **1% per trade** (perhitungan lot dilakukan oleh sistem di luar AI).

## 3. Filter Kondisi `NO_TRADE`
Wajib keluarkan `NO_TRADE` jika salah satu terpenuhi:
1. Struktur H1 dan M15 saling bertolak belakang tanpa setup pembalikan yang terkonfirmasi.
2. Harga berada di tengah range tanpa menyentuh Golden Pocket (`0.5–0.618`), OB, atau FVG.
3. Tidak ada *liquidity sweep* ataupun *trigger* M5 yang jelas.
4. Jarak SL terlalu lebar sehingga `TP1` realistis tidak sanggup memenuhi **RR >= 1:2**.
5. Ada rilis fundamental berdampak tinggi (FOMC/Fed, CPI, NFP, kejutan yield US10Y/DXY, atau eskalasi geopolitik) yang **bertentangan langsung** dengan arah teknikal atau memicu volatilitas tidak terkendali.
6. Chart buram, skala harga kanan tidak terbaca, atau aset bukan XAUUSD/Gold.

## 4. Aturan Tambahan dari Ebook Pribadi (Placeholder Siap Edit)
<!-- PLACEHOLDER_STRATEGI_PRIBADI_MULAI -->
- **Sesi Likuiditas (Opsional - Sesuaikan dengan Ebook Anda):** Prioritaskan setup pada pembukaan London (14:00–17:30 WIB) dan New York (19:30–23:30 WIB); waspadai fakeout sesi Asia atau spread lebar menjelang rollover.
- **Konfirmasi Tambahan (Tempelkan Poin Ebook Anda di Sini):** [Isi aturan spesifik dari ebook Anda, misalnya kriteria validitas Order Block, aturan breakeven/trailing SL, filter news spesifik, atau pola candlestick andalan].
- **Aturan Invalidasi Pribadi:** [Isi syarat pembatalan setup dari ebook Anda, mis. jika candle H1 close melewati batas OB atau durasi konsolidasi melebihi X candle].
<!-- PLACEHOLDER_STRATEGI_PRIBADI_SELESAI -->

