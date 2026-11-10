// Atur atau ganti password super admin (SPEC bagian 2).
// Pemakaian:  npm run admin:set-password -- dev    (prefiks bpa:dev:, untuk lokal)
//             npm run admin:set-password -- prod   (prefiks bpa:prod:, untuk Vercel production)
// Email, nama, dan password diminta lewat prompt; password tidak ditampilkan,
// tidak ditulis ke file, dan tidak dicatat. Kredensial Upstash dibaca dari .env.local.
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

const target = process.argv[2];
if (target !== "dev" && target !== "prod") {
  console.error("Pilih target: npm run admin:set-password -- dev   atau   -- prod");
  process.exit(1);
}
// Prefiks kunci mengikuti target, bukan environment mesin ini.
delete process.env.VERCEL_ENV;
process.env.APP_ENV = target === "prod" ? "production" : "development";

const { redis, key, keyPrefix } = await import("../lib/redis.ts");
const { UserStore } = await import("../lib/auth/users.ts");
const { SessionStore } = await import("../lib/auth/sessions.ts");
const { isValidEmail, passwordProblem } = await import("../lib/auth/validate.ts");

let muted = false;
const out = new Writable({
  write(chunk, _enc, cb) {
    if (!muted) process.stdout.write(chunk);
    cb();
  },
});
const rl = createInterface({ input: process.stdin, output: out, terminal: Boolean(process.stdin.isTTY) });
const queued: string[] = [];
const waiting: ((line: string) => void)[] = [];
rl.on("line", (line) => (waiting.length ? waiting.shift()!(line) : queued.push(line)));
rl.on("close", () => waiting.splice(0).forEach((w) => w("")));
function ask(q: string): Promise<string> {
  process.stdout.write(q);
  return queued.length ? Promise.resolve(queued.shift()!) : new Promise((res) => waiting.push(res));
}
async function askHidden(q: string): Promise<string> {
  muted = true;
  const v = await ask(q);
  muted = false;
  process.stdout.write("\n");
  return v;
}

try {
  console.log(`Target: ${target} (prefiks ${keyPrefix()}:)`);
  const email = (await ask("Email super admin: ")).trim().toLowerCase();
  if (!isValidEmail(email)) throw new Error("Format email tidak valid.");
  const name = (await ask("Nama (boleh kosong): ")).trim();
  const pw = await askHidden("Password baru: ");
  const problem = passwordProblem(pw);
  if (problem) throw new Error(problem);
  if ((await askHidden("Ulangi password: ")) !== pw) throw new Error("Password tidak sama.");
  if (target === "prod" && (await ask("Tulis 'prod' untuk konfirmasi ke production: ")).trim() !== "prod") {
    throw new Error("Dibatalkan.");
  }

  const store = new UserStore(redis(), key);
  const { user, created } = await store.upsertSuperAdmin(email, name, pw);
  // Hentikan sesi lama super admin. SESSION_SECRET tidak diperlukan untuk menghapus.
  await new SessionStore(redis(), key, "x".repeat(32)).destroyAllForUser(user.id);
  console.log(`${created ? "Super admin dibuat" : "Password super admin diganti"}: ${user.email}`);
} catch (e) {
  console.error(`Gagal: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
