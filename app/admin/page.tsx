'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { updateUserAdmin, createNewUser } from './actions';
import { useRouter } from 'next/navigation';
// HIER WURDE ShieldCheck HINZUGEFÜGT:
import { 
  Users, Calendar, BarChart3, UserPlus, 
  Settings, X, Trash2, ArrowLeft, CheckCircle2,
  ShieldCheck 
} from 'lucide-react';

const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('planning'); 
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editUser, setEditUser] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
  setLoading(true);
  
  const { data: p } = await supabase.from('profiles').select('*').order('last_name');
  const { data: r } = await supabase.from('rooms').select('*').order('name');
  
  // Für die Statistik laden wir ALLE Buchungen (ohne Datumsfilter)
  // Für den Belegungsplan filtern wir später im Code
  const { data: b } = await supabase.from('bookings').select('*'); 

  if (p) setProfiles(p);
  if (r) setRooms(r);
  if (b) setBookings(b);
  setLoading(false);
}

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateUserAdmin(editUser.id, editUser);
      setEditUser(null);
      loadAdminData();
    } catch (err: any) { 
      alert("Fehler beim Update: " + err.message); 
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-blue-400">
      <ShieldCheck size={48} className="animate-bounce mb-4"/>
      <p className="font-black italic tracking-widest">ADMIN-SICHERHEITSCHECK...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* SIDEBAR */}
      <aside className="w-72 bg-slate-900 text-white p-8 flex flex-col justify-between sticky top-0 h-screen">
        <div>
          <div className="font-black text-2xl text-blue-400 mb-12 tracking-tighter flex items-center gap-2">
            <ShieldCheck className="text-blue-500"/> ADMIN 
          </div>
          <nav className="space-y-3">
            <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition ${activeTab === 'planning' ? 'bg-blue-600 font-bold shadow-lg shadow-blue-900/50' : 'hover:bg-white/5 text-gray-400'}`}>
              <Calendar size={20}/> Belegungsplan
            </button>
            <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition ${activeTab === 'users' ? 'bg-blue-600 font-bold shadow-lg shadow-blue-900/50' : 'hover:bg-white/5 text-gray-400'}`}>
              <Users size={20}/> User-Verwaltung
            </button>
            <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition ${activeTab === 'stats' ? 'bg-blue-600 font-bold shadow-lg shadow-blue-900/50' : 'hover:bg-white/5 text-gray-400'}`}>
              <BarChart3 size={20}/> Statistiken
            </button>
          </nav>
        </div>

        <button 
          onClick={() => router.push('/rooms')}
          className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 transition font-bold border border-white/10"
        >
          <ArrowLeft size={18}/> Zur Buchung
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-12 overflow-y-auto">
        
        {/* TAB: BELEGUNGSPLAN (MATRIX) */}
        {activeTab === 'planning' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Belegungsplan</h1>
                    <p className="text-gray-400 font-medium">Echtzeit-Übersicht aller Räume</p>
                </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto p-8">
                <table className="w-full">
                    <thead>
                    <tr>
                        <th className="p-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Raum</th>
                        {timeSlots.map(t => (
                        <th key={t} className="p-2 text-[10px] font-black text-gray-300 text-center border-l border-gray-50">{t}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {rooms.map(room => (
                        <tr key={room.id} className="border-t border-gray-50">
                        <td className="p-4 font-bold text-slate-700 whitespace-nowrap flex items-center gap-3">
                            <span className="text-2xl">{room.image}</span> {room.name}
                        </td>
                        {timeSlots.map(t => {
                            const booking = bookings.find(b => {
                                const bStart = parseInt(b.start_time.split(':')[0]);
                                const hour = parseInt(t.split(':')[0]);
                                return b.room_id === room.id && hour >= bStart && hour < (bStart + (b.duration || 1));
                            });
                            return (
                            <td key={t} className="p-1 border-l border-gray-50 h-20 min-w-[80px]">
                                {booking ? (
                                <div className="bg-blue-100 text-[10px] font-bold text-blue-700 p-2 rounded-xl h-full flex flex-col justify-center border border-blue-200">
                                    <span className="truncate">{booking.profiles?.last_name || 'Belegt'}</span>
                                    <span className="opacity-50 font-medium italic">{booking.duration}h</span>
                                </div>
                                ) : (
                                <div className="bg-gray-50/30 w-full h-full rounded-xl"></div>
                                )}
                            </td>
                            );
                        })}
                        </tr>
                    ))}
                    </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: USER LISTE */}
        {activeTab === 'users' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Mitarbeiter</h1>
              <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-blue-100 hover:bg-blue-700 transition active:scale-95">
                <UserPlus size={20}/> User anlegen
              </button>
            </div>
            
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">Name</th>
                    <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">E-Mail</th>
                    <th className="p-6 text-xs font-black text-gray-400 uppercase tracking-widest">Rolle</th>
                    <th className="p-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {profiles.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/20 transition group">
                      <td className="p-6">
                        <div className="font-bold text-slate-800">{p.first_name} {p.last_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{p.id.substring(0,8)}...</div>
                      </td>
                      <td className="p-6 text-gray-500 font-medium">{p.email}</td>
                      <td className="p-6">
                        {p.is_admin ? 
                          <span className="bg-slate-900 text-blue-400 px-4 py-1.5 rounded-full text-[10px] font-black italic tracking-widest border border-slate-800">ADMIN</span> : 
                          <span className="bg-gray-100 text-gray-400 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest">USER</span>
                        }
                      </td>
                      <td className="p-6 text-right">
                        <button onClick={() => setEditUser(p)} className="bg-gray-50 text-gray-400 hover:bg-blue-600 hover:text-white p-3 rounded-xl transition-all shadow-sm">
                            <Settings size={18}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: STATISTIKEN */}
        {activeTab === 'stats' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <h1 className="text-4xl font-black text-slate-900">Kennzahlen</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm group hover:border-blue-200 transition">
                <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-4">Buchungen gesamt</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-6xl font-black text-blue-600">{bookings.length}</p>
                    <p className="text-gray-300 font-bold">Termine</p>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm group hover:border-blue-200 transition">
                <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-4">Registrierte User</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-6xl font-black text-slate-800">{profiles.length}</p>
                    <p className="text-gray-300 font-bold">Accounts</p>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm group hover:border-blue-200 transition">
                <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-4">Raum-Kapazität</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-6xl font-black text-slate-800">{rooms.length}</p>
                    <p className="text-gray-300 font-bold">Räume</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* EDIT USER MODAL */}
      {editUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black italic">Mitarbeiter editieren</h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">ID: {editUser.id.substring(0,12)}...</p>
              </div>
              <button onClick={() => setEditUser(null)} className="p-2 hover:bg-white/10 rounded-full transition"><X/></button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Vorname</label>
                    <input type="text" value={editUser.first_name || ''} onChange={e => setEditUser({...editUser, first_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 transition outline-none"/>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Nachname</label>
                    <input type="text" value={editUser.last_name || ''} onChange={e => setEditUser({...editUser, last_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 transition outline-none"/>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">E-Mail</label>
                <input type="email" value={editUser.email || ''} onChange={e => setEditUser({...editUser, email: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border-none ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 transition outline-none"/>
              </div>
              
              <label className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border-none ring-1 ring-gray-200 cursor-pointer group hover:ring-blue-200 transition">
                <span className="font-black text-slate-700 text-sm uppercase tracking-tighter italic">Admin-Status gewähren</span>
                <input type="checkbox" checked={editUser.is_admin} onChange={e => setEditUser({...editUser, is_admin: e.target.checked})} className="w-6 h-6 rounded-lg accent-blue-600"/>
              </label>

              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition active:scale-95 mt-4">
                Änderungen finalisieren
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}