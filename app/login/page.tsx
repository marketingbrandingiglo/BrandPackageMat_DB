import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { APP_VERSION } from "@/lib/version";
import LoginForm from "./login-form";
import styles from "./login.module.css";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Image src="/logo-iglo.png" alt="iglo" width={102} height={82} priority className={styles.logo} />
        <h1 className={styles.title}>Automation Brand Package</h1>
        <LoginForm />
        <p className={styles.help}>Lupa password atau akun terkunci? Hubungi admin.</p>
        <p className={styles.version}>Version {APP_VERSION}</p>
      </div>
    </main>
  );
}
