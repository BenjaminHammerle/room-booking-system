"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ShieldAlert, Globe, ShieldCheck } from "lucide-react";
import { APP_CONFIG, SUPPORTED_LANGS, Language } from "@/lib/constants";
import LoadingScreen from "@/app/components/LoadingScreen";
import "./login.css";

export default function LoginPage() {
  // states für formular und ui
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbTrans, setDbTrans] = useState<any>({});
  const [lang, setLang] = useState<Language>(APP_CONFIG.DEFAULT_LANG);
  const router = useRouter();

  // beim laden der seite sprache und übersetzungen initialisieren
  useEffect(() => {
    const savedLang = localStorage.getItem("rbs_lang") as Language;
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

  // übersetzung holen
  const t = (key: string) => dbTrans[key?.toLowerCase()]?.[lang] || key;

  // sprache wechseln
  const handleLangToggle = () => {
    const currentIndex = SUPPORTED_LANGS.indexOf(lang);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LANGS.length;
    const nextLang = SUPPORTED_LANGS[nextIndex];
    setLang(nextLang);
    localStorage.setItem("rbs_lang", nextLang);
  };

  // login durchführen
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

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="rbs-login-container">
      <div className="rbs-login-card animate-in zoom-in-95 duration-500">
        {/* header */}
        <div>
          <img src="/MCI.png" alt="MCI Logo" className="rbs-login-logo" />
          <h1 className="rbs-login-title">{t("login_title")}</h1>
          <p className="rbs-login-subtitle">{t("login_subtitle")}</p>
        </div>

        {/* formular */}
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

          {/* fehler anzeige */}
          {error && (
            <div className="rbs-login-error">
              <ShieldAlert size={16} />
              {error}
            </div>
          )}

          {/* submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rbs-login-button"
          >
            {isSubmitting ? "..." : t("login_button")}
          </button>
        </form>

        {/* footer mit sprach toggle */}
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