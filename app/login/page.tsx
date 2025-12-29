'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogIn, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbTrans, setDbTrans] = useState<any>({});
  const [lang, setLang] = useState<'de' | 'en'>('de'); // Standardmäßig Deutsch
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

  // Hilfsfunktion für Texte
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
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] p-4 font-sans">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-gray-100 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6">
            <img src="/MCI.png" alt="MCI Logo" className="h-16 w-auto object-contain" />
          </div>
          {/* font-bold statt font-black für zierlicheren Look */}
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight italic uppercase">
            {t('login_title')}
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            {t('login_subtitle')}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {/* E-Mail Feld */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-2 ml-2">
              {t('login_email_label')}
            </label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-gray-50 border-none ring-1 ring-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#004a87] transition-all font-medium"
              placeholder={t('login_email_placeholder')}
            />
          </div>

          {/* Passwort Feld */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-2 ml-2">
              {t('login_password_label')}
            </label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-gray-50 border-none ring-1 ring-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#004a87] transition-all font-medium"
              placeholder={t('login_password_placeholder')}
            />
          </div>

          {/* Fehlermeldung */}
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-4 rounded-2xl border border-red-100 animate-in slide-in-from-top-2">
              <ShieldAlert size={16} /> {error}
            </div>
          )}

          {/* Login Button */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#004a87] text-white py-5 rounded-[1.5rem] font-bold hover:bg-[#549BB7] shadow-xl shadow-blue-100 transition transform active:scale-95 disabled:opacity-50 mt-4"
          >
            {loading ? t('login_loading') : t('login_button')}
          </button>
        </form>

        {/* Optionaler Language Switcher am Fuß der Karte */}
        <div className="mt-8 pt-6 border-t border-gray-50 flex justify-center gap-4">
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