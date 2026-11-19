import "server-only";

/**
 * Membangunkan sesi pekerja Claude: komentar 🛎️ berisi ID job saja di PR saluran kontrol
 * (SPEC bagian 8; repo publik, jadi tanpa nama perusahaan atau data lain).
 * Tanpa GITHUB_TOKEN/CONTROL_PR (mis. lokal), tidak ada bel: minta pekerja memproses manual.
 */
export function bellConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN && process.env.CONTROL_PR);
}

export async function ring(env: "dev" | "prod", jobId: string): Promise<boolean> {
  if (!bellConfigured()) return false;
  const repo = process.env.GITHUB_REPO || "marketingbrandingiglo/BrandPackageMat_DB";
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${process.env.CONTROL_PR}/comments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
    },
    body: JSON.stringify({ body: `🛎️ job ${env}/${jobId}` }),
  });
  if (!res.ok) console.error(`Bel gagal: GitHub ${res.status}`);
  return res.ok;
}
