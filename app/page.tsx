import AppHeader from "@/app/_components/app-header";
import { requireUser } from "@/lib/auth/server";

export default async function Home() {
  const { user } = await requireUser();
  return (
    <>
      <AppHeader user={user} />
      <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 16px" }}>
        <h1 style={{ letterSpacing: "-0.02em" }}>Halo, {user.name || user.email}</h1>
        <p style={{ color: "var(--muted)" }}>
          Form pembuatan brand package akan tersedia di tahap berikutnya.
        </p>
      </main>
    </>
  );
}
