import AppHeader from "@/app/_components/app-header";
import { requireUser } from "@/lib/auth/server";
import { INDUSTRIES } from "@/lib/brand/industries";
import { SPECS } from "@/lib/brand/specs";
import { getDict, getLang } from "@/lib/i18n/server";
import BrandForm from "./brand-form";
import styles from "./home.module.css";

export default async function Home() {
  const { user } = await requireUser();
  const lang = await getLang();
  const t = await getDict();
  const industries = INDUSTRIES.map((x) => ({ id: x.id, label: lang === "en" ? x.en_label : x.id_label, freeText: x.freeText }));
  return (
    <>
      <AppHeader user={user} lang={lang} />
      <main className={styles.main}>
        <p className="eyebrow">{t.home.eyebrow}</p>
        <h1 className={styles.h1}>{t.home.title}</h1>
        <p className={styles.lead}>{t.home.lead}</p>
        <BrandForm lang={lang} industries={industries} maxBytes={SPECS.logo.maxFileBytes} />
      </main>
    </>
  );
}
