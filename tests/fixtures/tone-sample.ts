import type { PackageTone, Tone } from "@/lib/brand/tone";

/** Contoh tone of voice untuk tes dan pratinjau guideline; panjang teks mendekati batas skema. */
const L = (id: string, en: string) => ({ id, en });
const pkg = (v: "A" | "B"): PackageTone => ({
  summary: L(
    v === "A" ? "Hangat, rapi, dan dapat dipercaya: seperti rekan kerja berpengalaman yang menjelaskan hal rumit dengan bahasa sederhana tanpa terdengar menggurui atau terlalu kaku." : "Berani, lugas, dan bersemangat: suara yang mengajak pelanggan bergerak cepat, penuh energi, tetapi tetap sopan dan jelas di setiap pesan yang disampaikan.",
    v === "A" ? "Warm, tidy, and trustworthy: like an experienced colleague who explains complex things in simple words without sounding preachy or stiff." : "Bold, direct, and energetic: a voice that moves customers to act quickly, full of energy yet polite and clear in every message.",
  ),
  personality: [
    { trait: L("Dapat dipercaya", "Trustworthy"), desc: L("Selalu menyebut fakta dengan jelas, tidak melebih-lebihkan, dan menepati apa yang dijanjikan kepada pelanggan maupun mitra kerja di setiap kesempatan dan saluran komunikasi.", "Always states facts clearly, never exaggerates, and keeps every promise to customers and partners across every channel.") },
    { trait: L("Ramah", "Friendly"), desc: L("Menyapa dengan hangat, memakai kalimat yang terasa manusiawi, dan memberi ruang bagi pertanyaan tanpa membuat pelanggan merasa bodoh.", "Greets warmly, uses human sentences, and welcomes questions without making customers feel foolish.") },
    { trait: L("Cekatan", "Efficient"), desc: L("Langsung ke inti, memberi langkah yang jelas, dan menghargai waktu pembaca.", "Gets to the point, gives clear steps, and respects the reader's time.") },
  ],
  voice: {
    address: L("Menyapa pelanggan dengan \"Anda\"; perusahaan menyebut dirinya \"kami\".", "Addresses customers as \"you\"; the company calls itself \"we\"."),
    formality: v === "A" ? "semi-formal" : "semi-casual",
    sentences: L("Kalimat pendek sampai sedang, satu gagasan per kalimat, kata kerja aktif, istilah teknis dijelaskan singkat bila perlu.", "Short to medium sentences, one idea each, active verbs, technical terms briefly explained when needed."),
  },
  do: [
    L("Pakai kata kerja aktif dan langsung sebutkan manfaat bagi pelanggan.", "Use active verbs and state the customer benefit directly."),
    L("Jelaskan istilah teknis dengan contoh sehari-hari yang mudah dibayangkan.", "Explain technical terms with everyday examples."),
    L("Tutup pesan dengan langkah berikutnya yang jelas.", "End messages with a clear next step."),
    L("Gunakan angka hanya bila datanya benar dan bisa dibuktikan.", "Use numbers only when the data is accurate and verifiable."),
  ],
  dont: [
    L("Memakai jargon atau singkatan tanpa penjelasan.", "Using jargon or abbreviations without explanation."),
    L("Klaim berlebihan seperti \"terbaik\" atau \"nomor satu\".", "Overclaiming with words like \"best\" or \"number one\"."),
    L("Kalimat panjang yang memuat lebih dari dua gagasan sekaligus sehingga sulit diikuti pembaca.", "Long sentences with more than two ideas that are hard to follow."),
  ],
  examples: {
    taglines: v === "A" ? [L("Teknologi yang bekerja untuk Anda", "Technology that works for you"), L("Rapi hari ini, siap untuk esok", "Tidy today, ready for tomorrow")] : [L("Bergerak lebih cepat, bersama kami", "Move faster, together"), L("Berani tumbuh mulai hari ini", "Dare to grow today")],
    emailOpening: L("Halo Bapak/Ibu, terima kasih sudah menghubungi kami. Berikut jawaban singkat atas pertanyaan Anda, beserta langkah yang bisa langsung dicoba hari ini.", "Hello, thank you for reaching out. Here is a short answer to your question, with steps you can try today."),
    cta: L("Jadwalkan konsultasi gratis minggu ini", "Book a free consultation this week"),
    about: L(
      "Kami membantu perusahaan menata proses bisnis dengan teknologi yang tepat guna. Tim kami mendampingi dari perencanaan, penerapan, sampai pelatihan, sehingga setiap sistem benar-benar dipakai dan memberi hasil. Kami percaya teknologi yang baik terasa sederhana bagi penggunanya, dan karena itu kami selalu mulai dari kebutuhan nyata di lapangan sebelum memilih solusi apa pun.",
      "We help companies organize their business processes with the right technology. Our team supports you from planning and implementation to training, so every system is actually used and delivers results. We believe good technology feels simple, so we always start from real needs before choosing any solution.",
    ),
  },
});
export const TONE_SAMPLE: Tone = { A: pkg("A"), B: pkg("B"), basis: L("Dari logo bergaya geometris yang rapi dan bidang usaha teknologi informasi yang menuntut kepercayaan.", "From a tidy geometric logo and an IT industry that demands trust.") };
