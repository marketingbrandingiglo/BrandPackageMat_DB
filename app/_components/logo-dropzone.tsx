"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./logo-dropzone.module.css";

/**
 * Area upload logo: klik, drag & drop, atau tempel (Cmd/Ctrl + V).
 * File dimasukkan ke <input type="file" name={name}> sehingga ikut terkirim bersama form.
 * Pengecekan di sini hanya pengecekan awal; server tetap memeriksa isi file.
 */
export interface LogoDropzoneProps {
  name: string;
  maxBytes: number;
  onChange?: (file: File | null) => void;
  disabled?: boolean;
}

const ACCEPT = ".svg,.png,image/svg+xml,image/png";

function kindOf(f: File): "png" | "svg" | null {
  const n = f.name.toLowerCase();
  if (f.type === "image/png" || n.endsWith(".png")) return "png";
  if (f.type === "image/svg+xml" || n.endsWith(".svg")) return "svg";
  return null;
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} byte`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  const mb = n / 1024 / 1024;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

/** Teks yang tampak seperti SVG (mis. "Copy as SVG" dari Figma/Illustrator). */
const looksLikeSvg = (t: string) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(t);

export default function LogoDropzone({ name, maxBytes, onChange, disabled }: LogoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const accept = useCallback(
    (f: File | null, note?: string) => {
      setMessage(note ?? null);
      if (f && !kindOf(f)) {
        setMessage(`"${f.name}" bukan SVG atau PNG.`);
        f = null;
      } else if (f && f.size > maxBytes) {
        setMessage(`Ukuran file ${fmtBytes(f.size)} melebihi ${fmtBytes(maxBytes)}.`);
        f = null;
      } else if (f && f.size === 0) {
        setMessage("File kosong.");
        f = null;
      }
      const input = inputRef.current;
      if (input) {
        const dt = new DataTransfer();
        if (f) dt.items.add(f);
        input.files = dt.files;
      }
      setFile(f);
      setPreview(f ? URL.createObjectURL(f) : null);
      onChange?.(f);
    },
    [maxBytes, onChange],
  );

  // React mereset form setelah server action selesai, termasuk <input type="file">.
  // Pasang kembali file yang sedang dipilih supaya tombol berikutnya tetap mengirim logo.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () =>
      setTimeout(() => {
        const input = inputRef.current;
        if (!input || !file) return;
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      }, 0);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [file]);

  // Tempel dari clipboard di mana saja di halaman, kecuali saat sedang mengetik di kolom teks.
  useEffect(() => {
    if (disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const cd = e.clipboardData;
      if (!cd) return;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
      const img = Array.from(cd.files).find((f) => f.type === "image/png" || f.type === "image/svg+xml");
      if (img) {
        e.preventDefault();
        const ext = img.type === "image/png" ? "png" : "svg";
        const named = img.name && img.name !== "image.png" ? img : new File([img], `tempel-${stamp}.${ext}`, { type: img.type });
        accept(named, ext === "png" ? "Gambar ditempel sebagai PNG. Bila tersedia, SVG asli memberi hasil terbaik." : undefined);
        return;
      }
      if (cd.files.length) {
        e.preventDefault();
        accept(cd.files[0]);
        return;
      }
      const text = cd.getData("image/svg+xml") || cd.getData("text/plain");
      if (text && looksLikeSvg(text)) {
        e.preventDefault();
        accept(new File([text], `tempel-${stamp}.svg`, { type: "image/svg+xml" }));
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [accept, disabled]);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      className={styles.zone}
      data-dragging={dragging || undefined}
      data-filled={file ? true : undefined}
      data-disabled={disabled || undefined}
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (!files.length) return;
        accept(files[0], files.length > 1 ? `Hanya satu logo yang dipakai: "${files[0].name}".` : undefined);
      }}
    >
      <input
        ref={inputRef}
        id={`${name}-input`}
        type="file"
        name={name}
        accept={ACCEPT}
        className={styles.input}
        disabled={disabled}
        onChange={(e) => accept(e.target.files?.[0] ?? null)}
      />

      {dragging ? (
        <div className={styles.dropHint}>Lepaskan untuk mengunggah</div>
      ) : file ? (
        <div className={styles.filled}>
          <div className={styles.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview && <img src={preview} alt="" />}
          </div>
          <div className={styles.meta}>
            <strong>{file.name}</strong>
            <span>
              {kindOf(file)?.toUpperCase()} · {fmtBytes(file.size)}
            </span>
          </div>
          <div className={styles.actions}>
            <label htmlFor={`${name}-input`} className="btn btn-secondary">Ganti</label>
            <button type="button" className="btn btn-ghost" onClick={() => accept(null)} disabled={disabled}>Hapus</button>
          </div>
        </div>
      ) : (
        <label htmlFor={`${name}-input`} className={styles.empty}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V4M7 9l5-5 5 5" />
            <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          <span className={styles.title}>Seret logo ke sini atau klik untuk memilih</span>
          <span className={styles.sub}>SVG atau PNG, maks {fmtBytes(maxBytes)} · bisa juga tempel dengan Cmd/Ctrl + V</span>
        </label>
      )}

      {message && <p className={styles.message} role="status">{message}</p>}
    </div>
  );
}
