'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Calendar, Users, Monitor, BookOpen, Wifi, Check, X, 
  Clock, LogOut, ShieldCheck, User, Settings, Lock, ChevronDown, List 
} from 'lucide-react';

// Konfiguration der Zusatz-Addons
const equipmentTypes = [
  { id: 'beamer', name: 'Beamer', icon: Monitor },
  { id: 'flipchart', name: 'Flipchart', icon: BookOpen },
  { id: 'videoconf', name: 'Videokonferenz', icon: Monitor },
  { id: 'sound', name: 'Soundanlage', icon: Wifi }
];

const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

export default function RoomBookingPage() {
  const router = useRouter();
  
  // Daten-States
  const [rooms, setRooms] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // UI-States
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: string} | null>(null);

  // Buchungs-Konfiguration
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [duration, setDuration] = useState(1);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  // Profil-States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    initApp();
  }, [selectedDate]);

  async function initApp() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    setUser(session.user);

    // Profil laden (Vorname, Nachname, Admin-Status)
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (profile) {
      setIsAdmin(profile.is_admin || false);
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
    }

    // Räume laden
    const { data: rData } = await supabase.from('rooms').select('*');
    // Alle Buchungen laden (für Slot-Check und Dashboard)
    const { data: bData } = await supabase.from('bookings').select('*');
    
    if (rData) setRooms(rData);
    if (bData) setBookings(bData);
    setLoading(false);
  }

  // LOGIK: Nächste 5 Termine ermitteln (inkl. aktuell laufende)
  const getUpcomingBookings = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();

    return bookings
      .filter(b => {
        if (b.user_id !== user?.id) return false;
        if (b.booking_date > todayStr) return true;
        if (b.booking_date === todayStr) {
          const endHour = parseInt(b.start_time.split(':')[0]) + (b.duration || 1);
          return endHour > currentHour;
        }
        return false;
      })
      .sort((a, b) => (a.booking_date + a.start_time).localeCompare(b.booking_date + b.start_time))
      .slice(0, 5);
  };

  // LOGIK: Belegung prüfen & Max Dauer berechnen
  const isSlotOccupied = (roomId: string, time: string) => {
    const checkHour = parseInt(time.split(':')[0]);
    return bookings.some(b => {
      if (b.room_id !== roomId || b.booking_date !== selectedDate) return false;
      const start = parseInt(b.start_time.split(':')[0]);
      const end = start + (b.duration || 1);
      return checkHour >= start && checkHour < end;
    });
  };

  const getMaxDuration = () => {
    if (!selectedRoom) return 1;
    const startHour = parseInt(selectedTime.split(':')[0]);
    let max = 0;
    for (let h = startHour; h < 20; h++) {
      const timeString = h < 10 ? `0${h}:00` : `${h}:00`;
      if (isSlotOccupied(selectedRoom.id, timeString)) break;
      max++;
    }
    return max;
  };

  // AKTIONEN
  const handleBooking = async () => {
    if (!user || !selectedRoom) return;
    const { error } = await supabase.from('bookings').insert([{
      room_id: selectedRoom.id,
      user_id: user.id,
      booking_date: selectedDate,
      start_time: selectedTime,
      duration: duration,
      user_email: user.email,
      equipment: selectedEquipment
    }]);

    if (error) {
      alert(error.message);
    } else {
      setShowModal(false);
      setSelectedEquipment([]);
      setNotification({ msg: "Erfolgreich reserviert!", type: "success" });
      initApp();
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdateProfile = async () => {
    const { error } = await supabase.from('profiles').update({ first_name: firstName, last_name: lastName }).eq('id', user.id);
    if (error) alert(error.message);
    else { setNotification({ msg: "Profil aktualisiert!", type: "success" }); setTimeout(() => setNotification(null), 3000); }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) { alert("Passwörter ungleich!"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert(error.message);
    else { setNotification({ msg: "Passwort geändert!", type: "success" }); setNewPassword(""); setConfirmPassword(""); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-blue-600 italic">ROOMRESERVE...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* NAVBAR */}
      <nav className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50 shadow-sm px-8">
        <div className="font-black text-xl text-blue-600 flex items-center gap-2"><Calendar /> ROOMRESERVE</div>
        
        <div className="flex items-center gap-6">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border p-2 rounded-xl text-sm font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"/>
          
          <div className="relative">
            <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-3 bg-gray-50 p-2 pr-4 rounded-2xl border hover:shadow-md transition-all outline-none">
              <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold">
                {firstName ? firstName.charAt(0) : user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight">Mitarbeiter</p>
                <p className="text-sm font-bold leading-tight">{firstName ? `${firstName} ${lastName}` : user?.email}</p>
              </div>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-gray-100 p-2 z-[60] animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-gray-50 mb-2">
                  <p className="font-black text-slate-800 truncate">{firstName} {lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                </div>
                <button onClick={() => router.push('/reservations')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 text-blue-600 font-bold transition text-left"><List size={18} /> Meine Reservierungen</button>
                {isAdmin && <button onClick={() => router.push('/admin')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 text-blue-600 font-bold transition text-left"><ShieldCheck size={18} /> Admin Konsole</button>}
                <button onClick={() => { setShowSettingsModal(true); setShowUserMenu(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-slate-600 font-bold transition text-left"><Settings size={18} /> Einstellungen</button>
                <hr className="my-2 border-gray-50" />
                <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-red-500 font-bold transition text-left"><LogOut size={18} /> Ausloggen</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-12 space-y-16">
        {/* RÄUME-GRID */}
        <section>
          <h2 className="text-3xl font-black mb-10 text-slate-900 tracking-tight">Räume buchen</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {rooms.map(room => (
              <div key={room.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl transition-all group">
                <div className="bg-blue-600 h-40 flex items-center justify-center text-7xl group-hover:scale-110 transition-transform duration-500">{room.image}</div>
                <div className="p-8 text-center">
                  <h3 className="font-bold text-xl mb-6 text-slate-800">{room.name}</h3>
                  <button onClick={() => { setSelectedRoom(room); setShowModal(true); setDuration(1); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition active:scale-95">Reservieren</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DASHBOARD: NÄCHSTE TERMINE (Jetzt unter den Buttons) */}
        <section className="bg-white rounded-[3rem] p-10 border border-gray-100 shadow-sm">
          <h2 className="text-2xl font-black mb-8 flex items-center gap-3 text-slate-800"><Clock className="text-blue-600" /> Deine nächsten 5 Reservierungen</h2>
          <div className="grid gap-4">
            {getUpcomingBookings().map(b => (
              <div key={b.id} className="bg-gray-50 p-6 rounded-[2rem] flex justify-between items-center border border-gray-100 transition hover:bg-white hover:shadow-md">
                <div className="flex items-center gap-6">
                  <div className="text-4xl">{rooms.find(r => r.id === b.room_id)?.image || '🏢'}</div>
                  <div>
                    <div className="font-bold text-lg text-slate-900">{rooms.find(r => r.id === b.room_id)?.name}</div>
                    <div className="text-gray-500 font-medium">{b.booking_date} • {b.start_time} Uhr ({b.duration}h)</div>
                  </div>
                </div>
                <div className="bg-blue-100 text-blue-700 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest">Aktiv / Kommend</div>
              </div>
            ))}
            {getUpcomingBookings().length === 0 && <p className="text-center py-10 text-gray-400 italic text-sm">Aktuell keine anstehenden Termine für dich gefunden.</p>}
          </div>
        </section>
      </main>

      {/* BUCHUNGS MODAL MIT SLOT-CHECK & ADD-ONS */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-blue-600 p-10 text-white flex justify-between items-center">
              <div><h3 className="text-3xl font-black">{selectedRoom?.name}</h3><p className="text-blue-100 opacity-80 text-sm mt-1 uppercase font-bold tracking-widest italic">Konfiguration</p></div>
              <button onClick={() => setShowModal(false)} className="bg-white/10 p-3 rounded-full hover:bg-white/20 transition"><X/></button>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Beginn</label>
                <select value={selectedTime} onChange={e => { setSelectedTime(e.target.value); setDuration(1); }} className="w-full bg-gray-50 border-none ring-1 ring-gray-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500">
                  {timeSlots.map(t => {
                    const occupied = isSlotOccupied(selectedRoom?.id, t);
                    return <option key={t} value={t} disabled={occupied} className={occupied ? "text-gray-300" : "text-black"}>{t} Uhr {occupied ? "(Belegt)" : ""}</option>
                  })}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Dauer</label>
                <select value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="w-full bg-gray-50 border-none ring-1 ring-gray-200 p-4 rounded-2xl outline-none">
                  {Array.from({ length: getMaxDuration() }, (_, i) => i + 1).map(d => (<option key={d} value={d}>{d} Stunde{d > 1 ? 'n' : ''}</option>))}
                </select>
              </div>
              {/* ZUSATZ EQUIPMENT */}
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Add-ons</label>
                <div className="grid grid-cols-2 gap-3">
                  {equipmentTypes.map(eq => (
                    <button key={eq.id} onClick={() => setSelectedEquipment(prev => prev.includes(eq.id) ? prev.filter(x => x !== eq.id) : [...prev, eq.id])} className={`p-4 border-2 rounded-2xl flex items-center gap-3 transition-all ${selectedEquipment.includes(eq.id) ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold' : 'bg-white border-gray-100 text-gray-400'}`}>
                      <eq.icon size={18}/> <span className="text-sm">{eq.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleBooking} disabled={getMaxDuration() === 0} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 transition active:scale-95 disabled:opacity-30">Buchung abschließen</button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center"><h3 className="text-2xl font-black italic">Mein Account</h3><button onClick={() => setShowSettingsModal(false)}><X /></button></div>
            <div className="p-10 space-y-10 max-h-[80vh] overflow-y-auto">
              <section className="space-y-6">
                <h4 className="flex items-center gap-2 font-black text-gray-400 uppercase text-xs tracking-widest"><User size={14} /> Profil</h4>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Vorname" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="text" placeholder="Nachname" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={handleUpdateProfile} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-black transition shadow-lg">Daten speichern</button>
              </section>
              <hr className="border-gray-100" />
              <section className="space-y-6">
                <h4 className="flex items-center gap-2 font-black text-gray-400 uppercase text-xs tracking-widest"><Lock size={14} /> Sicherheit</h4>
                <div className="space-y-4">
                  <input type="password" placeholder="Neues Passwort" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="password" placeholder="Bestätigen" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={handleUpdatePassword} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition">Update Passwort</button>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {notification && (
        <div className={`fixed bottom-10 right-10 p-5 rounded-3xl shadow-2xl text-white font-bold z-[110] ${notification.type === 'error' ? 'bg-red-500' : 'bg-gray-900'}`}>
          {notification.msg}
        </div>
      )}
    </div>
  );
}