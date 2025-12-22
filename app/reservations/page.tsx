'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, CheckCircle2, History, Filter, User as UserIcon } from 'lucide-react';

export default function ReservationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRoom, setFilterRoom] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    setUser(session.user);

    // 1. Admin Status & Profile laden
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    const adminStatus = profile?.is_admin || false;
    setIsAdmin(adminStatus);

    // 2. Räume laden
    const { data: r } = await supabase.from('rooms').select('*');
    setRooms(r || []);

    // 3. Alle Profile laden (für Admins)
    const { data: p } = await supabase.from('profiles').select('*').order('last_name');
    setProfiles(p || []);

    // 4. Buchungen laden (flache Abfrage ohne Join)
    let query = supabase.from('bookings').select('*');
    if (!adminStatus) {
      query = query.eq('user_id', session.user.id);
    }
    const { data: b } = await query.order('booking_date', { ascending: false });
    setBookings(b || []);

    setLoading(false);
  }

  const filteredBookings = bookings.filter(b => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    
    const endHour = parseInt(b.start_time.split(':')[0]) + (b.duration || 1);
    const isFinished = b.booking_date < todayStr || (b.booking_date === todayStr && endHour <= currentHour);

    if (filterStatus === 'open' && isFinished) return false;
    if (filterStatus === 'finished' && !isFinished) return false;
    if (filterRoom !== 'all' && b.room_id !== filterRoom) return false;
    if (isAdmin && filterUser !== 'all' && b.user_id !== filterUser) return false;

    return true;
  });

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-blue-600">Lade Buchungs-Archiv...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <button onClick={() => router.push('/rooms')} className="flex items-center gap-2 text-gray-400 font-bold hover:text-blue-600 transition">
            <ArrowLeft size={20}/> Zurück
          </button>
          <h1 className="text-3xl font-black text-slate-900">Reservierungs-Zentrale</h1>
        </div>

        {/* Filter-Bar */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-wrap gap-6">
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Zeitraum</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-blue-500 transition">
              <option value="all">Alle</option>
              <option value="open">Offen / Aktiv</option>
              <option value="finished">Beendet</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Raum</label>
            <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-blue-500">
              <option value="all">Alle Räume</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div className="flex-1 min-w-[200px] space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Mitarbeiter-Filter</label>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-blue-500">
                <option value="all">Alle User</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Buchungsliste */}
        <div className="space-y-4">
          {filteredBookings.map(b => {
             const room = rooms.find(r => r.id === b.room_id);
             const owner = profiles.find(p => p.id === b.user_id);
             const isFinished = b.booking_date < new Date().toISOString().split('T')[0] || (b.booking_date === new Date().toISOString().split('T')[0] && (parseInt(b.start_time) + b.duration) <= new Date().getHours());

             return (
               <div key={b.id} className={`p-6 bg-white rounded-3xl border border-gray-100 flex justify-between items-center transition-all hover:shadow-md ${isFinished ? 'opacity-50' : 'border-l-4 border-l-blue-600'}`}>
                 <div className="flex items-center gap-6">
                   <div className="text-4xl">{room?.image || '🏢'}</div>
                   <div>
                     <div className="font-black text-slate-800 text-lg leading-tight">
                        {room?.name || 'Unbekannter Raum'}
                     </div>
                     <div className="text-xs text-gray-400 font-bold uppercase tracking-tighter mt-1">
                        {isAdmin ? `Gebucht von: ${owner?.first_name} ${owner?.last_name || b.user_email}` : 'Deine Buchung'}
                     </div>
                     <div className="flex gap-4 text-xs text-gray-500 font-bold mt-2">
                        <span className="flex items-center gap-1"><Calendar size={12}/> {b.booking_date}</span>
                        <span className="flex items-center gap-1"><Clock size={12}/> {b.start_time} ({b.duration}h)</span>
                     </div>
                   </div>
                 </div>
                 {isFinished ? (
                   <span className="text-gray-300 font-black text-[10px] uppercase tracking-widest flex items-center gap-1"><History size={14}/> Beendet</span>
                 ) : (
                   <span className="text-green-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={14}/> Aktiv</span>
                 )}
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}