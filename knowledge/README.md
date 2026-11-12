# Knowledge & Playbook Strategi XAUUSD

Folder ini memisahkan **arsip ebook mentah** dari **aturan strategi ringkas** agar biaya token AI tetap hemat dan deployment Vercel tetap ramping.

## Struktur Folder

- `knowledge/playbook.md`  
  Ringkasan padat aturan trading yang **dibaca oleh server saat startup/build** melalui [`src/lib/playbook.ts`](../src/lib/playbook.ts) dan dikirim sebagai *system prompt* dengan *prompt caching*.
- `knowledge/source/`  
  Tempat menyimpan arsip ebook PDF (misalnya `pdf-crypto-trading-guide_compress.pdf`). Folder ini **TIDAK PERNAH** dibaca di runtime, tidak dikirim ke model AI, dan dikecualikan dari bundle Vercel via `outputFileTracingExcludes` di `next.config.ts`.

## Cara Memperbarui `playbook.md`

1. Distilasi poin inti dari ebook Anda secara offline (aturan entry, struktur, POI, invalidasi, filter sesi, dan manajemen risiko).
2. Buka `knowledge/playbook.md` dan ganti atau isi bagian **Catatan & Aturan Tambahan dari Ebook Pribadi (Placeholder)**.
3. **Jaga panjang `playbook.md` di bawah ~1.500 token** (sekitar 900–1.100 kata / ~5.500–6.500 karakter):
   - Gunakan heading dan bullet point pendek.
   - Hindari contoh cerita panjang atau teori dasar yang sudah dipahami model.
4. Simpan file, lalu jalankan ulang server dev (`npm run dev`) atau deploy ulang ke Vercel agar perubahan termuat.

## Catatan Privasi & Git

Jika repo Git Anda bersifat **publik** atau ebook PDF di `knowledge/source/` bukan milik Anda secara komersial, hapus tanda `#` pada baris `# knowledge/source/` di file `.gitignore`.

