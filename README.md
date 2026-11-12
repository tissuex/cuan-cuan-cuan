# Gold Chart Analyzer (XAUUSD Multi-Timeframe)

Aplikasi web Next.js (App Router, TypeScript, Tailwind CSS) untuk menganalisis screenshot grafik TradingView **XAUUSD** (`H1`, `M15`, `M5`) secara objektif berdasarkan playbook strategi ter-cache dan perhitungan manajemen risiko deterministik.

## Arsitektur Singkat

- **Playbook Ter-cache (Tanpa Kirim Ebook PDF):** Arsip ebook PDF disimpan di `knowledge/source/` (tidak pernah dibaca runtime dan dikecualikan dari bundle Vercel via `next.config.ts`). Ringkasan padat strategi (< 1.500 token) ada di `knowledge/playbook.md`, dimuat oleh `src/lib/playbook.ts` saat startup server dan dikirim sebagai *system prompt* dengan dukungan *prompt caching*.
- **Dual-Provider Vercel AI SDK (`ai` + `@ai-sdk/google` & `@ai-sdk/anthropic`):** Default menggunakan **Google AI Studio (`gemini-3-flash-preview`)** dan mendukung **Anthropic (`claude-sonnet-4-5`)** melalui `AI_PROVIDER`. Seluruh panggilan model dijalankan hanya di server Route Handler (`/api/analyze`) dengan output JSON tervalidasi Zod (`Output.object`).
- **Kompresi Gambar Sisi Klien:** Screenshot `M5`, `M15`, dan `H1` (drag-and-drop, file picker, atau `Ctrl+V` clipboard) otomatis dikecilkan sisi terpanjang ke `1280px` dan dikompres ke WebP/JPEG kualitas `0.8`, divalidasi di bawah batas 4,5 MB Vercel Functions, dan mendukung analisis parsial (1 atau 2 gambar).
- **Kalkulator Lot & RR Deterministik:** Perhitungan lot (termasuk lot `< 0.01` untuk akun cent/mikro), Risk-to-Reward, dan peringatan jika lot minimum broker memaksa risiko melebihi persentase target dihitung murni di TypeScript (`src/lib/risk-calculator.ts`), bukan oleh AI.
- **Riset Fundamental Opsional & Cache 20 Menit:** Toggle riset fundamental (DXY, US10Y, Fed, CPI/NFP, geopolitik) menggunakan tool web search provider dan di-cache di server selama 20 menit via `unstable_cache` (`src/lib/fundamental.ts`). Jika gagal/terkena kuota, sistem otomatis lanjut dengan analisis teknikal saja.
- **Mode Analisis Lanjutan:** Hanya mengirim gambar baru + ringkasan JSON hasil sebelumnya (bukan seluruh riwayat chat) untuk menghemat token.

## Struktur Folder

```text
├── knowledge/
│   ├── README.md                  # Panduan memperbarui playbook
│   ├── playbook.md                # Ringkasan aturan strategi (< 1.500 token)
│   └── source/                    # Arsip ebook PDF (tidak dibaca runtime & dikecualikan dari Vercel)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/route.ts   # POST streaming NDJSON + AI Vision + kalkulasi risiko (maxDuration=60)
│   │   │   └── config/route.ts    # GET status konfigurasi publik (tanpa membocorkan API key)
│   │   ├── settings/page.tsx      # Halaman pengaturan saldo, risiko %, min lot (< 0.01) di localStorage
│   │   ├── globals.css
│   │   ├── layout.tsx             # Layout dark mode + Navbar + Disclaimer tetap
│   │   └── page.tsx               # Halaman utama Analyzer
│   ├── components/
│   │   ├── AnalysisResultView.tsx # Kartu keputusan besar, tabel level harga & sizing, breakdown TF
│   │   ├── AnalyzerClient.tsx     # Orkestrator upload, streaming status, error handling, analisis lanjutan
│   │   ├── ChartUploader.tsx      # 3 slot M5/M15/H1 (drag-drop, Ctrl+V paste, preview, kompresi)
│   │   ├── DisclaimerBanner.tsx   # Disclaimer tetap
│   │   └── Navbar.tsx
│   └── lib/
│       ├── ai-provider.ts         # Resolver Google AI Studio / Anthropic dari env
│       ├── auth.ts                # Verifikasi APP_PASSWORD opsional (timingSafeEqual)
│       ├── fundamental.ts         # Web search fundamental + server cache 20 menit
│       ├── image-compress.ts      # Kompresi client-side <= 1280px WebP/JPEG 0.8
│       ├── playbook.ts            # Loader knowledge/playbook.md + prompt caching
│       ├── rate-limit.ts          # Rate limiter per IP (Upstash Redis / fallback in-memory)
│       ├── risk-calculator.ts     # Kalkulasi lot, RR, dan peringatan minLot deterministik
│       ├── schema.ts              # Skema Zod & kontrak tipe TypeScript
│       └── settings-storage.ts    # Helper localStorage / sessionStorage browser
├── .env.example
├── .gitignore
└── next.config.ts                 # outputFileTracingIncludes/Excludes untuk knowledge/
```

## Daftar Environment Variable

Salin `.env.example` menjadi `.env.local` untuk pengujian lokal, atau isi langsung di **Vercel Project Settings → Environment Variables**:

| Variable | Wajib | Default | Keterangan |
| --- | --- | --- | --- |
| `AI_PROVIDER` | Tidak | Auto (`google`) | Pilih `google` (Google AI Studio) atau `anthropic` (Claude). |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Ya (jika `google`) | — | API key dari Google AI Studio. Tidak pernah dikirim ke browser. |
| `ANTHROPIC_API_KEY` | Ya (jika `anthropic`) | — | API key Anthropic (opsional jika memakai Google AI Studio). |
| `MODEL_NAME` | Tidak | `gemini-3-flash-preview` / `claude-sonnet-4-5` | Nama model vision yang digunakan di server. |
| `APP_PASSWORD` | Tidak | Kosong | Jika diisi, UI dan `/api/analyze` terkunci dengan satu password akses ini. |
| `UPSTASH_REDIS_REST_URL` | Tidak | Kosong | URL Upstash Redis untuk rate limit terdistribusi (fallback in-memory jika kosong). |
| `UPSTASH_REDIS_REST_TOKEN` | Tidak | Kosong | Token Upstash Redis untuk rate limit per IP. |
| `ALLOWED_ORIGINS` | Tidak | Kosong | Daftar origin CORS tambahan (dipisah koma) untuk APK Android / domain custom Vercel. Origin Capacitor dan domain Vercel bawaan otomatis diizinkan. |

## Menjalankan Secara Lokal

```bash
npm install
cp .env.example .env.local
# Isi GOOGLE_GENERATIVE_AI_API_KEY (atau ANTHROPIC_API_KEY) di .env.local
npm run dev
```

Buka `http://localhost:3000`.

## Langkah Deploy Sendiri ke Vercel

1. **Siapkan repository Git** (GitHub / GitLab / Bitbucket) dan push proyek ini.
   - Pastikan `.env.local` **tidak** ter-commit (sudah masuk `.gitignore`).
   - Jika repo bersifat **publik** atau ebook di `knowledge/source/` berhak cipta, hapus tanda `#` pada `# knowledge/source/` di `.gitignore` sebelum `git push`.
2. Buka [Vercel Dashboard](https://vercel.com/new) dan klik **Add New → Project**, lalu pilih repository Anda.
3. Pada bagian **Environment Variables**, masukkan:
   - `AI_PROVIDER` (`google` atau `anthropic`)
   - `GOOGLE_GENERATIVE_AI_API_KEY` (atau `ANTHROPIC_API_KEY`)
   - `MODEL_NAME` (mis. `gemini-3-flash-preview`)
   - Opsional: `APP_PASSWORD`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
4. Klik **Deploy**. Pengaturan `maxDuration = 60` pada `/api/analyze` sudah kompatibel dengan plan **Vercel Hobby** maupun **Pro**.
5. Setelah deploy selesai, buka menu **Pengaturan** di aplikasi untuk menyimpan saldo akun, target risiko (default `1%`), nilai per poin XAUUSD, dan ukuran lot minimum broker Anda.

## Memperbarui Strategi Trading

Lihat panduan lengkap di [`knowledge/README.md`](./knowledge/README.md) dan edit bagian placeholder pada [`knowledge/playbook.md`](./knowledge/playbook.md).

## Versi Android (Capacitor Debug APK)

Aplikasi ini juga mendukung pembungkusan UI statis menjadi **debug APK** Android lewat Capacitor tanpa mengubah deployment Vercel:

- UI statis di-export ke `out/` lewat `npm run build:mobile`, lalu disinkronkan ke `android/` dengan `npx cap sync android` (atau jalankan `npm run cap:sync`).
- Analisis AI tetap dipanggil ke server Vercel melalui `NEXT_PUBLIC_API_BASE_URL` (atau pengaturan URL server di dalam aplikasi), sehingga API key AI tetap aman di server.
- Lihat panduan lengkap langkah demi langkah di [`MOBILE.md`](./MOBILE.md).

---
> **Disclaimer:** Aplikasi ini hanyalah alat bantu analisis teknikal dan manajemen risiko, bukan nasihat keuangan atau jaminan profit.
