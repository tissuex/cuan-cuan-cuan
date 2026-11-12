# Panduan Build Android Debug APK — Gold Chart Analyzer

Dokumen ini menjelaskan langkah berurutan untuk membungkus UI **Gold Chart Analyzer** menjadi **debug APK** Android untuk pemakaian pribadi menggunakan Capacitor. Analisis AI tetap berjalan di server Vercel Anda sehingga API key AI tidak pernah masuk ke dalam APK.

---

## 1. Prasyarat

Pastikan perangkat Anda memiliki komponen berikut:

1. **Node.js** (disarankan v20+ LTS) dan **npm**
2. **JDK 17** (atau versi JDK yang didukung Gradle pada Android Studio Anda)
3. **Android Studio** beserta **Android SDK** dan **Android SDK Build-Tools** (diinstal melalui **Settings > Languages & Frameworks > Android SDK** di Android Studio)
4. **Backend Vercel sudah aktif** (aplikasi web ini sudah Anda deploy ke Vercel dengan URL HTTPS)

---

## 2. Konfigurasi `.env.mobile` & CORS Server

1. Salin file contoh `.env.mobile.example` menjadi `.env.mobile` di root proyek:
   ```bash
   cp .env.mobile.example .env.mobile
   ```
   *(Di Windows PowerShell: `Copy-Item .env.mobile.example .env.mobile`)*

2. Buka `.env.mobile` dan isi `NEXT_PUBLIC_API_BASE_URL` dengan URL deployment Vercel Anda (tanpa tanda `/` di akhir):
   ```env
   NEXT_PUBLIC_API_BASE_URL=https://nama-proyek-anda.vercel.app
   ```
   > **Catatan keamanan:** File `.env.mobile` diabaikan oleh Git (`.gitignore`) dan **jangan pernah** menaruh `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`, atau `APP_PASSWORD` di file ini. Variabel `NEXT_PUBLIC_*` akan masuk ke bundle statis APK.
   > Anda juga bisa mengubah atau menguji ulang URL server Vercel kapan saja langsung dari menu **Pengaturan** di dalam aplikasi Android tanpa membangun ulang APK.

3. **CORS di Vercel:** Route Handler (`/api/analyze` dan `/api/config`) sudah mengizinkan origin Capacitor (`https://localhost` dan `capacitor://localhost`) serta domain Vercel bawaan. Jika Anda memakai domain custom di Vercel, tambahkan domain tersebut ke Environment Variable `ALLOWED_ORIGINS` di dashboard Vercel (pisahkan dengan koma bila lebih dari satu).

4. Jika `APP_PASSWORD` diaktifkan di Vercel, masukkan password yang sama di halaman **Pengaturan** atau kolom password di aplikasi Android (disimpan lokal menggunakan Capacitor Preferences, dikirim melalui header `Authorization: Bearer ...`).

---

## 3. Build Static Export & Sinkronisasi ke Android

Jalankan perintah berikut dari root proyek:

1. Pastikan dependensi sudah terpasang:
   ```bash
   npm install
   ```
2. Build UI statis untuk mobile ke folder `out/`:
   ```bash
   npm run build:mobile
   ```
   Script `scripts/build-mobile.mjs` akan memindahkan `src/app/api` untuk sementara, menjalankan `next build` dengan `BUILD_TARGET=mobile` (`output: "export"`), lalu selalu mengembalikan `src/app/api` ke tempat semula.
3. Sinkronkan hasil `out/` dan konfigurasi Capacitor ke folder `android/`:
   ```bash
   npx cap sync android
   ```
   *(Tips: Anda bisa menjalankan kedua langkah di atas sekaligus dengan perintah `npm run cap:sync`.)*

---

## 4. Membuat Debug APK

Pilih salah satu cara berikut untuk menghasilkan file debug APK:

### Cara A — Lewat Android Studio
1. Buka proyek Android dari root repo dengan menjalankan:
   ```bash
   npx cap open android
   ```
   *(Atau buka Android Studio lalu pilih **File > Open** dan arahkan ke folder `android/`.)*
2. Tunggu hingga proses **Gradle Sync** selesai.
3. Klik menu **Build > Build Bundle(s) / APK(s) > Build APK(s)** (atau **Build > Build APK**).

### Cara B — Lewat Terminal (Gradle)
- **macOS / Linux:**
  ```bash
  cd android
  ./gradlew assembleDebug
  ```
- **Windows (PowerShell / CMD):**
  ```powershell
  cd android
  .\gradlew.bat assembleDebug
  ```

### Lokasi File Debug APK
Setelah proses build selesai, file APK berada di:
```text
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 5. Memasang APK ke HP Android

### Cara A — Transfer File ke HP
1. Salin file `android/app/build/outputs/apk/debug/app-debug.apk` ke HP Anda (via kabel USB, Google Drive pribadi, atau media transfer lain).
2. Buka file APK tersebut dari aplikasi File Manager di HP Android Anda.
3. Jika muncul permintaan izin keamanan, aktifkan opsi **"Instal dari sumber tidak dikenal"** (*Install unknown apps*) untuk File Manager yang digunakan.
4. Ketuk **Instal**, lalu buka aplikasi **Gold Chart Analyzer**.

### Cara B — Lewat ADB (USB Debugging)
1. Aktifkan **Developer Options** dan **USB Debugging** pada HP Android Anda, lalu hubungkan ke komputer lewat kabel USB.
2. Jalankan perintah berikut dari root proyek:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 6. Saat Memperbarui Aplikasi Web / UI

Setiap kali Anda mengubah halaman UI atau mengganti nilai default di `.env.mobile`:
```bash
npm run cap:sync
```
Setelah itu bangun ulang debug APK melalui Android Studio atau `gradlew assembleDebug`. Perubahan pada logika server atau prompt playbook di Vercel tidak memerlukan rebuild APK.

