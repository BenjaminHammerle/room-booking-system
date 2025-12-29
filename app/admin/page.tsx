'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { updateUserAdmin } from './actions';
import { 
  Users, Calendar, BarChart3, Settings, X, 
  ArrowLeft, CheckCircle2, ShieldCheck, Power, 
  Plus, AlertTriangle, Save, Edit3, Globe, Monitor, Printer
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('planning');
  const [lang, setLang] = useState<'de' | 'en'>('de');
  const [dbTrans, setDbTrans] = useState<any>({});
  
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Modals
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>(null);

  const t = (key: string) => dbTrans[key]?.[lang] || key;

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setLoading(true);
    const [transRes, profilesRes, roomsRes, bookingsRes, timesRes, equipRes] = await Promise.all([
      supabase.from('translations').select('*'),
      supabase.from('profiles').select('*').order('last_name'),
      supabase.from('rooms').select('*').order('name'),
      supabase.from('bookings').select('*'),
      supabase.from('timeslots').select('*').order('id'),
      supabase.from('equipment').select('*')
    ]);

    if (transRes.data) {
      const tMap: any = {};
      transRes.data.forEach(i => tMap[i.key] = { de: i.de, en: i.en });
      setDbTrans(tMap);
    }

    if (profilesRes.data) setProfiles(profilesRes.data);
    if (roomsRes.data) setRooms(roomsRes.data);
    if (bookingsRes.data) setBookings(bookingsRes.data);
    if (timesRes.data) setTimeSlots(timesRes.data.map(ts => ts.time_string));
    if (equipRes.data) setEquipmentList(equipRes.data);

    setLoading(false);
  }

  // --- ROOM MANAGEMENT LOGIC ---
  const handleSaveRoom = async () => {
    const isNew = !currentRoom.id;
    const roomPayload = { ...currentRoom };
    if (isNew) delete roomPayload.id;

    const { error } = isNew 
      ? await supabase.from('rooms').insert([roomPayload])
      : await supabase.from('rooms').update(roomPayload).eq('id', currentRoom.id);

    if (!error) {
      setShowRoomModal(false);
      loadAdminData();
    } else {
      alert("Fehler: " + error.message);
    }
  };

  const handleToggleRoom = async (room: any) => {
    const n = !room.is_active;
    const until = n ? null : prompt(lang === 'de' ? "Inaktiv bis (YYYY-MM-DD)?" : "Inactive until (YYYY-MM-DD)?", "");
    if (!n && until === null) return;

    await supabase.from('rooms').update({ is_active: n, inactive_until: until }).eq('id', room.id);
    
    if (!n) {
      // Auto-Storno für deaktivierte Räume
      await supabase.from('bookings')
        .update({ status: 'cancelled' })
        .eq('room_id', room.id)
        .gte('booking_date', new Date().toISOString().split('T')[0]);
    }
    loadAdminData();
  };

  // --- USER LOGIC ---
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateUserAdmin(editUser.id, editUser);
      setEditUser(null);
      loadAdminData();
    } catch (err: any) { alert(err.message); }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#004a87] text-white font-bold italic uppercase tracking-widest">
      {t('admin_loading')}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex font-sans text-slate-900">
      
      {/* SIDEBAR - Logo Filter entfernt */}
      <aside className="w-80 bg-[#004a87] text-white p-10 flex flex-col justify-between sticky top-0 h-screen shadow-2xl print:hidden">
        <div>
          <div className="mb-12">
            <img src="/MCI.png" className="h-16 object-contain" alt="MCI" />
          </div>
          <nav className="space-y-4">
            <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'planning' ? 'bg-[#549BB7] shadow-lg' : 'hover:bg-white/10 opacity-60'}`}>
              <Calendar size={18}/> {t('admin_sidebar_planning')}
            </button>
            <button onClick={() => setActiveTab('rooms')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'rooms' ? 'bg-[#549BB7] shadow-lg' : 'hover:bg-white/10 opacity-60'}`}>
              <Settings size={18}/> {t('admin_sidebar_rooms')}
            </button>
            <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'users' ? 'bg-[#549BB7] shadow-lg' : 'hover:bg-white/10 opacity-60'}`}>
              <Users size={18}/> {t('admin_sidebar_users')}
            </button>
            <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'stats' ? 'bg-[#549BB7] shadow-lg' : 'hover:bg-white/10 opacity-60'}`}>
              <BarChart3 size={18}/> {t('admin_sidebar_stats')}
            </button>
          </nav>
        </div>
        <button onClick={() => router.push('/rooms')} className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-2xl font-bold text-sm border border-white/10"><ArrowLeft size={18}/> {t('admin_back_btn')}</button>
      </aside>

      <main className="flex-1 p-16 overflow-y-auto">
        
        {/* TAB: BELEGUNGSPLAN (MATRIX) */}
        {activeTab === 'planning' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic mb-1">{t('admin_title_planning')}</h1>
                    <p className="text-gray-400 font-medium text-sm italic">{t('admin_subtitle_planning')}</p>
                </div>
                <div className="flex gap-4">
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 bg-white border border-gray-100 rounded-xl font-bold text-[#004a87] outline-none shadow-sm" />
                  <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"><Printer size={18}/> PDF</button>
                </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-x-auto p-10 print:p-0 print:border-none">
                <table className="w-full border-collapse">
                    <thead>
                    <tr>
                        <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Raum</th>
                        {timeSlots.map(t => <th key={t} className="p-2 text-[10px] font-black text-gray-300 text-center border-l">{t}</th>)}
                    </tr>
                    </thead>
                    <tbody>
                    {rooms.map(room => (
                        <tr key={room.id} className="border-t">
                            <td className="p-4 font-bold text-slate-700 whitespace-nowrap text-left">{room.image} {room.name}</td>
                            {timeSlots.map(tStr => {
                                const booking = bookings.find(b => {
                                    const bStart = parseInt(b.start_time.split(':')[0]);
                                    const hour = parseInt(tStr.split(':')[0]);
                                    return b.room_id === room.id && b.booking_date === selectedDate && b.status === 'active' && hour >= bStart && hour < (bStart + (b.duration || 1));
                                });
                                const owner = booking ? profiles.find(p => p.id === booking.user_id) : null;
                                return (
                                    <td key={tStr} className="p-1 border-l border-gray-50 h-20 min-w-[120px]">
                                        {booking ? (
                                        <div className={`text-[10px] font-bold p-2 rounded-xl h-full flex flex-col justify-center border transition-all ${booking.is_checked_in ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                            <span className="truncate uppercase">{owner?.last_name || 'BOOKED'}</span>
                                            <span className="opacity-50 italic">{booking.is_checked_in ? 'IN ROOM' : 'RESERVED'}</span>
                                        </div>
                                        ) : <div className="bg-gray-50/20 w-full h-full rounded-xl"></div>}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
          </div>
        )}

        {/* TAB: RÄUME VERWALTEN (Repariert) */}
        {activeTab === 'rooms' && (
          <div className="space-y-10 animate-in fade-in text-left">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic mb-1">{t('admin_title_rooms')}</h1>
                <p className="text-gray-400 font-medium text-sm italic">{t('admin_subtitle_rooms')}</p>
              </div>
              <button 
                onClick={() => { setCurrentRoom({ name: '', capacity: 4, floor: 1, image: '🏢', is_active: true, equipment: [] }); setShowRoomModal(true); }}
                className="bg-[#549BB7] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-blue-100 hover:bg-[#438299] transition"
              >
                <Plus size={20}/> {t('admin_btn_add_room')}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {rooms.map(room => (
                    <div key={room.id} className={`bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm flex justify-between items-center transition-all ${!room.is_active ? 'opacity-50 grayscale bg-gray-50' : 'hover:shadow-md'}`}>
                        <div className="flex items-center gap-6 text-left">
                            <span className="text-5xl bg-gray-50 p-4 rounded-3xl">{room.image}</span>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">{room.name}</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{room.capacity} Plätze | {room.floor}. Etage</p>
                                <div className="flex flex-wrap gap-1.5 mt-3">
  {room.equipment?.map((eqId: string) => {
    const eq = equipmentList.find(e => e.id === eqId);
    return eq ? (
      <div 
        key={eqId} 
        className="px-2 py-0.5 bg-gray-50 text-[#004a87] text-[8px] font-bold uppercase tracking-tighter border border-gray-200 rounded-md"
      >
        {lang === 'de' ? eq.name_de : eq.name_en}
      </div>
    ) : null;
  })}
</div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setCurrentRoom(room); setShowRoomModal(true); }} className="p-4 text-gray-300 hover:text-[#004a87] hover:bg-gray-100 rounded-2xl transition"><Edit3 size={24}/></button>
                          <button onClick={() => handleToggleRoom(room)} className={`p-4 rounded-2xl transition ${room.is_active ? 'text-gray-300 hover:text-red-500 hover:bg-red-50' : 'text-red-500 hover:bg-green-50'}`}><Power size={24}/></button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB: MITARBEITER */}
        {activeTab === 'users' && (
          <div className="space-y-10 animate-in fade-in text-left">
              <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic">{t('admin_title_users')}</h1>
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr><th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th><th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">E-Mail</th><th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rolle</th><th className="p-8"></th></tr>
                  </thead>
                  <tbody>
                    {profiles.map(p => (
                      <tr key={p.id} className="border-b hover:bg-gray-50 transition">
                        <td className="p-8 font-bold text-slate-700">{p.first_name} {p.last_name}</td>
                        <td className="p-8 text-gray-500 text-sm font-medium">{p.email}</td>
                        <td className="p-8"><span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${p.is_admin ? 'bg-[#004a87] text-white italic' : 'bg-gray-100 text-gray-400'}`}>{p.is_admin ? 'ADMIN' : 'USER'}</span></td>
                        <td className="p-8 text-right"><button onClick={() => setEditUser(p)} className="p-3 text-gray-300 hover:text-[#004a87] transition hover:bg-gray-100 rounded-xl"><Edit3 size={20}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
        )}

        {/* TAB: STATISTIKEN */}
        {activeTab === 'stats' && (
          <div className="space-y-12 animate-in fade-in text-left">
            <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic">{t('admin_title_stats')}</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm"><p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-6">{t('admin_stats_total')}</p><p className="text-6xl font-bold text-[#004a87] tracking-tighter">{bookings.filter(b => b.status === 'active').length}</p></div>
              <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm"><p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-6">{t('admin_stats_users')}</p><p className="text-6xl font-bold text-[#004a87] tracking-tighter">{profiles.length}</p></div>
              <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm"><p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-6">{t('admin_stats_rooms')}</p><p className="text-6xl font-bold text-[#004a87] tracking-tighter">{rooms.filter(r => r.is_active).length}</p></div>
            </div>
          </div>
        )}
      </main>

      {/* RAUM MODAL MIT AUSSTATTUNG */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg shadow-2xl overflow-hidden text-left">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center"><h3 className="text-2xl font-bold italic uppercase tracking-tight">{currentRoom.id ? 'Editieren' : 'Neu'}</h3><button onClick={() => setShowRoomModal(false)}><X size={24}/></button></div>
            <div className="p-10 space-y-6 font-bold">
              <div className="flex gap-4">
                <input type="text" value={currentRoom.image} onChange={e => setCurrentRoom({...currentRoom, image: e.target.value})} className="w-20 p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none text-center text-2xl" placeholder="🏢" />
                <input type="text" value={currentRoom.name} onChange={e => setCurrentRoom({...currentRoom, name: e.target.value})} className="flex-1 p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none" placeholder={t('admin_label_roomname')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" value={currentRoom.capacity} onChange={e => setCurrentRoom({...currentRoom, capacity: parseInt(e.target.value)})} className="p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none" placeholder={t('admin_label_capacity')} />
                <input type="number" value={currentRoom.floor} onChange={e => setCurrentRoom({...currentRoom, floor: parseInt(e.target.value)})} className="p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none" placeholder={t('admin_label_floor')} />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">{t('admin_label_equip_select')}</label>
                <div className="grid grid-cols-2 gap-3">
                  {equipmentList.map(eq => (
                    <label key={eq.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer">
                      <input type="checkbox" checked={currentRoom.equipment?.includes(eq.id)} onChange={e => {
                        const next = e.target.checked ? [...(currentRoom.equipment || []), eq.id] : currentRoom.equipment.filter((x:string) => x !== eq.id);
                        setCurrentRoom({...currentRoom, equipment: next});
                      }} className="w-5 h-5 accent-[#004a87]"/>
                      <span className="text-sm">{lang === 'de' ? eq.name_de : eq.name_en}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={handleSaveRoom} className="w-full bg-[#004a87] text-white py-5 rounded-[1.5rem] font-bold shadow-xl flex items-center justify-center gap-2"><Save size={20}/> {t('admin_btn_save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* USER EDIT MODAL (Unverändert) */}
      {editUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] p-6 animate-in zoom-in-95">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg shadow-2xl overflow-hidden text-left">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center"><h3 className="text-2xl font-bold italic uppercase tracking-tight">{t('admin_modal_user_title')}</h3><button onClick={() => setEditUser(null)}><X size={24}/></button></div>
            <form onSubmit={handleUpdateUser} className="p-10 space-y-6 font-bold">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" value={editUser.first_name || ''} onChange={e => setEditUser({...editUser, first_name: e.target.value})} className="p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none" placeholder={t('admin_label_fname')} />
                <input type="text" value={editUser.last_name || ''} onChange={e => setEditUser({...editUser, last_name: e.target.value})} className="p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none" placeholder={t('admin_label_lname')} />
              </div>
              <label className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl cursor-pointer">
                <span className="font-bold text-sm text-slate-700 italic uppercase">{t('admin_label_admin')}</span>
                <input type="checkbox" checked={editUser.is_admin} onChange={e => setEditUser({...editUser, is_admin: e.target.checked})} className="w-6 h-6 accent-[#004a87]" />
              </label>
              <button type="submit" className="w-full bg-[#004a87] text-white py-5 rounded-[1.5rem] font-bold shadow-xl">{t('admin_btn_save')}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}