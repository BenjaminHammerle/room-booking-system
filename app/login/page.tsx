"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ShieldAlert, Globe, ShieldCheck } from "lucide-react";
import { APP_CONFIG, SUPPORTED_LANGS, Language } from "@/lib/constants";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbTrans, setDbTrans] = useState<any>({});
  const [lang, setLang] = useState<Language>(APP_CONFIG.DEFAULT_LANG);
  const router = useRouter();

  useEffect(() => {
    // Sprache priorisiert aus localStorage laden (Heiliges Gebot 1)
    const savedLang = localStorage.getItem("mci_lang") as Language;
    if (SUPPORTED_LANGS.includes(savedLang)) setLang(savedLang);

    async function initLogin() {
      const { data } = await supabase.from("translations").select("*");
      if (data) {
        const tMap: any = {};
        data.forEach((item) => (tMap[item.key.toLowerCase()] = item));
        setDbTrans(tMap);
      }
      setLoading(false);
    }
    initLogin();
  }, []);

  const t = (key: string) => dbTrans[key?.toLowerCase()]?.[lang] || key;

  // Generischer Sprach-Toggle (Bibel Punkt 1)
  const handleLangToggle = () => {
    const currentIndex = SUPPORTED_LANGS.indexOf(lang);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LANGS.length;
    const nextLang = SUPPORTED_LANGS[nextIndex];
    setLang(nextLang);
    localStorage.setItem("mci_lang", nextLang);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(t("login_error_prefix") + ": " + error.message);
      setIsSubmitting(false);
    } else {
      router.refresh();
      // Kurzer Delay stellt sicher, dass der localStorage-Sync abgeschlossen ist
      setTimeout(() => router.push("/rooms"), 100);
    }
  };

  if (loading)
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FB] text-[#004a87] font-black italic animate-pulse">
        <ShieldCheck size={80} className="mb-6 text-[#549BB7]" />
        <span>mci system check...</span>
      </div>
    );

  return (
    <div className="mci-login-container">
      <div className="mci-login-card animate-in zoom-in-95 duration-500 shadow-orange-900/5">
        <div className="mci-login-header">
          <img src="/MCI.png" alt="MCI Logo" className="mci-login-logo" />
          <h1 className="mci-login-title">{t("login_title")}</h1>
          <p className="mci-login-subtitle">{t("login_subtitle")}</p>
        </div>

        <form onSubmit={handleLogin} className="mci-login-form">
          <div className="space-y-1">
            <label className="mci-login-label">{t("login_email_label")}</label>
            <input
              type="email"
              className="mci-login-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login_email_placeholder")}
            />
          </div>

          <div className="space-y-1">
            <label className="mci-login-label">
              {t("login_password_label")}
            </label>
            <input
              type="password"
              className="mci-login-input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login_password_placeholder")}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 p-4 rounded-2xl border border-red-100 italic">
              <ShieldAlert size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mci-login-button mci-ui-toggle"
          >
            {isSubmitting ? "..." : t("login_button")}
          </button>
        </form>

        <div className="mci-login-footer">
          <button
            onClick={handleLangToggle}
            className="lang-toggle-btn mci-ui-toggle"
          >
            <Globe size={14} /> {lang.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
