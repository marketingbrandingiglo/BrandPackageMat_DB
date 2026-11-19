import { redis, APP_KEY_PREFIX } from "@/lib/redis";
import { requireEnv } from "@/lib/env";
import { open, seal } from "./crypto";

/**
 * Penyimpanan file di Google Drive pemilik (SPEC bagian 8), lewat REST API dengan scope
 * `drive.file`: aplikasi hanya melihat file yang ia buat sendiri. Satu sambungan dipakai
 * bersama oleh dev, production, dan sesi pekerja; foldernya terpisah per environment.
 *
 * Struktur: "Brand Package Automation" / dev|prod / <id job: tanggal-acak> / file.
 * Dipakai oleh server aplikasi dan skrip pekerja (bukan komponen klien).
 */

export const SCOPE = "https://www.googleapis.com/auth/drive.file";
export const ROOT_FOLDER = "Brand Package Automation";
const FOLDER_MIME = "application/vnd.google-apps.folder";

// Alamat bisa ditimpa hanya untuk tes lokal (server tiruan).
const AUTH_URL = () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const API = () => process.env.GOOGLE_DRIVE_API || "https://www.googleapis.com";

/** Kunci bersama (tanpa prefiks environment): satu sambungan Drive untuk dev dan production. */
const sharedKey = (...parts: string[]) => [APP_KEY_PREFIX, "shared", "drive", ...parts].join(":");

export class DriveNotConnected extends Error {
  constructor(msg = "Google Drive belum dihubungkan. Super admin: buka Admin, lalu Hubungkan Google Drive.") {
    super(msg);
  }
}
export class DriveError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

interface StoredToken {
  refresh: string;
  email?: string;
  connectedAt: string;
}

/* ---------------- OAuth ---------------- */

export function authUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `${AUTH_URL()}?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: requireEnv("GOOGLE_CLIENT_ID"), client_secret: requireEnv("GOOGLE_CLIENT_SECRET"), ...body }),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
  return { ok: res.ok, ...j };
}

/** Tukar kode dari Google dengan refresh token, lalu simpan terenkripsi. */
export async function connectWithCode(code: string, redirectUri: string): Promise<{ email?: string }> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  if (!t.ok || !t.refresh_token || !t.access_token) throw new DriveError(400, `Google menolak sambungan (${t.error ?? "tanpa refresh token"}).`);
  if (t.scope && !t.scope.split(" ").includes(SCOPE)) throw new DriveError(400, "Izin akses Drive tidak diberikan. Centang izin Google Drive saat menghubungkan.");
  cached = { token: t.access_token, until: Date.now() + ((t.expires_in ?? 3600) - 120) * 1000 };
  const email = await aboutEmail().catch(() => undefined);
  const stored: StoredToken = { refresh: t.refresh_token, email, connectedAt: new Date().toISOString() };
  await redis().set(sharedKey("token"), seal(JSON.stringify(stored)));
  await redis().del(sharedKey("folders"));
  return { email };
}

export async function disconnect(): Promise<void> {
  cached = null;
  await redis().del(sharedKey("token"), sharedKey("folders"));
}

async function stored(): Promise<StoredToken | null> {
  const s = await redis().get<string>(sharedKey("token"));
  if (!s) return null;
  return JSON.parse(open(s)) as StoredToken;
}

let cached: { token: string; until: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const st = await stored();
  if (!st) throw new DriveNotConnected();
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: st.refresh });
  if (!t.ok || !t.access_token) {
    if (t.error === "invalid_grant") throw new DriveNotConnected("Izin Google Drive sudah tidak berlaku. Super admin: hubungkan ulang Google Drive di halaman Admin.");
    throw new DriveError(502, `Gagal memperbarui akses Google Drive (${t.error ?? "tanpa keterangan"}).`);
  }
  cached = { token: t.access_token, until: Date.now() + ((t.expires_in ?? 3600) - 120) * 1000 };
  return t.access_token;
}

/* ---------------- REST ---------------- */

async function call(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const res = await fetch(`${API()}${path}`, { ...init, headers: { ...init.headers, authorization: `Bearer ${await accessToken()}` } });
  if (res.status === 401 && retry) {
    cached = null;
    return call(path, init, false);
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new DriveError(res.status, `Google Drive ${res.status}: ${j?.error?.message ?? res.statusText}`);
  }
  return res;
}

async function aboutEmail(): Promise<string | undefined> {
  const j = (await (await call("/drive/v3/about?fields=user(emailAddress)")).json()) as { user?: { emailAddress?: string } };
  return j.user?.emailAddress;
}

export interface DriveStatus {
  connected: boolean;
  email?: string;
  connectedAt?: string;
  usage?: number;
  limit?: number;
  error?: string;
}

export async function driveStatus(): Promise<DriveStatus> {
  let st: StoredToken | null;
  try {
    st = await stored();
  } catch {
    return { connected: false, error: "Token tersimpan tidak bisa dibuka (DRIVE_TOKEN_SECRET berbeda?). Hubungkan ulang." };
  }
  if (!st) return { connected: false };
  try {
    const j = (await (await call("/drive/v3/about?fields=user(emailAddress),storageQuota(limit,usage)")).json()) as {
      user?: { emailAddress?: string };
      storageQuota?: { limit?: string; usage?: string };
    };
    return {
      connected: true,
      email: j.user?.emailAddress ?? st.email,
      connectedAt: st.connectedAt,
      usage: j.storageQuota?.usage ? Number(j.storageQuota.usage) : undefined,
      limit: j.storageQuota?.limit ? Number(j.storageQuota.limit) : undefined,
    };
  } catch (e) {
    return { connected: false, email: st.email, connectedAt: st.connectedAt, error: (e as Error).message };
  }
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function findFolder(name: string, parent: string | null): Promise<string | null> {
  const where = [`name = '${q(name)}'`, `mimeType = '${FOLDER_MIME}'`, "trashed = false", parent ? `'${parent}' in parents` : "'root' in parents"].join(" and ");
  const j = (await (await call(`/drive/v3/files?${new URLSearchParams({ q: where, fields: "files(id)", pageSize: "1" })}`)).json()) as { files: { id: string }[] };
  return j.files[0]?.id ?? null;
}

export async function createFolder(name: string, parent: string | null): Promise<string> {
  const j = (await (
    await call("/drive/v3/files?fields=id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }),
    })
  ).json()) as { id: string };
  return j.id;
}

/** Folder environment ("dev"/"prod") di bawah folder aplikasi; ID di-cache di Redis. */
export async function envFolder(env: "dev" | "prod"): Promise<string> {
  const cacheKey = sharedKey("folders");
  const hit = await redis().hget<string>(cacheKey, env);
  if (hit) return hit;
  const root = (await findFolder(ROOT_FOLDER, null)) ?? (await createFolder(ROOT_FOLDER, null));
  const id = (await findFolder(env, root)) ?? (await createFolder(env, root));
  await redis().hset(cacheKey, { [env]: id });
  return id;
}

export async function forgetFolderCache(): Promise<void> {
  await redis().del(sharedKey("folders"));
}

export interface DriveFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

export async function upload(folderId: string, name: string, mimeType: string, data: Buffer): Promise<DriveFile> {
  const boundary = `bpa${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name, parents: [folderId], mimeType });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: ${mimeType}\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const j = (await (
    await call("/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType", {
      method: "POST",
      headers: { "content-type": `multipart/related; boundary=${boundary}` },
      body: new Uint8Array(body),
    })
  ).json()) as { id: string; name: string; size?: string; mimeType: string };
  return { id: j.id, name: j.name, size: Number(j.size ?? data.length), mimeType: j.mimeType };
}

export async function download(id: string): Promise<Buffer> {
  return Buffer.from(await (await call(`/drive/v3/files/${encodeURIComponent(id)}?alt=media`)).arrayBuffer());
}

/** Hapus permanen (tidak lewat Trash). Folder: seluruh isinya ikut terhapus. */
export async function remove(id: string): Promise<void> {
  try {
    await call(`/drive/v3/files/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return;
    throw e;
  }
}

/** Folder anak yang dibuat sebelum `before` (untuk pembersihan 90 hari). */
export async function foldersOlderThan(parent: string, before: Date): Promise<{ id: string; name: string; createdTime: string }[]> {
  const out: { id: string; name: string; createdTime: string }[] = [];
  let pageToken = "";
  do {
    const where = `'${parent}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false and createdTime < '${before.toISOString()}'`;
    const p = new URLSearchParams({ q: where, fields: "nextPageToken,files(id,name,createdTime)", pageSize: "100", ...(pageToken ? { pageToken } : {}) });
    const j = (await (await call(`/drive/v3/files?${p}`)).json()) as { nextPageToken?: string; files: { id: string; name: string; createdTime: string }[] };
    out.push(...j.files);
    pageToken = j.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

/** Origin yang dibuka browser (Host / X-Forwarded-*), untuk redirect URI OAuth. */
export function requestOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  const proto = h.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}
