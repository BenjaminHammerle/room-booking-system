'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
// Server Actions für Mitarbeiter-Verwaltung
import { updateUserAdmin, createNewUserAdmin } from './actions'; 
import { 
  Users, Calendar, BarChart3, Settings, X, ArrowLeft, Power, 
  Plus, AlertTriangle, Save, Edit3, Monitor, UserPlus, 
  Home, Layers, Trash2, PlusCircle, Globe, CheckCircle2, 
  Link as LinkIcon, Info, Printer, ShieldCheck
} from 'lucide-react';

// Exakte Werte laut DB-Schema
const SEATING_OPTIONS = [
  "school with a central corridor", "edv room", "wow room", 
  "exam room", "parliament", "meeting room", "conference room"
];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('planning');
  const [lang, setLang] = useState<'de' | 'en'>('de');
  const [dbTrans, setDbTrans] = useState<any>({});
  
  // Daten-States laut Schema
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  
  // Status-States
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Modal-Zustände
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showUserEditModal, setShowUserEditModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // Edit-Objekte
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [currentBuilding, setCurrentBuilding] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', first_name: '', last_name: '', is_admin: false });
  
  // Kombinationsraum-Logik
  const [isCombi, setIsCombi] = useState(false);
  const [combiParts, setCombiParts] = useState<string[]>([]);

  const t = (key: string) => dbTrans[key]?.[lang] || key;

  useEffect(() => {
    checkAdminAccess();
  }, []);

  // 1. Sicherheit: Berechtigung beim Laden prüfen
  async function checkAdminAccess() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      setIsAuthorized(false);
      router.push('/rooms');
      return;
    }

    setIsAuthorized(true);
    await loadAdminData();
  }

  // 2. Daten laden (Data-Driven)
  async function loadAdminData() {
    const [transRes, profRes, roomRes, buildRes, bookRes, timeRes, equipRes] = await Promise.all([
      supabase.from('translations').select('*'),
      supabase.from('profiles').select('*').order('last_name'),
      supabase.from('rooms').select('*').order('name'),
      supabase.from('buildings').select('*').order('name'),
      supabase.from('bookings').select('*'),
      supabase.from('timeslots').select('*').order('id'),
      supabase.from('equipment').select('*')
    ]);

    if (transRes.data) {
      const tMap: any = {};
      transRes.data.forEach(i => tMap[i.key] = { de: i.de, en: i.en });
      setDbTrans(tMap);
    }
    setProfiles(profRes.data || []);
    setRooms(roomRes.data || []);
    setBuildings(buildRes.data || []);
    setBookings(bookRes.data || []);
    setTimeSlots(timeRes.data?.map(ts => ts.time_string) || []);
    setEquipmentList(equipRes.data || []);
    setLoading(false);
  }

  // --- HANDLER: SPEICHERN & DEAKTIVIEREN ---

  const handleSaveBuilding = async () => {
    const payload = { ...currentBuilding };
    const { error } = payload.id 
      ? await supabase.from('buildings').update(payload).eq('id', payload.id)
      : await supabase.from('buildings').insert([payload]);
    
    if (error) alert("Fehler: " + error.message);
    else { setShowBuildingModal(false); loadAdminData(); }
  };

  const handleSaveRoom = async () => {
    const payload = { ...currentRoom };
    // Technische Spalten entfernen
    delete payload.latitude_delete;
    delete payload.longitude_delete;

    const { data: savedRoom, error: roomError } = payload.id 
      ? await supabase.from('rooms').update(payload).eq('id', payload.id).select().single()
      : await supabase.from('rooms').insert([payload]).select().single();

    if (roomError) { alert("Raum-Fehler: " + roomError.message); return; }

    // Kombinationsraum-Relation pflegen
    if (isCombi && savedRoom) {
      await supabase.from('rooms_combi').upsert({
        room_id_0: savedRoom.id,
        name: savedRoom.name,
        room_id_1: combiParts[0] || null,
        room_id_2: combiParts[1] || null,
        room_id_3: combiParts[2] || null
      }, { onConflict: 'room_id_0' });
    } else if (!isCombi && savedRoom.id) {
        await supabase.from('rooms_combi').delete().eq('room_id_0', savedRoom.id);
    }

    setShowRoomModal(false);
    loadAdminData();
  };

  const toggleStatus = async (type: 'rooms' | 'buildings', item: any) => {
    const nextStatus = !item.is_active;
    const { error } = await supabase.from(type).update({ is_active: nextStatus }).eq('id', item.id);
    
    // Kaskadierung: Wenn Gebäude deaktiviert wird, auch alle Räume deaktivieren
    if (type === 'buildings' && !nextStatus) {
      await supabase.from('rooms').update({ is_active: false }).eq('building_id', item.id);
    }
    
    if (!error) loadAdminData();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createNewUserAdmin(newUser);
      setShowAddUserModal(false);
      await loadAdminData();
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  // --- RENDER-LOGIK ---

  if (loading || isAuthorized === null) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#004a87] text-white">
      <ShieldCheck size={48} className="animate-bounce mb-4 text-[#549BB7]"/>
      <p className="font-bold italic uppercase tracking-widest text-sm">MCI System-Check...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex text-left font-sans text-slate-900 overflow-hidden">
      
      {/* SIDEBAR (Original MCI Blau) */}
      <aside className="w-80 bg-[#004a87] text-white p-10 flex flex-col justify-between sticky top-0 h-screen shadow-2xl">
        <div>
          <div className="mb-12">
            <img src="/MCI.png" className="h-16 object-contain" alt="MCI" />
          </div>
          <nav className="space-y-4">
            <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'planning' ? 'bg-[#549BB7] shadow-lg' : 'hover:bg-white/10 opacity-60'}`}><Calendar size={18}/> Belegungsplan</button>
            <button onClick={() => setActiveTab('buildings')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'buildings' ? 'bg-[#549BB7] shadow-lg' : 'hover:bg-white/10 opacity-60'}`}><Home size={18}/> Gebäude</button>
            <button onClick={() => setActiveTab('rooms')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'rooms' ? 'bg-[#549BB7] shadow-lg' : 'hover:bg-white/10 opacity-60'}`}><Layers size={18}/> Räume</button>
            <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'users' ? 'bg-[#549BB7] shadow-lg' : 'hover:bg-white/10 opacity-60'}`}><Users size={18}/> Mitarbeiter</button>
            <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'stats' ? 'bg-[#549BB7] shadow-lg' : 'hover:bg-white/10 opacity-60'}`}><BarChart3 size={18}/> Statistiken</button>
          </nav>
        </div>
        <button onClick={() => router.push('/rooms')} className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl font-bold text-xs border border-white/10 hover:bg-white/10 transition"><ArrowLeft size={16}/> Zurück</button>
      </aside>

      <main className="flex-1 p-16 overflow-y-auto">
        
        {/* TAB 1: BELEGUNGSPLAN */}
        {activeTab === 'planning' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="flex justify-between items-end">
              <div><h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic mb-1">Campus-Planung</h1><p className="text-gray-400 font-medium text-sm italic">Aktuelle Raumbelegung in Echtzeit</p></div>
              <div className="flex gap-4">
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 bg-white border border-gray-100 rounded-xl font-bold text-[#004a87] outline-none shadow-sm" />
                <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition hover:bg-slate-900"><Printer size={18}/> PDF</button>
              </div>
            </div>
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-x-auto p-10">
              <table className="w-full">
                <thead><tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b"><th className="p-4 text-left">Raum</th>{timeSlots.map(t => <th key={t} className="p-2 border-l">{t}</th>)}</tr></thead>
                <tbody>
                  {rooms.map(room => (
                    <tr key={room.id} className="border-b border-gray-50">
                      <td className="p-4 font-bold text-slate-700 whitespace-nowrap">{room.image} {room.name} {!room.is_active && <AlertTriangle size={12} className="inline text-red-500 ml-1"/>}</td>
                      {timeSlots.map(ts => {
                        const b = bookings.find(b => b.room_id === room.id && b.booking_date === selectedDate && b.status === 'active' && parseInt(ts) >= parseInt(b.start_time) && parseInt(ts) < (parseInt(b.start_time) + (b.duration || 1)));
                        const owner = profiles.find(p => p.id === b?.user_id);
                        return <td key={ts} className="p-1 border-l border-gray-50 h-16 min-w-[100px]">{b ? <div className={`text-[9px] font-bold p-2 rounded-xl h-full flex flex-col justify-center border ${b.is_checked_in ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}><span>{owner?.last_name || 'Gebucht'}</span></div> : <div className="bg-gray-50/20 w-full h-full rounded-xl"></div>}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: GEBÄUDE */}
        {activeTab === 'buildings' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic">Gebäude-Management</h1>
              <button onClick={() => { setCurrentBuilding({ name: '', distance: 0, floors: 1, latitude: 47.2, longitude: 11.3, accessible: true, mci_wifi_ip: '', image_url: '', is_active: true }); setShowBuildingModal(true); }} className="bg-[#549BB7] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl hover:bg-[#438299] transition transform active:scale-95"><Plus size={18}/> Neues Gebäude</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {buildings.map(b => (
                <div key={b.id} className={`bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm flex justify-between items-center group transition-all ${!b.is_active ? 'opacity-40 grayscale bg-gray-50' : ''}`}>
                  <div className="flex items-center gap-6">
                    <div className="bg-gray-50 p-4 rounded-3xl text-[#004a87]">{b.image_url ? <img src={b.image_url} className="w-12 h-12 object-cover rounded-xl shadow-inner" /> : <Home size={32}/>}</div>
                    <div><h3 className="text-xl font-bold text-slate-800">{b.name}</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{b.distance} Min • {b.floors} Etagen</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setCurrentBuilding({...b}); setShowBuildingModal(true); }} className="p-4 text-gray-300 hover:text-[#004a87] transition hover:bg-gray-100 rounded-2xl"><Edit3/></button>
                    <button onClick={() => toggleStatus('buildings', b)} className={`p-4 rounded-2xl transition ${b.is_active ? 'text-gray-200 hover:text-red-500 hover:bg-red-50' : 'text-red-500 hover:text-green-500 hover:bg-green-50'}`}><Power size={20}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: RÄUME */}
        {activeTab === 'rooms' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic">Raum-Pflege</h1>
              <button onClick={() => { 
                setCurrentRoom({ name: '', capacity: 4, floor: 0, is_active: true, equipment: [], seating_arrangement: SEATING_OPTIONS[0], building_id: buildings[0]?.id, image: '🏢', image_url: '', mci_wifi_ip: '', accessible: true }); 
                setIsCombi(false); setCombiParts([]); setShowRoomModal(true); 
              }} className="bg-[#549BB7] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl hover:bg-[#438299] transition transform active:scale-95"><Plus size={18}/> Neuer Raum</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {rooms.map(room => (
                <div key={room.id} className={`bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm flex justify-between items-center group transition-all ${!room.is_active ? 'opacity-40 grayscale bg-gray-50' : ''}`}>
                  <div className="flex items-center gap-6">
                    <div className="bg-gray-50 p-4 rounded-3xl">{room.image_url ? <img src={room.image_url} className="w-12 h-12 object-cover rounded-xl shadow-inner" /> : <span className="text-4xl">{room.image}</span>}</div>
                    <div className="text-left"><h3 className="text-xl font-bold text-slate-800 tracking-tight">{room.name}</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{buildings.find(b => b.id === room.building_id)?.name || 'Ohne Gebäude'} | {room.floor}. OG</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setCurrentRoom({...room}); setIsCombi(!!room.room_combi_id); setCombiParts([]); setShowRoomModal(true); }} className="p-4 text-gray-300 hover:text-[#004a87] transition hover:bg-gray-100 rounded-2xl"><Edit3/></button>
                    <button onClick={() => toggleStatus('rooms', room)} className={`p-4 rounded-2xl transition ${room.is_active ? 'text-gray-200 hover:text-red-500 hover:bg-red-50' : 'text-red-500 hover:bg-green-50 hover:bg-green-50'}`}><Power size={20}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: MITARBEITER */}
        {activeTab === 'users' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic mb-1">Mitarbeiter-Portal</h1>
              <button onClick={() => setShowAddUserModal(true)} className="bg-[#549BB7] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl hover:bg-[#438299] transition transform active:scale-95"><UserPlus size={18}/> Neu erfassen</button>
            </div>
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden text-left">
              <table className="w-full">
                <thead className="bg-gray-50 border-b text-[10px] font-black text-gray-400 uppercase tracking-widest"><tr><th className="p-8">Name</th><th className="p-8">E-Mail</th><th className="p-8">Rolle</th><th className="p-8"></th></tr></thead>
                <tbody>
                  {profiles.map(p => (
                    <tr key={p.id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-8 font-bold text-slate-700">{p.first_name} {p.last_name}</td>
                      <td className="p-8 text-gray-500 text-sm font-medium">{p.email}</td>
                      <td className="p-8"><span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${p.is_admin ? 'bg-[#004a87] text-white italic' : 'bg-gray-100 text-gray-400'}`}>{p.is_admin ? 'ADMIN' : 'USER'}</span></td>
                      <td className="p-8 text-right"><button onClick={() => { setEditUser({...p}); setShowUserEditModal(true); }} className="p-3 text-gray-300 hover:text-[#004a87] transition hover:bg-gray-100 rounded-xl"><Edit3 size={20}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: STATISTIKEN */}
        {activeTab === 'stats' && (
          <div className="space-y-12 animate-in fade-in text-left">
            <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic">Kennzahlen</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm"><p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-6">Reservierungen</p><p className="text-6xl font-bold text-[#004a87] tracking-tighter">{bookings.filter(b => b.status === 'active').length}</p></div>
              <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm"><p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-6">Mitarbeiter</p><p className="text-6xl font-bold text-[#004a87] tracking-tighter">{profiles.length}</p></div>
              <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm"><p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-6">Check-In Quote</p><p className="text-6xl font-bold text-[#f7941d] tracking-tighter">{bookings.length > 0 ? Math.round((bookings.filter(b => b.is_checked_in).length / bookings.length) * 100) : 0}%</p></div>
            </div>
          </div>
        )}
      </main>

      {/* --- POPUPS (MODALS) MIT FESTEN LABELS --- */}

      {/* MODAL: GEBÄUDE */}
      {showBuildingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[500] p-6 animate-in fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center shrink-0"><h3 className="text-2xl font-bold italic uppercase tracking-tight">Gebäude pflegen</h3><button onClick={() => setShowBuildingModal(false)}><X/></button></div>
            <div className="p-12 space-y-6 overflow-y-auto max-h-[75vh] text-left">
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Feld: Gebäude Name</label><input type="text" value={currentBuilding.name} onChange={e => setCurrentBuilding({...currentBuilding, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 font-bold focus:ring-2 focus:ring-[#004a87] outline-none transition-all" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Feld: Bild URL (Außenansicht)</label><input type="text" value={currentBuilding.image_url} onChange={e => setCurrentBuilding({...currentBuilding, image_url: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl text-xs text-blue-600 font-medium" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Geh-Minuten (Zentrum)</label><input type="number" value={currentBuilding.distance} onChange={e => setCurrentBuilding({...currentBuilding, distance: parseInt(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Stockwerke gesamt</label><input type="number" value={currentBuilding.floors} onChange={e => setCurrentBuilding({...currentBuilding, floors: parseInt(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t pt-4 border-gray-50">
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">GPS: Latitude</label><input type="number" step="any" value={currentBuilding.latitude} onChange={e => setCurrentBuilding({...currentBuilding, latitude: parseFloat(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">GPS: Longitude</label><input type="number" step="any" value={currentBuilding.longitude} onChange={e => setCurrentBuilding({...currentBuilding, longitude: parseFloat(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl text-xs font-bold" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Feld: MCI WLAN IP Prefix</label><input type="text" placeholder="z.B. 138.22." value={currentBuilding.mci_wifi_ip} onChange={e => setCurrentBuilding({...currentBuilding, mci_wifi_ip: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-mono text-sm font-bold" /></div>
              <label className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition"><span className="italic uppercase font-bold text-[#004a87] text-xs">Objekt ist Barrierefrei</span><input type="checkbox" checked={currentBuilding.accessible} onChange={e => setCurrentBuilding({...currentBuilding, accessible: e.target.checked})} className="w-6 h-6 accent-[#004a87]" /></label>
              <button onClick={handleSaveBuilding} className="w-full bg-[#004a87] text-white py-5 rounded-[1.5rem] font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"><Save size={18}/> Stammdaten wegschreiben</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RAUM */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[500] p-6 animate-in fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center shrink-0"><h3 className="text-2xl font-bold italic uppercase tracking-tight">Raum-Konfiguration</h3><button onClick={() => setShowRoomModal(false)}><X size={24}/></button></div>
            <div className="p-10 space-y-6 overflow-y-auto max-h-[80vh] text-left">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Emoji/Symbol</label><input type="text" value={currentRoom.image} onChange={e => setCurrentRoom({...currentRoom, image: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl text-center text-2xl font-bold" /></div>
                <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Feld: Raumname</label><input type="text" value={currentRoom.name} onChange={e => setCurrentRoom({...currentRoom, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold ring-1 ring-gray-100" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Feld: Bild URL (Innenansicht)</label><input type="text" value={currentRoom.image_url} onChange={e => setCurrentRoom({...currentRoom, image_url: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl text-xs text-blue-600 font-medium" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Feld: Gebäude zuweisen</label><select value={currentRoom.building_id} onChange={e => setCurrentRoom({...currentRoom, building_id: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold ring-1 ring-gray-100 outline-none">{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Plätze (Capacity)</label><input type="number" value={currentRoom.capacity} onChange={e => setCurrentRoom({...currentRoom, capacity: parseInt(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Etage (Floor)</label><input type="number" value={currentRoom.floor} onChange={e => setCurrentRoom({...currentRoom, floor: parseInt(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Feld: Bestuhlung / Seating Arrangement</label><select value={currentRoom.seating_arrangement} onChange={e => setCurrentRoom({...currentRoom, seating_arrangement: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none ring-1 ring-gray-100">{SEATING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Feld: Ausstattung (Equipment)</label><div className="grid grid-cols-2 gap-2 bg-gray-50 p-6 rounded-3xl border border-gray-100">{equipmentList.map(eq => (<label key={eq.id} className="flex items-center gap-3 cursor-pointer text-[10px] font-bold uppercase italic"><input type="checkbox" checked={currentRoom.equipment?.includes(eq.id)} onChange={e => { const next = e.target.checked ? [...(currentRoom.equipment || []), eq.id] : currentRoom.equipment.filter((x:string) => x !== eq.id); setCurrentRoom({...currentRoom, equipment: next}); }} className="w-4 h-4 accent-[#004a87]" />{lang === 'de' ? eq.name_de : eq.name_en}</label>))}</div></div>
              
              {/* KOMBINATIONS-LOGIK [Wunsch 2] */}
              <div className="border-t pt-6 space-y-4 border-gray-100">
                <label className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl cursor-pointer border border-blue-100"><span className="italic uppercase font-bold text-[#004a87] text-xs">Ist dies ein Kombinationsraum?</span><input type="checkbox" checked={isCombi} onChange={e => setIsCombi(e.target.checked)} className="w-6 h-6 accent-[#004a87]" /></label>
                {isCombi && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center px-2"><label className="text-[10px] font-bold text-gray-400 uppercase">Teilräume verknüpfen</label><button onClick={() => setCombiParts([...combiParts, ""])} className="text-[#549BB7] hover:text-[#004a87] transition"><PlusCircle size={20}/></button></div>
                    {combiParts.map((p, idx) => (
                      <div key={idx} className="flex gap-2"><select value={p} onChange={e => { const n = [...combiParts]; n[idx] = e.target.value; setCombiParts(n); }} className="flex-1 p-4 bg-white border border-blue-50 rounded-2xl text-xs font-bold ring-1 ring-blue-50 outline-none">{rooms.filter(r => r.id !== currentRoom.id && !r.room_combi_id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select><button onClick={() => setCombiParts(combiParts.filter((_, i) => i !== idx))} className="p-4 text-red-300 hover:text-red-500 transition"><Trash2 size={16}/></button></div>
                    ))}
                    {combiParts.length === 0 && <div className="text-center p-6 bg-blue-50/10 rounded-2xl border-2 border-dashed border-blue-50 text-[10px] text-blue-300 italic uppercase font-bold">Keine Teilräume hinzugefügt</div>}
                  </div>
                )}
              </div>
              <button onClick={handleSaveRoom} className="w-full bg-[#004a87] text-white py-6 rounded-[2rem] font-bold shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2"><Save size={20}/> Konfiguration sichern</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MITARBEITER EDIT */}
      {showUserEditModal && editUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[500] p-6 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center shrink-0"><h3 className="text-2xl font-bold italic uppercase tracking-tight">Mitarbeiter pflegen</h3><button onClick={() => setShowUserEditModal(false)}><X size={24}/></button></div>
            <div className="p-12 space-y-6 text-left font-bold text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase ml-2">Vorname</label><input type="text" value={editUser.first_name || ''} onChange={e => setEditUser({...editUser, first_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold ring-1 ring-gray-100" /></div>
                <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase ml-2">Nachname</label><input type="text" value={editUser.last_name || ''} onChange={e => setEditUser({...editUser, last_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold ring-1 ring-gray-100" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase ml-2 tracking-widest italic">Vollständiger Name [Display Only]</label><input type="text" value={editUser.full_name || ''} onChange={e => setEditUser({...editUser, full_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-medium text-gray-500" /></div>
              <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase ml-2 tracking-widest">E-Mail Adresse (Read-Only)</label><input type="email" value={editUser.email || ''} className="w-full p-4 bg-gray-100 rounded-2xl cursor-not-allowed font-medium" disabled /></div>
              <label className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition"><span className="italic uppercase font-bold text-[#004a87] text-xs tracking-tight">Admin-Berechtigungen</span><input type="checkbox" checked={editUser.is_admin} onChange={e => setEditUser({...editUser, is_admin: e.target.checked})} className="w-6 h-6 accent-[#004a87]" /></label>
              <button onClick={async () => { await updateUserAdmin(editUser.id, editUser); setShowUserEditModal(false); loadAdminData(); }} className="w-full bg-[#004a87] text-white py-5 rounded-[1.5rem] font-bold shadow-xl active:scale-95 transition-all">Stammdaten sichern</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MITARBEITER NEU ANLEGEN */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[500] p-6 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center shrink-0"><h3 className="text-2xl font-bold italic uppercase tracking-tight">Mitarbeiter erstellen</h3><button onClick={() => setShowAddUserModal(false)}><X size={24}/></button></div>
            <form onSubmit={handleCreateUser} className="p-12 space-y-6 font-bold text-sm text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase tracking-widest ml-2">Vorname</label><input type="text" required value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none focus:ring-2 focus:ring-[#004a87] transition-all"/></div>
                <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase tracking-widest ml-2">Nachname</label><input type="text" required value={newUser.last_name} onChange={e => setNewUser({...newUser, last_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none focus:ring-2 focus:ring-[#004a87] transition-all"/></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase tracking-widest ml-2">MCI E-Mail</label><input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none focus:ring-2 focus:ring-[#004a87] transition-all"/></div>
              <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase tracking-widest ml-2">Init-Passwort</label><input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none focus:ring-2 focus:ring-[#004a87] transition-all"/></div>
              <label className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition"><span className="italic uppercase text-xs font-bold text-[#004a87]">System-Admin Status</span><input type="checkbox" checked={newUser.is_admin} onChange={e => setNewUser({...newUser, is_admin: e.target.checked})} className="w-6 h-6 accent-[#004a87]"/></label>
              <button type="submit" className="w-full bg-[#004a87] text-white py-5 rounded-[1.5rem] font-bold shadow-xl transition hover:bg-[#549BB7] active:scale-95">Mitarbeiter erstellen</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}