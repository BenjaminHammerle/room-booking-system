'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import './login.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbTrans, setDbTrans] = useState<any>({});
  const [lang, setLang] = useState<'de' | 'en'>('de');
  const router = useRouter();

  // Texte aus DB laden
  useEffect(() => {
    async function fetchTranslations() {
      const { data } = await supabase.from('translations').select('*');
      if (data) {
        const tMap: any = {};
        data.forEach((item) => {
          tMap[item.key] = { de: item.de, en: item.en };
        });
        setDbTrans(tMap);
      }
    }
    fetchTranslations();
  }, []);

  const t = (key: string) => dbTrans[key]?.[lang] || key;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(t('login_error_prefix') + error.message);
      setLoading(false);
    } else {
      router.refresh();
      setTimeout(() => {
        router.push('/rooms');
      }, 100);
    }
  };

  return (
    <div className="mci-login-container">
      <div className="mci-login-card">
        
        {/* Header Bereich */}
        <div className="mci-login-header">
          <img src="/MCI.png" alt="MCI Logo" className="mci-login-logo" />
          <h1 className="mci-login-title">{t('login_title')}</h1>
          <p className="mci-login-subtitle">{t('login_subtitle')}</p>
        </div>

        {/* Formular Bereich */}
        <form onSubmit={handleLogin} className="mci-login-form">
          <div>
            <label className="mci-login-label">{t('login_email_label')}</label>
            <input 
              type="email" 
              className="mci-login-input"
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login_email_placeholder')}
            />
          </div>

          <div>
            <label className="mci-login-label">{t('login_password_label')}</label>
            <input 
              type="password" 
              className="mci-login-input"
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login_password_placeholder')}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-4 rounded-2xl border border-red-100">
              <ShieldAlert size={16} /> {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="mci-login-button">
            {loading ? t('login_loading') : t('login_button')}
          </button>
        </form>

        {/* Sprachen Footer */}
        <div className="mci-login-footer">
          <button 
            onClick={() => setLang('de')} 
            className={`text-[10px] font-bold uppercase tracking-widest ${lang === 'de' ? 'text-[#004a87]' : 'text-gray-300'}`}
          >
            DE
          </button>
          <button 
            onClick={() => setLang('en')} 
            className={`text-[10px] font-bold uppercase tracking-widest ${lang === 'en' ? 'text-[#004a87]' : 'text-gray-300'}`}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  );
}