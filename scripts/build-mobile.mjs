import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const apiDir = path.join(projectRoot, "src", "app", "api");
const backupDir = path.join(projectRoot, ".next-api-backup");
const backupApiDir = path.join(backupDir, "api");
const nextCacheDir = path.join(projectRoot, ".next");
const envMobilePath = path.join(projectRoot, ".env.mobile");

function loadEnvMobile() {
  const loaded = {};
  if (!fs.existsSync(envMobilePath)) {
    return loaded;
  }

  const raw = fs.readFileSync(envMobilePath, "utf8");
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) {
      loaded[key] = value;
    }
  }
  return loaded;
}

function main() {
  const envFromMobileFile = loadEnvMobile();
  const buildEnv = {
    ...envFromMobileFile,
    ...process.env,
    BUILD_TARGET: "mobile",
  };

  if (!buildEnv.NEXT_PUBLIC_API_BASE_URL) {
    console.warn(
      "[build:mobile] Peringatan: NEXT_PUBLIC_API_BASE_URL belum diisi di .env.mobile. Anda tetap bisa mengisinya nanti di menu Pengaturan dalam APK."
    );
  }

  // Pulihkan terlebih dahulu jika proses sebelumnya terhenti mendadak
  if (!fs.existsSync(apiDir) && fs.existsSync(backupApiDir)) {
    fs.renameSync(backupApiDir, apiDir);
  }

  const hasApiDir = fs.existsSync(apiDir);
  let movedApi = false;

  try {
    if (hasApiDir) {
      fs.mkdirSync(backupDir, { recursive: true });
      fs.renameSync(apiDir, backupApiDir);
      movedApi = true;
      console.log("[build:mobile] Memindahkan src/app/api sementara untuk static export...");
    }

    // Bersihkan cache .next agar typegen route API lama tidak memicu error TypeScript saat export
    if (fs.existsSync(nextCacheDir)) {
      fs.rmSync(nextCacheDir, { recursive: true, force: true });
    }

    const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
    const result = spawnSync(process.execPath, [nextBin, "build"], {
      cwd: projectRoot,
      env: buildEnv,
      stdio: "inherit",
    });

    if (result.error) {
      throw result.error;
    }

    if (typeof result.status === "number" && result.status !== 0) {
      process.exitCode = result.status;
    } else {
      console.log("[build:mobile] Static export mobile selesai di folder out/.");
    }
  } finally {
    if (movedApi && fs.existsSync(backupApiDir)) {
      fs.renameSync(backupApiDir, apiDir);
      console.log("[build:mobile] Folder src/app/api berhasil dikembalikan.");
    }
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    // Bersihkan .next hasil static export agar cache typegen tidak tertinggal untuk dev/build web
    const typesDir = path.join(nextCacheDir, "types");
    if (fs.existsSync(typesDir)) {
      fs.rmSync(typesDir, { recursive: true, force: true });
    }
  }
}

main();

