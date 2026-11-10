import pkg from "../package.json";

/**
 * Versi aplikasi berformat MAJOR.MINOR (tanpa patch), mis. "1.0".
 * Sumber tunggal: `version` di package.json (npm mewajibkan semver, jadi
 * disimpan "MAJOR.MINOR.0" dan angka patch dibuang saat ditampilkan).
 */
export function formatVersion(semver: string): string {
  const m = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(semver);
  if (!m) throw new Error(`Versi tidak valid: ${semver}`);
  return `${m[1]}.${m[2]}`;
}

/** Hitung versi berikutnya. Minor adalah default; major untuk perubahan alur. */
export function bumpVersion(current: string, kind: "minor" | "major" = "minor"): string {
  const [major, minor] = formatVersion(current).split(".").map(Number);
  return kind === "major" ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

export const APP_VERSION = formatVersion(pkg.version);
