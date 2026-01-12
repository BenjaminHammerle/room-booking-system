'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { updateUserAdmin, createNewUserAdmin } from './actions'; 
import { 
  Users, Calendar, BarChart3, Settings, X, ArrowLeft, Power, 
  Plus, AlertTriangle, Save, Edit3, Monitor, UserPlus, 
  Home, Layers, Trash2, PlusCircle, Globe, CheckCircle2, 
  Link as LinkIcon, Info, Printer // <--- FÜGE 'Printer' HIER HINZU
} from 'lucide-react';

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
  
  const [loading, setLoading] = useState(true);
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
  
  // Kombinationsraum-Steuerung [Wunsch 2]
  const [isCombi, setIsCombi] = useState(false);
  const [combiParts, setCombiParts] = useState<string[]>([]);

  const t = (key: string) => dbTrans[key]?.[lang] || key;

  useEffect(() => { loadAdminData(); }, []);

  async function loadAdminData() {
    setLoading(true);
    try {
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
    } catch (e) { console.error("Load Error", e); }
    setLoading(false);
  }

  // --- SPEICHER LOGIK ---

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
    // Datenmodell-Cleanup: lat/long kommen vom Gebäude
    delete payload.latitude_delete;
    delete payload.longitude_delete;

    const { data: savedRoom, error: roomError } = payload.id 
      ? await supabase.from('rooms').update(payload).eq('id', payload.id).select().single()
      : await supabase.from('rooms').insert([payload]).select().single();

    if (roomError) { alert("Raum-Fehler: " + roomError.message); return; }

    // rooms_combi Logik
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

  // --- TOGGLE LOGIK (DEAKTIVIERUNG) ---

  const toggleBuildingStatus = async (b: any) => {
    const nextStatus = !b.is_active;
    if (!nextStatus && !confirm("Gebäude deaktivieren? Alle Räume darin werden ebenfalls inaktiv.")) return;
    await supabase.from('buildings').update({ is_active: nextStatus }).eq('id', b.id);
    // Kaskadierende Deaktivierung der Räume
    await supabase.from('rooms').update({ is_active: nextStatus }).eq('building_id', b.id);
    loadAdminData();
  };

  const toggleRoomStatus = async (r: any) => {
    const nextStatus = !r.is_active;
    await supabase.from('rooms').update({ is_active: nextStatus }).eq('id', r.id);
    loadAdminData();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createNewUserAdmin(newUser);
      setShowAddUserModal(false);
      loadAdminData();
    } catch (err: any) { alert(err.message); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#004a87] text-white font-bold italic animate-pulse tracking-widest">MCI ADMIN VERIFIZIERT...</div>;

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex text-left font-sans text-slate-900 overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-80 bg-[#004a87] text-white p-10 flex flex-col justify-between sticky top-0 h-screen shadow-2xl">
        <div>
          <img src="/MCI.png" className="h-16 mb-12 object-contain" alt="MCI" />
          <nav className="space-y-4">
            <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'planning' ? 'bg-[#549BB7]' : 'hover:bg-white/10 opacity-60'}`}><Calendar size={18}/> Belegungsplan</button>
            <button onClick={() => setActiveTab('buildings')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'buildings' ? 'bg-[#549BB7]' : 'hover:bg-white/10 opacity-60'}`}><Home size={18}/> Gebäude</button>
            <button onClick={() => setActiveTab('rooms')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'rooms' ? 'bg-[#549BB7]' : 'hover:bg-white/10 opacity-60'}`}><Layers size={18}/> Räume</button>
            <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'users' ? 'bg-[#549BB7]' : 'hover:bg-white/10 opacity-60'}`}><Users size={18}/> Mitarbeiter</button>
            <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition font-bold text-sm ${activeTab === 'stats' ? 'bg-[#549BB7]' : 'hover:bg-white/10 opacity-60'}`}><BarChart3 size={18}/> Statistiken</button>
          </nav>
        </div>
        <button onClick={() => router.push('/rooms')} className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl font-bold text-xs border border-white/10 hover:bg-white/10 transition"><ArrowLeft size={16}/> Zurück</button>
      </aside>

      <main className="flex-1 p-16 overflow-y-auto">
        
        {/* TAB: BELEGUNGSPLAN */}
        {activeTab === 'planning' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="flex justify-between items-end">
              <div><h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic mb-1">Belegungsplan</h1><p className="text-gray-400 font-medium text-sm">Zentrale Campus-Auslastung</p></div>
              <div className="flex gap-4"><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-3 bg-white border border-gray-100 rounded-xl font-bold text-[#004a87] outline-none shadow-sm" /><button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"><Printer size={18}/> PDF</button></div>
            </div>
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-x-auto p-10">
              <table className="w-full">
                <thead><tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b"><th className="p-4 text-left">Raum</th>{timeSlots.map(t => <th key={t} className="p-2 border-l">{t}</th>)}</tr></thead>
                <tbody>
                  {rooms.map(room => (
                    <tr key={room.id} className="border-b border-gray-50">
                      <td className="p-4 font-bold text-slate-700 whitespace-nowrap text-left">{room.image} {room.name} {!room.is_active && <AlertTriangle size={12} className="inline text-red-500 ml-1"/>}</td>
                      {timeSlots.map(ts => {
                        const b = bookings.find(b => b.room_id === room.id && b.booking_date === selectedDate && b.status === 'active' && parseInt(ts) >= parseInt(b.start_time) && parseInt(ts) < (parseInt(b.start_time) + (b.duration || 1)));
                        const owner = profiles.find(p => p.id === b?.user_id);
                        return (
                          <td key={ts} className="p-1 border-l border-gray-50 h-16 min-w-[100px]">
                            {b ? <div className={`text-[9px] font-bold p-2 rounded-xl h-full flex flex-col justify-center border ${b.is_checked_in ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}><span>{owner?.last_name || 'Gebucht'}</span></div> : <div className="bg-gray-50/20 w-full h-full rounded-xl"></div>}
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

        {/* TAB: GEBÄUDE */}
        {activeTab === 'buildings' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic">Gebäude-Management</h1>
              <button onClick={() => { setCurrentBuilding({ name: '', distance: 0, floors: 1, latitude: 47.26, longitude: 11.39, accessible: true, mci_wifi_ip: '', image_url: '', is_active: true }); setShowBuildingModal(true); }} className="bg-[#549BB7] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl hover:bg-[#438299] transition"><Plus size={18}/> Gebäude anlegen</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {buildings.map(b => (
                <div key={b.id} className={`bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm flex justify-between items-center group ${!b.is_active ? 'opacity-40 grayscale' : ''}`}>
                  <div className="flex items-center gap-6 text-left">
                    <div className="bg-gray-50 p-4 rounded-3xl text-[#004a87]">{b.image_url ? <img src={b.image_url} className="w-12 h-12 object-cover rounded-xl" /> : <Home size={32}/>}</div>
                    <div><h3 className="text-xl font-bold text-slate-800">{b.name}</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{b.distance} Min • {b.floors} Etagen</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setCurrentBuilding({...b}); setShowBuildingModal(true); }} className="p-4 text-gray-300 hover:text-[#004a87] transition"><Edit3/></button>
                    <button onClick={() => toggleBuildingStatus(b)} className={`p-4 rounded-xl transition ${b.is_active ? 'text-gray-200 hover:text-red-500' : 'text-red-500 hover:text-green-500'}`}><Power size={20}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: RÄUME */}
        {activeTab === 'rooms' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic">Raum-Pflege</h1>
              <button onClick={() => { 
                setCurrentRoom({ name: '', capacity: 4, floor: 0, is_active: true, equipment: [], seating_arrangement: 'rows', building_id: buildings[0]?.id, image: '🏢', image_url: '', mci_wifi_ip: '', room_combi_id: null }); 
                setIsCombi(false); setCombiParts([]); setShowRoomModal(true); 
              }} className="bg-[#549BB7] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl hover:bg-[#438299] transition"><Plus size={18}/> Raum anlegen</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {rooms.map(room => {
                const b = buildings.find(b => b.id === room.building_id);
                return (
                  <div key={room.id} className={`bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm flex justify-between items-center group transition-all ${!room.is_active ? 'opacity-40 grayscale' : ''}`}>
                    <div className="flex items-center gap-6 text-left">
                      <div className="bg-gray-50 p-4 rounded-3xl">{room.image_url ? <img src={room.image_url} className="w-12 h-12 object-cover rounded-xl" /> : <span className="text-4xl">{room.image}</span>}</div>
                      <div><h3 className="text-xl font-bold text-slate-800">{room.name}</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{b?.name || 'Kein Gebäude'} | {room.floor}. OG</p></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setCurrentRoom({...room}); setIsCombi(!!room.room_combi_id); setCombiParts([]); setShowRoomModal(true); }} className="p-4 text-gray-300 hover:text-[#004a87] transition"><Edit3/></button>
                      <button onClick={() => toggleRoomStatus(room)} className={`p-4 rounded-xl transition ${room.is_active ? 'text-gray-200 hover:text-red-500' : 'text-red-500 hover:text-green-500'}`}><Power size={20}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: MITARBEITER */}
        {activeTab === 'users' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="flex justify-between items-center text-left">
              <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic">Mitarbeiter-Portal</h1>
              <button onClick={() => setShowAddUserModal(true)} className="bg-[#549BB7] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl"><UserPlus size={18}/> Neu anlegen</button>
            </div>
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden text-left">
              <table className="w-full">
                <thead className="bg-gray-50 border-b text-[10px] font-black text-gray-400 uppercase tracking-widest"><tr><th className="p-8">Name</th><th className="p-8">E-Mail</th><th className="p-8">Rolle</th><th className="p-8"></th></tr></thead>
                <tbody>
                  {profiles.map(p => (
                    <tr key={p.id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-8 font-bold text-slate-700">{p.first_name} {p.last_name}</td>
                      <td className="p-8 text-gray-500 text-sm">{p.email}</td>
                      <td className="p-8"><span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${p.is_admin ? 'bg-[#004a87] text-white italic' : 'bg-gray-100 text-gray-400'}`}>{p.is_admin ? 'ADMIN' : 'USER'}</span></td>
                      <td className="p-8 text-right"><button onClick={() => { setEditUser({...p}); setShowUserEditModal(true); }} className="p-3 text-gray-300 hover:text-[#004a87] transition"><Edit3 size={20}/></button></td>
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
            <h1 className="text-3xl font-bold text-[#004a87] tracking-tight uppercase italic">Dashboard Kennzahlen</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm"><p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-6">Reservierungen</p><p className="text-6xl font-bold text-[#004a87]">{bookings.length}</p></div>
              <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm"><p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-6">Raum-Kapazität</p><p className="text-6xl font-bold text-[#004a87]">{rooms.reduce((acc, r) => acc + (r.capacity || 0), 0)}</p></div>
              <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm"><p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-6">Check-In Quote</p><p className="text-6xl font-bold text-[#f7941d]">{bookings.length > 0 ? Math.round((bookings.filter(b => b.is_checked_in).length / bookings.length) * 100) : 0}%</p></div>
            </div>
          </div>
        )}
      </main>

      {/* --- MODALS (FIXED POPUPS WITH LABELS) --- */}

      {/* MODAL: GEBÄUDE PFLEGEN */}
      {showBuildingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[500] p-6 animate-in fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center shrink-0"><h3 className="text-2xl font-bold italic uppercase">Gebäude Stammdaten</h3><button onClick={() => setShowBuildingModal(false)}><X/></button></div>
            <div className="p-12 space-y-6 overflow-y-auto max-h-[75vh] text-left">
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Name des Gebäudes</label><input type="text" value={currentBuilding.name} onChange={e => setCurrentBuilding({...currentBuilding, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 font-bold" placeholder="MCI I" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Bild-URL (Außenansicht)</label><input type="text" value={currentBuilding.image_url} onChange={e => setCurrentBuilding({...currentBuilding, image_url: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl text-xs text-blue-600" placeholder="https://..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Geh-Minuten</label><input type="number" value={currentBuilding.distance} onChange={e => setCurrentBuilding({...currentBuilding, distance: parseInt(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl" /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Gesamt-Etagen</label><input type="number" value={currentBuilding.floors} onChange={e => setCurrentBuilding({...currentBuilding, floors: parseInt(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t pt-4 border-gray-50">
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Latitude [GPS]</label><input type="number" step="any" value={currentBuilding.latitude} onChange={e => setCurrentBuilding({...currentBuilding, latitude: parseFloat(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl text-xs" /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Longitude [GPS]</label><input type="number" step="any" value={currentBuilding.longitude} onChange={e => setCurrentBuilding({...currentBuilding, longitude: parseFloat(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl text-xs" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">MCI WLAN IP Prefix</label><input type="text" placeholder="138.22." value={currentBuilding.mci_wifi_ip} onChange={e => setCurrentBuilding({...currentBuilding, mci_wifi_ip: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-mono text-sm" /></div>
              <label className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition"><span className="italic uppercase font-bold text-[#004a87] text-xs">Barrierefreier Zugang</span><input type="checkbox" checked={currentBuilding.accessible} onChange={e => setCurrentBuilding({...currentBuilding, accessible: e.target.checked})} className="w-6 h-6 accent-[#004a87]" /></label>
              <button onClick={handleSaveBuilding} className="w-full bg-[#004a87] text-white py-5 rounded-[1.5rem] font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"><Save size={18}/> Daten wegschreiben</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RAUM PFLEGEN */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[500] p-6 animate-in fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center shrink-0"><h3 className="text-2xl font-bold italic uppercase tracking-tight">Raum-Konfiguration</h3><button onClick={() => setShowRoomModal(false)}><X/></button></div>
            <div className="p-10 space-y-6 overflow-y-auto max-h-[80vh] text-left font-bold text-sm">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Emoji</label><input type="text" value={currentRoom.image} onChange={e => setCurrentRoom({...currentRoom, image: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl text-center text-2xl font-bold" /></div>
                <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Feld: Raumname</label><input type="text" value={currentRoom.name} onChange={e => setCurrentRoom({...currentRoom, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Bild-URL (Innenansicht)</label><input type="text" value={currentRoom.image_url} onChange={e => setCurrentRoom({...currentRoom, image_url: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl text-xs" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2 tracking-widest">Feld: Gebäude zuweisen</label><select value={currentRoom.building_id} onChange={e => setCurrentRoom({...currentRoom, building_id: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl outline-none ring-1 ring-gray-100">{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Plätze / Capacity</label><input type="number" value={currentRoom.capacity} onChange={e => setCurrentRoom({...currentRoom, capacity: parseInt(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl" /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Stockwerk / Floor</label><input type="number" value={currentRoom.floor} onChange={e => setCurrentRoom({...currentRoom, floor: parseInt(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Bestuhlung / Seating Arrangement</label><select value={currentRoom.seating_arrangement} onChange={e => setCurrentRoom({...currentRoom, seating_arrangement: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold"><option value="rows">Reihen</option><option value="u-shape">U-Form</option><option value="block">Block</option><option value="parliament">Parlamentarisch</option></select></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Feld: Ausstattung (Equipment)</label><div className="grid grid-cols-2 gap-2 bg-gray-50 p-6 rounded-3xl border border-gray-100">{equipmentList.map(eq => (<label key={eq.id} className="flex items-center gap-3 cursor-pointer text-[10px] font-bold uppercase italic"><input type="checkbox" checked={currentRoom.equipment?.includes(eq.id)} onChange={e => { const next = e.target.checked ? [...(currentRoom.equipment || []), eq.id] : currentRoom.equipment.filter((x:string) => x !== eq.id); setCurrentRoom({...currentRoom, equipment: next}); }} className="w-4 h-4 accent-[#004a87]" />{lang === 'de' ? eq.name_de : eq.name_en}</label>))}</div></div>
              
              {/* KOMBINATIONS-PUNKTE [Wunsch 2] */}
              <div className="border-t pt-6 space-y-4 border-gray-100">
                <label className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl cursor-pointer border border-blue-100"><span className="italic uppercase font-bold text-[#004a87] text-xs">Ist dies ein Kombinationsraum?</span><input type="checkbox" checked={isCombi} onChange={e => setIsCombi(e.target.checked)} className="w-6 h-6 accent-[#004a87]" /></label>
                {isCombi && (
                  <div className="space-y-4 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center px-2"><label className="text-[10px] font-bold text-gray-400 uppercase">Teilräume verknüpfen</label><button onClick={() => setCombiParts([...combiParts, ""])} className="text-[#549BB7] hover:text-[#004a87]"><PlusCircle size={20}/></button></div>
                    {combiParts.map((p, idx) => (
                      <div key={idx} className="flex gap-2"><select value={p} onChange={e => { const n = [...combiParts]; n[idx] = e.target.value; setCombiParts(n); }} className="flex-1 p-4 bg-white border border-blue-50 rounded-2xl text-xs font-bold ring-1 ring-blue-50">{rooms.filter(r => r.id !== currentRoom.id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select><button onClick={() => setCombiParts(combiParts.filter((_, i) => i !== idx))} className="p-4 text-red-300"><Trash2 size={16}/></button></div>
                    ))}
                    {combiParts.length === 0 && <div className="text-center p-6 bg-blue-50/30 rounded-2xl border-2 border-dashed border-blue-50 text-[10px] text-blue-300 italic uppercase">Keine Teilräume zugewiesen</div>}
                  </div>
                )}
              </div>
              <button onClick={handleSaveRoom} className="w-full bg-[#004a87] text-white py-6 rounded-[2rem] font-bold shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2"><Save size={20}/> Raum-Konfiguration sichern</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MITARBEITER EDIT */}
      {showUserEditModal && editUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[500] p-6 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center shrink-0"><h3 className="text-2xl font-bold italic uppercase tracking-tight">Mitarbeiter pflegen</h3><button onClick={() => setShowUserEditModal(false)}><X/></button></div>
            <div className="p-12 space-y-6 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase ml-2">Vorname</label><input type="text" value={editUser.first_name || ''} onChange={e => setEditUser({...editUser, first_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase ml-2">Nachname</label><input type="text" value={editUser.last_name || ''} onChange={e => setEditUser({...editUser, last_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase ml-2">Voller Name [Read-Only]</label><input type="text" value={editUser.full_name || ''} className="w-full p-4 bg-gray-100 rounded-2xl cursor-not-allowed" disabled /></div>
              <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase ml-2">MCI E-Mail</label><input type="email" value={editUser.email || ''} className="w-full p-4 bg-gray-100 rounded-2xl cursor-not-allowed" disabled /></div>
              <label className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition"><span className="italic uppercase font-bold text-[#004a87] text-xs">Admin-Status</span><input type="checkbox" checked={editUser.is_admin} onChange={e => setEditUser({...editUser, is_admin: e.target.checked})} className="w-6 h-6 accent-[#004a87]" /></label>
              <button onClick={async () => { await updateUserAdmin(editUser.id, editUser); setShowUserEditModal(false); loadAdminData(); }} className="w-full bg-[#004a87] text-white py-5 rounded-[1.5rem] font-bold shadow-xl active:scale-95 transition-all">Mitarbeiter-Daten sichern</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MITARBEITER NEU */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[500] p-6 animate-in zoom-in-95">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center shrink-0"><h3 className="text-2xl font-bold italic uppercase tracking-tight">Mitarbeiter erstellen</h3><button onClick={() => setShowAddUserModal(false)}><X size={24}/></button></div>
            <form onSubmit={handleCreateUser} className="p-12 space-y-6 font-bold text-sm text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase tracking-widest">Vorname</label><input type="text" required value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none focus:ring-2 focus:ring-[#004a87] transition-all"/></div>
                <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase tracking-widest">Nachname</label><input type="text" required value={newUser.last_name} onChange={e => setNewUser({...newUser, last_name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none focus:ring-2 focus:ring-[#004a87] transition-all"/></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase tracking-widest">E-Mail</label><input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none focus:ring-2 focus:ring-[#004a87] transition-all"/></div>
              <div className="space-y-1"><label className="text-[10px] text-gray-400 uppercase tracking-widest">Initiales Passwort</label><input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 outline-none focus:ring-2 focus:ring-[#004a87] transition-all"/></div>
              <label className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition"><span className="italic uppercase text-xs">Admin-Status</span><input type="checkbox" checked={newUser.is_admin} onChange={e => setNewUser({...newUser, is_admin: e.target.checked})} className="w-6 h-6 accent-[#004a87]"/></label>
              <button type="submit" className="w-full bg-[#004a87] text-white py-5 rounded-[1.5rem] font-bold shadow-xl transition hover:bg-[#549BB7] active:scale-95">Mitarbeiter erstellen</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}