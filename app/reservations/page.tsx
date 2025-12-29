'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Calendar, Clock, CheckCircle2, 
  Filter, User as UserIcon, XCircle, Globe, ChevronDown 
} from 'lucide-react';

export default function ReservationsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<'de' | 'en'>('de');
  const [dbTrans, setDbTrans] = useState<any>({});
  
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRoom, setFilterRoom] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  // Helper für dynamische Texte
  const t = (key: string) => dbTrans[key]?.[lang] || key;

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    setUser(session.user);

    // Alles parallel laden (Data-Driven)
    const [transRes, profileRes, roomsRes, profilesRes, bookingsRes] = await Promise.all([
      supabase.from('translations').select('*'),
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('rooms').select('*'),
      supabase.from('profiles').select('*').order('last_name'),
      supabase.from('bookings').select('*').order('booking_date', { ascending: false })
    ]);

    // Übersetzungen mappen
    if (transRes.data) {
      const tMap: any = {};
      transRes.data.forEach(i => tMap[i.key] = { de: i.de, en: i.en });
      setDbTrans(tMap);
    }

    const adminStatus = profileRes.data?.is_admin || false;
    setIsAdmin(adminStatus);
    setRooms(roomsRes.data || []);
    setProfiles(profilesRes.data || []);

    // Wenn kein Admin, nur eigene Buchungen anzeigen
    let finalBookings = bookingsRes.data || [];
    if (!adminStatus) {
      finalBookings = finalBookings.filter(b => b.user_id === session.user.id);
    }
    setBookings(finalBookings);

    setLoading(false);
  }

  const handleCancel = async (id: string) => {
    if (!confirm(t('archiv_confirm_cancel'))) return;
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (!error) loadAllData();
  };

  const filteredBookings = bookings.filter(b => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const endHour = parseInt(b.start_time.split(':')[0]) + (b.duration || 1);
    const isFinished = b.booking_date < todayStr || (b.booking_date === todayStr && endHour <= now.getHours());

    if (filterStatus === 'open' && (isFinished || b.status !== 'active')) return false;
    if (filterStatus === 'finished' && !isFinished) return false;
    if (filterStatus === 'cancelled' && b.status !== 'cancelled') return false;
    if (filterRoom !== 'all' && b.room_id !== filterRoom) return false;
    if (isAdmin && filterUser !== 'all' && b.user_id !== filterUser) return false;

    return true;
  });

  if (loading) return (
    <div className="h-screen flex items-center justify-center font-bold text-[#004a87] italic uppercase animate-pulse">
      {t('archiv_loading')}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FB] p-8 md:p-12 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER */}
        <div className="flex justify-between items-center">
          <button onClick={() => router.push('/rooms')} className="flex items-center gap-2 text-gray-400 font-bold hover:text-[#004a87] transition">
            <ArrowLeft size={20}/> {t('archiv_back')}
          </button>
          <div className="flex items-center gap-6">
            <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')} className="text-xs font-bold uppercase text-gray-300 hover:text-[#004a87] transition">
               {lang}
            </button>
            <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic">
              {t('archiv_title')}
            </h1>
          </div>
        </div>

        {/* FILTER BAR (Zierliche Optik) */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] ml-2">
              {t('archiv_filter_status')}
            </label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none ring-1 ring-gray-100 focus:ring-2 focus:ring-[#549BB7] outline-none font-bold text-sm transition-all">
              <option value="all">{t('archiv_opt_all')}</option>
              <option value="open">{t('archiv_opt_open')}</option>
              <option value="finished">{t('archiv_opt_finished')}</option>
              <option value="cancelled">{t('archiv_opt_cancelled')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] ml-2">
              {t('archiv_filter_room')}
            </label>
            <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none ring-1 ring-gray-100 focus:ring-2 focus:ring-[#549BB7] outline-none font-bold text-sm transition-all">
              <option value="all">{t('archiv_opt_all_rooms')}</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {isAdmin && (
            <div className="space-y-2 animate-in fade-in">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] ml-2">
                {t('archiv_filter_user')}
              </label>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004a87] outline-none font-bold text-sm transition-all">
                <option value="all">{t('archiv_opt_all_users')}</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* BUCHUNGSLISTE */}
        <div className="space-y-4">
          {filteredBookings.map(b => {
             const room = rooms.find(r => r.id === b.room_id);
             const owner = profiles.find(p => p.id === b.user_id);
             const isCancelled = b.status === 'cancelled';
             const isReleased = b.status === 'released';
             const canCancel = !isCancelled && !isReleased && b.status === 'active' && !b.is_checked_in && b.booking_date >= new Date().toISOString().split('T')[0];

             return (
               <div key={b.id} className={`p-8 bg-white rounded-[2.5rem] border border-gray-100 flex justify-between items-center transition-all ${isCancelled || isReleased ? 'opacity-40 grayscale bg-gray-50' : 'hover:shadow-md'}`}>
                 <div className="flex items-center gap-8 text-left">
                   <div className="text-4xl p-4 bg-gray-50 rounded-3xl shadow-inner">
                     {room?.image || '🏢'}
                   </div>
                   <div>
                     <div className="font-bold text-xl text-slate-800 tracking-tight">
                        {room?.name} 
                        {isCancelled && <span className="text-red-500 text-xs ml-3 italic uppercase font-bold tracking-widest">[{t('archiv_opt_cancelled')}]</span>}
                        {isReleased && <span className="text-orange-500 text-xs ml-3 italic uppercase font-bold tracking-widest">[RELEASED]</span>}
                     </div>
                     <div className="flex gap-4 text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-[0.1em]">
                        <span className="flex items-center gap-1.5"><Calendar size={12}/> {b.booking_date}</span>
                        <span className="flex items-center gap-1.5"><Clock size={12}/> {b.start_time} ({b.duration}h)</span>
                        {isAdmin && <span className="text-[#004a87] font-bold">| {owner?.first_name} {owner?.last_name}</span>}
                     </div>
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-4">
                    {canCancel && (
                      <button 
                        onClick={() => handleCancel(b.id)}
                        className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-colors"
                        title="Stornieren"
                      >
                        <XCircle size={24}/>
                      </button>
                    )}
                    
                    {b.is_checked_in ? (
                      <span className="bg-green-100 text-green-700 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-2 shadow-sm border border-green-200">
                        <CheckCircle2 size={12}/> {t('archiv_status_checkin')}
                      </span>
                    ) : (
                      <span className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border ${
                        isCancelled ? 'bg-red-100 text-red-700 border-red-200' : 
                        isReleased ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        'bg-blue-100 text-blue-700 border-blue-200 shadow-sm'
                      }`}>
                        {isCancelled ? t('archiv_status_storno') : 
                         isReleased ? 'Released' :
                         t('archiv_status_reserved')}
                      </span>
                    )}
                 </div>
               </div>
             );
          })}
          
          {filteredBookings.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-gray-300 italic font-medium">Keine Einträge für diesen Filter gefunden.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}