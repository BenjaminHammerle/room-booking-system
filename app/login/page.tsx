'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogIn, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Login fehlgeschlagen: " + error.message);
      setLoading(false);
    } else {
  // 1. Browser-Cache und Cookies aktualisieren
  router.refresh(); 
  
  // 2. Kurz warten (100ms), damit der Cookie im Browser "einrastet"
  setTimeout(() => {
    router.push('/rooms');
  }, 100);
}
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-4 rounded-2xl mb-4 shadow-lg shadow-blue-200">
            <LogIn className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-gray-900">Willkommen</h1>
          <p className="text-gray-400 text-sm">Bitte melde dich an, um Räume zu buchen.</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">E-Mail Adresse</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-gray-50 border-none ring-1 ring-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="deine@email.de"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Passwort</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-gray-50 border-none ring-1 ring-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="••••••••"
            />
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl border border-red-100">
              <ShieldAlert size={16} /> {error}
            </div>
          )}
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-100 transition transform active:scale-95 disabled:opacity-50"
          >
            {loading ? "Wird angemeldet..." : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}