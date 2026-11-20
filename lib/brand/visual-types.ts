/**
 * Tipe visual dekoratif (Tahap 5) yang aman dipakai di komponen klien.
 */
export type VisualPkg = "A" | "B";

export interface VisualAsset {
  /** Nama file SVG di folder job (Drive). */
  file: string;
  /** PNG pratinjau di folder job. */
  preview: string;
  /** Konsep singkat dari Claude. */
  concept: { id: string; en: string };
  /** Diambil dari cache (aset sama untuk logo + palet + paket yang sama). */
  cached?: boolean;
}

export interface VisualTask {
  status: "queued" | "working" | "done" | "failed";
  step?: string;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  belled?: boolean;
  /** Kunci cache per paket (hash logo + palet paket + versi). */
  keys: Record<VisualPkg, string>;
  /** Jumlah penyimpanan yang ditolak validator per paket (maks. VISUAL_MAX_ATTEMPTS). */
  attempts: Record<VisualPkg, number>;
  /** null = gagal setelah batas percobaan; materi paket itu dibuat tanpa aset. */
  result?: Partial<Record<VisualPkg, VisualAsset | null>>;
  notes?: string[];
}

export const VISUAL_MAX_ATTEMPTS = 3;
