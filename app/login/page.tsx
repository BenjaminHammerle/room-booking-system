"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ShieldAlert, Globe, ShieldCheck } from "lucide-react";
import { APP_CONFIG, SUPPORTED_LANGS, Language } from "@/lib/constants";
import LoadingScreen from "@/app/components/LoadingScreen";
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
    // Sprache priorisiert aus localStorage laden
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

  // Generischer Sprach-Toggle
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
      setTimeout(() => router.push("/rooms"), 100);
    }
  };

  // LOADING STATE - nutzt rbs-login-loading
  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="rbs-login-container">
      <div className="rbs-login-card animate-in zoom-in-95 duration-500">
        {/* HEADER */}
        <div>
          <img src="/MCI.png" alt="MCI Logo" className="rbs-login-logo" />
          <h1 className="rbs-login-title">{t("login_title")}</h1>
          <p className="rbs-login-subtitle">{t("login_subtitle")}</p>
        </div>

        {/* FORM - nutzt globale rbs-input und rbs-label */}
        <form onSubmit={handleLogin} className="rbs-login-form">
          <div className="space-y-1">
            <label className="rbs-label">{t("login_email_label")}</label>
            <input
              type="email"
              className="rbs-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login_email_placeholder")}
            />
          </div>

          <div className="space-y-1">
            <label className="rbs-label">{t("login_password_label")}</label>
            <input
              type="password"
              className="rbs-input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login_password_placeholder")}
            />
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="rbs-login-error">
              <ShieldAlert size={16} />
              {error}
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rbs-login-button"
          >
            {isSubmitting ? "..." : t("login_button")}
          </button>
        </form>

        {/* FOOTER - nutzt globale lang-toggle-btn */}
        <div className="rbs-login-footer">
          <button onClick={handleLangToggle} className="lang-toggle-btn">
            <Globe size={14} />
            {lang.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
