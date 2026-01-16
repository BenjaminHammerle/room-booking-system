"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Calendar, Users, Monitor, BookOpen, Wifi, X,
  Clock, LogOut, ShieldCheck, List, SlidersHorizontal,
  ChevronLeft, ChevronRight, CheckCircle2, User as UserIcon,
  Globe, ChevronDown, Settings, MapPin, AlertCircle, XCircle, Search,
  Layers, Filter, Printer, Info,
} from "lucide-react";

export default function RoomBookingPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"de" | "en">("de");

  // --- DATA STATES ---
  const [dbTrans, setDbTrans] = useState<any>({});
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // --- HELPERS ---
  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  // --- SMART INITIALIZATION ---
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    if (now.getHours() > 23 || (now.getHours() === 23 && now.getMinutes() > 15)) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split("T")[0];
    }
    return now.toISOString().split("T")[0];
  });

  const [selectedTime, setSelectedTime] = useState(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    if ((currentHour >= 23 && currentMin > 15) || currentHour < 7) return "07:00";
    let h = currentHour;
    let m = Math.ceil(currentMin / 15) * 15;
    if (m === 60) { h++; m = 0; }
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  });

  // --- FILTER STATES ---
  const [searchQuery, setSearchQuery] = useState("");
  const [minCapacity, setMinCapacity] = useState("0");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  const [selectedSeating, setSelectedSeating] = useState<string>("all");

  // --- UI STATES ---
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [duration, setDuration] = useState(1); 
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(1);

  // t-Funktion mit Normalisierung auf Kleinschreibung
  const t = (key: string) => {
    if (!key) return "";
    const searchKey = key.toLowerCase();
    return dbTrans[searchKey]?.[lang] || key;
  };

  const maxRoomCapacity = useMemo(() => {
    if (rooms.length === 0) return 100;
    return Math.max(...rooms.map((r) => r.capacity));
  }, [rooms]);

  const translateSeating = (value: string) => t(value);

  useEffect(() => {
    initApp();
  }, [selectedDate]);

  async function initApp() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    setUser(session.user);

    const [transRes, equipRes, roomsRes, bookingsRes, profileRes] = await Promise.all([
      supabase.from("translations").select("*"),
      supabase.from("equipment").select("*"),
      supabase.from("rooms").select(`
                *,
                building:buildings!rooms_building_id_fkey (id, name, latitude, longitude),
                room_combi:rooms_combi!rooms_room_combi_id_fkey (id, name, room_id_0, room_id_1, room_id_2, room_id_3)
            `),
      supabase.from("bookings").select("*"),
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
    ]);

    if (transRes.data) {
      const tMap: any = {};
      transRes.data.forEach((i) => (tMap[i.key.toLowerCase()] = { de: i.de, en: i.en }));
      setDbTrans(tMap);
    }

    if (equipRes.data) setEquipmentList(equipRes.data);
    if (roomsRes.data) setRooms(roomsRes.data);

    if (roomsRes.data) {
      const uniqueBuildings = Array.from(
        new Map(roomsRes.data.filter((r) => r.building).map((r) => [r.building.id, r.building])).values()
      ) as any[];
      setBuildings(uniqueBuildings);
    }

    if (profileRes.data) {
      setIsAdmin(profileRes.data.is_admin || false);
      setFirstName(profileRes.data.first_name || "MCI");
      setLastName(profileRes.data.last_name || "User");
    }
    if (bookingsRes.data) {
      setBookings(bookingsRes.data);
      checkAutoRelease(bookingsRes.data);
    }
    setLoading(false);
  }

  // --- LOGIK: BELEGUNG ---
  const isSlotOccupied = (roomId: string, date: string, time: string) => {
    const checkMin = timeToMinutes(time);
    return bookings.some((b) => {
      if (b.room_id !== roomId || b.booking_date !== date || b.status !== "active") return false;
      const startMin = timeToMinutes(b.start_time);
      const endMin = startMin + (b.duration || 1) * 60;
      return checkMin >= startMin && checkMin < endMin;
    });
  };

  const isAnyRoomOccupied = (roomIds: string[], date: string, startTime: string, durationHours: number) => {
    const reqStartMin = timeToMinutes(startTime);
    const reqEndMin = reqStartMin + durationHours * 60;
    return bookings.some((b) => {
      if (b.status !== "active" || b.booking_date !== date || !roomIds.includes(b.room_id)) return false;
      const bStartMin = timeToMinutes(b.start_time);
      const bEndMin = bStartMin + (b.duration || 1) * 60;
      return reqStartMin < bEndMin && bStartMin < reqEndMin;
    });
  };

  const getConflictRoomIds = (room: any): string[] => {
    const c = room?.room_combi;
    if (!c) return [room.id];
    const singles = [c.room_id_1, c.room_id_2, c.room_id_3].filter(Boolean);
    if (room.id === c.room_id_0) return Array.from(new Set([c.room_id_0, ...singles]));
    if (singles.includes(room.id)) return Array.from(new Set([room.id, c.room_id_0]));
    return [room.id];
  };

  const checkSeriesAvailability = (room: any, startDate: string, startTime: string, durationHours: number, weeks: number) => {
    const plan = [];
    for (let i = 0; i < weeks; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i * 7);
      const currentDate = d.toISOString().split("T")[0];
      const conflictIds = getConflictRoomIds(room);
      if (!isAnyRoomOccupied(conflictIds, currentDate, startTime, durationHours)) {
        plan.push({ date: currentDate, room: room, status: "ok" });
      } else {
        const alternative = rooms.find((r) =>
            r.building_id === room.building_id && r.id !== room.id && r.is_active &&
            r.capacity >= (parseInt(minCapacity) || 0) &&
            !isAnyRoomOccupied(getConflictRoomIds(r), currentDate, startTime, durationHours)
        );
        if (alternative) plan.push({ date: currentDate, room: alternative, status: "alternative" });
        else plan.push({ date: currentDate, room: null, status: "conflict" });
      }
    }
    return plan;
  };

  // --- LOGIK: EFFIZIENZ-SORTIERUNG ---
  const filteredRooms = rooms
    .filter((room) => {
      if (!room.is_active || isSlotOccupied(room.id, selectedDate, selectedTime)) return false;
      if (searchQuery && !room.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (minCapacity && room.capacity < parseInt(minCapacity)) return false;
      if (selectedBuildingId !== "all" && room.building_id !== selectedBuildingId) return false;
      if (selectedSeating !== "all" && room.seating_arrangement !== selectedSeating) return false;
      if (selectedEquipment.length > 0 && !selectedEquipment.every((id) => room.equipment?.includes(id))) return false;
      return true;
    })
    // Sortierung und BestMatch
    .sort((a, b) => {
      const req = parseInt(minCapacity) || 0;
      const excessA = a.capacity - req;
      const excessB = b.capacity - req;

      const isInPufferA = excessA >= 0 && excessA <= 2;
      const isInPufferB = excessB >= 0 && excessB <= 2;

      // 1. Priorität: Wer im Puffer liegt, gewinnt gegen "Overkill"-Kapazitäten
      if (isInPufferA && !isInPufferB) return -1;
      if (!isInPufferA && isInPufferB) return 1;

      // 2. Priorität: Wenn BEIDE im Puffer sind 
      if (isInPufferA && isInPufferB) {
        const equipCountA = a.equipment?.length || 0;
        const equipCountB = b.equipment?.length || 0;
        if (equipCountA !== equipCountB) return equipCountA - equipCountB; // Weniger Equipment spart Ressourcen
        return excessA - excessB; // Bei gleichem Equipment: näher an Kapazität
      }

      // 3. Priorität: Wenn BEIDE AUSSERHALB des Puffers sind gewinnt der kleinste Raum
      if (excessA !== excessB) return excessA - excessB;
      
      // Tie-Breaker: Equipment
      return (a.equipment?.length || 0) - (b.equipment?.length || 0);
    });

  const getUpcomingBookings = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    return bookings.filter((b) => b.user_id === user?.id && b.status === "active" && b.booking_date >= todayStr)
      .sort((a, b) => (a.booking_date + a.start_time).localeCompare(b.booking_date + b.start_time)).slice(0, 5);
  };

  const checkAutoRelease = async (all: any[]) => {
    const now = new Date();
    const toRelease = all.filter((b) => b.status === "active" && !b.is_checked_in && (now.getTime() - new Date(`${b.booking_date}T${b.start_time}`).getTime()) / 60000 >= 10);
    for (const b of toRelease) await supabase.from("bookings").update({ status: "released" }).eq("id", b.id);
  };

  const handleCancel = async (id: string) => {
    if (!confirm(t("confirm_cancel"))) return;
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    initApp();
  };

  const getMaxDuration = () => {
    if (!selectedRoom) return 0.25;
    const startMin = timeToMinutes(selectedTime);
    let currentMaxMin = 0;
    for (let m = 15; m <= 600; m += 15) { 
      const checkTimeMin = startMin + m;
      if (checkTimeMin > 1410) break; // 23:30 Limit
      if (isSlotOccupied(selectedRoom.id, selectedDate, minutesToTime(checkTimeMin))) break;
      currentMaxMin = m;
    }
    return currentMaxMin / 60;
  };

  const isCheckInWindowOpen = (booking: any) => {
    const now = new Date();
    const start = new Date(`${booking.booking_date}T${booking.start_time}`);
    const thirtyMinsBefore = new Date(start.getTime() - 30 * 60000);
    const end = new Date(start.getTime() + (booking.duration || 1) * 3600000);
    return now >= thirtyMinsBefore && now <= end && booking.status === "active";
  };

  const handleUpdateProfile = async () => {
    const { error } = await supabase.from("profiles").update({ first_name: firstName, last_name: lastName }).eq("id", user.id);
    if (!error) { setShowSettingsModal(false); initApp(); }
  };

  const handleCheckIn = async (booking: any) => {
    if (!isCheckInWindowOpen(booking)) { alert(t("checkin_early_error")); return; }
    const isLocal = window.location.hostname === "localhost";
    const verifyCode = async () => {
      const input = prompt(t("checkin_prompt"));
      if (input?.toUpperCase() === booking.booking_code) {
        const { error } = await supabase.from("bookings").update({ is_checked_in: true, checked_in_at: new Date() }).eq("id", booking.id);
        if (!error) { alert(t("checkin_ok")); initApp(); }
      } else alert(t("checkin_wrong_code"));
    };
    if (isLocal) { await verifyCode(); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const room = rooms.find((r) => r.id === booking.room_id);
        const bLat = room?.building?.latitude ?? 47.2692;
        const bLon = room?.building?.longitude ?? 11.3933;
        const R = 6371e3;
        const dLat = ((pos.coords.latitude - bLat) * Math.PI) / 180;
        const dLon = ((pos.coords.longitude - bLon) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((pos.coords.latitude * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const dist = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        if (dist <= 150) await verifyCode();
        else {
            const ipCheck = await fetch('https://api.ipify.org?format=json').then(res => res.json());
            if (ipCheck.ip.startsWith('138.22')) await verifyCode();
            else alert(t("not_at_mci"));
        }
      }, () => alert(t("gps_required"))
    );
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F8F9FB] text-[#004a87] font-bold italic uppercase tracking-widest animate-pulse"><ShieldCheck size={48} className="mr-4 text-[#549BB7]" />MCI System-Check...</div>;

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900">
      <nav className="bg-white border-b sticky top-0 z-50 px-12 h-24 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-12">
          <img src="/MCI.png" alt="MCI" className="h-16 w-auto cursor-pointer" onClick={() => router.push("/rooms")} />
          <button onClick={() => router.push("/reservations")} className="flex items-center gap-2 text-slate-600 font-bold hover:text-[#004a87] transition">
            <Calendar size={20} className="text-gray-300" /> {t("nav_bookings")}
          </button>
        </div>
        <div className="flex items-center gap-8">
          <button onClick={() => setLang(lang === "de" ? "en" : "de")} className="flex items-center gap-2 text-xs font-bold uppercase text-gray-400 hover:text-[#004a87] transition">
            <Globe size={16} /> {lang}
          </button>
          <div className="relative">
            <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-3 group transition-all">
              <div className="bg-gray-100 w-11 h-11 rounded-full flex items-center justify-center text-[#004a87] border border-gray-200 shadow-sm transition group-hover:border-[#549BB7]"><UserIcon size={22} /></div>
              <span className="font-bold text-slate-700">{firstName}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-4 w-64 bg-white rounded-[2rem] shadow-2xl border p-2 z-[60] animate-in fade-in slide-in-from-top-2">
                <button onClick={() => { setShowSettingsModal(true); setShowUserMenu(false); }} className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-gray-50 text-slate-700 font-bold transition text-sm">
                  <Settings size={18} className="text-gray-300" /> {t("nav_profile")}
                </button>
                {isAdmin && <button onClick={() => router.push("/admin")} className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-blue-50 text-[#004a87] font-bold transition text-sm"><ShieldCheck size={18} /> {t("nav_admin")}</button>}
                <hr className="my-2 border-gray-50" />
                <button onClick={() => { supabase.auth.signOut(); router.push("/login"); }} className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-red-50 text-red-500 font-bold transition text-sm"><LogOut size={18} /> {t("nav_logout")}</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-[1750px] mx-auto p-12 flex flex-col lg:flex-row gap-16 relative">
        <aside className="w-full lg:w-[420px] shrink-0">
          <div className="bg-white rounded-[3.5rem] p-12 border border-gray-100 shadow-sm sticky top-32 space-y-6">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-lg mb-2 pb-4 border-b border-gray-50 uppercase tracking-tighter italic">
              <Filter size={18} className="text-[#f7941d]" /> {t("filter_title")}
            </div>

            <div className="space-y-2 text-left">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-3">{t("filter_search_label")}</label>
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input type="text" placeholder={t("filter_search_placeholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-50 p-4 pl-12 rounded-[1.5rem] font-bold outline-none focus:ring-2 focus:ring-[#f7941d] transition-all shadow-inner" />
              </div>
            </div>

            <div className="space-y-4 text-left">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-3">{t("filter_time_label")}</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-[#004a87] text-sm shadow-inner mb-4" />
              
              <div className="flex items-center gap-2">
                  <select
                    value={selectedTime.split(':')[0]}
                    onChange={(e) => setSelectedTime(`${e.target.value}:${selectedTime.split(':')[1]}`)}
                    className="flex-1 bg-gray-50 p-4 rounded-2xl font-bold text-sm outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004a87] appearance-none text-center cursor-pointer shadow-inner transition-all hover:bg-white"
                  >
                    {Array.from({ length: 17 }, (_, i) => (i + 7).toString().padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="font-bold text-[#004a87]">:</span>
                  <select
                    value={selectedTime.split(':')[1]}
                    onChange={(e) => setSelectedTime(`${selectedTime.split(':')[0]}:${e.target.value}`)}
                    className="flex-1 bg-gray-50 p-4 rounded-2xl font-bold text-sm outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-[#f7941d] appearance-none text-center cursor-pointer shadow-inner transition-all hover:bg-white"
                  >
                    {['00', '15', '30', '45'].filter(m => {
                        if (selectedTime.split(':')[0] === '23') return parseInt(m) <= 15;
                        return true;
                    }).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
              </div>
            </div>

            <div className="space-y-4 text-left">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-3">{t("filter_cap")}</label>
              <div className="flex items-center gap-4">
                <input type="range" min="0" max={maxRoomCapacity} value={minCapacity} onChange={(e) => setMinCapacity(e.target.value)} className="flex-1 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#f7941d]" />
                <input type="number" value={minCapacity} onChange={(e) => setMinCapacity(e.target.value)} className="w-16 bg-gray-50 p-2 rounded-xl font-bold text-center outline-none focus:ring-2 focus:ring-[#f7941d] text-xs shadow-inner" />
              </div>
              <p className="text-[10px] text-gray-400 font-bold italic text-center">{t('min_label')} {minCapacity} {t('capacity_label')}</p>
            </div>

            <div className="space-y-2 text-left">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-3">{t("filter_location")}</label>
              <select value={selectedBuildingId} onChange={(e) => setSelectedBuildingId(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none text-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004a87]">
                <option value="all">{t("filter_all")}</option>
                {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="space-y-2 text-left">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-3">{t("filter_seating")}</label>
              <select value={selectedSeating} onChange={(e) => setSelectedSeating(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none text-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004a87]">
                <option value="all">{t("filter_all")}</option>
                {Array.from(new Set(rooms.map((r) => r.seating_arrangement).filter(Boolean))).map((s) => <option key={s} value={s}>{translateSeating(s)}</option>)}
              </select>
            </div>

            <div className="space-y-6 text-left">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-3 block">{t("filter_equip")}</label>
              <div className="grid gap-3 px-2 pt-2">
                {equipmentList.map((eq) => (
                  <label key={eq.id} className="flex items-center gap-4 cursor-pointer group">
                    <input type="checkbox" checked={selectedEquipment.includes(eq.id)} onChange={() => setSelectedEquipment((prev) => prev.includes(eq.id) ? prev.filter((id) => id !== eq.id) : [...prev, eq.id])} className="w-5 h-5 rounded-md border-gray-200 text-[#004a87] focus:ring-[#004a87] shadow-sm" />
                    <span className={`text-xs font-bold transition ${selectedEquipment.includes(eq.id) ? "text-[#004a87]" : "text-gray-500 group-hover:text-gray-700"}`}>{lang === "de" ? eq.name_de : eq.name_en}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={() => { setSearchQuery(""); setMinCapacity("0"); setSelectedEquipment([]); setSelectedBuildingId("all"); setSelectedSeating("all"); }} className="w-full py-4 text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-red-400 transition italic flex items-center justify-center gap-2 border-t border-dashed border-gray-100 mt-4"><XCircle size={14} /> {t("filter_reset_btn")}</button>
          </div>
        </aside>

        <div className="flex-1 space-y-16">
          <section className="text-left flex justify-between items-end animate-in fade-in slide-in-from-top-4 duration-1000">
            <div><h1 className="text-5xl font-bold text-[#004a87] mb-3 tracking-tighter uppercase italic">{t("title")}</h1><p className="text-gray-400 font-medium text-xl italic">{filteredRooms.length} {t("subtitle")}</p></div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {filteredRooms.map((room, idx) => (
              <div key={room.id} className="bg-white rounded-[4rem] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-2xl transition-all duration-700 text-left relative">
                <div className="relative h-72 bg-gray-200">
                  <img src={room.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" alt={room.name} />
                  <div className="absolute top-8 right-8 bg-[#4ade80] text-white px-6 py-2.5 rounded-full text-[10px] font-bold uppercase shadow-xl tracking-widest">{t("status_free")}</div>
                  
                  {/* EQUIPMENT BADGES AUF BILD (WIEDER DA) */}
                  <div className="absolute bottom-6 left-8 flex flex-wrap gap-2 pr-6">
                    {room.equipment?.map((eqId: string) => {
                      const eq = equipmentList.find((e) => e.id === eqId);
                      return (eq && <div key={eqId} className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm text-[#004a87] text-[9px] font-bold uppercase tracking-wider border border-white/50">{lang === "de" ? eq.name_de : eq.name_en}</div>);
                    })}
                  </div>
                </div>

                <div className="p-12">
                  <div className="flex justify-between items-start mb-4"><h3 className="font-bold text-4xl tracking-tighter leading-none">{room.name}</h3>{idx === 0 && (<div className="bg-blue-50 text-[#549BB7] p-2.5 rounded-2xl border border-blue-100 shadow-sm" title={t("efficiency_best_match")}><Info size={20} /></div>)}</div>
                  
                  <div className="grid grid-cols-2 gap-y-4 mb-10 text-gray-400 font-bold text-[11px] uppercase tracking-widest">
                    <span className="flex items-center gap-2.5 bg-gray-50 px-4 py-2 rounded-2xl w-fit shadow-sm"><Users size={16} className="text-[#f7941d]" /> {room.capacity} {t("capacity_label")}</span>
                    
                    {/* RAUMTYP / BESTUHLUNG (WIEDER DA) */}
                    {room.seating_arrangement && (
                      <span className="flex items-center gap-2.5 bg-gray-50 px-4 py-2 rounded-2xl w-fit shadow-sm"><List size={16} className="text-[#f7941d]" /> {translateSeating(room.seating_arrangement)}</span>
                    )}

                    <span className="flex items-center gap-2.5 bg-gray-50 px-4 py-2 rounded-2xl w-fit shadow-sm"><MapPin size={16} className="text-[#f7941d]" /> {room?.building?.name}</span>
                    <span className="flex items-center gap-2.5 bg-gray-50 px-4 py-2 rounded-2xl w-fit shadow-sm"><Layers size={16} className="text-[#f7941d]" /> {room.floor}. OG</span>
                  </div>
                  <button onClick={() => { setSelectedRoom(room); setDuration(1); setIsRecurring(false); setShowBookingModal(true); }} className="w-full bg-[#004a87] text-white py-7 rounded-[2.5rem] font-bold text-lg shadow-xl shadow-blue-900/10 hover:bg-[#549BB7] transition active:scale-95 transform">{t("btn_reserve")}</button>
                </div>
              </div>
            ))}
          </div>

          <section className="bg-white rounded-[4.5rem] p-14 border border-gray-100 shadow-sm text-left">
            <div className="flex justify-between items-center mb-12 border-b border-gray-50 pb-6"><h2 className="text-3xl font-bold flex items-center gap-5 text-slate-800 tracking-tight italic uppercase"><Clock className="text-[#549BB7]" size={40} /> {t("dashboard_title")}</h2>{getUpcomingBookings().length > 0 && (<button onClick={() => window.print()} className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:text-[#004a87] transition shadow-sm"><Printer size={24} /></button>)}</div>
            <div className="grid gap-8">
              {getUpcomingBookings().map((b) => {
                const room = rooms.find((r) => r.id === b.room_id);
                const canCheckIn = isCheckInWindowOpen(b);
                return (
                  <div key={b.id} className="bg-gray-50 p-12 rounded-[3.5rem] flex flex-col md:flex-row justify-between items-center border border-gray-100 transition hover:bg-white hover:shadow-2xl gap-8 group">
                    <div className="flex items-center gap-10 w-full text-left">
                      <div className="text-7xl p-8 bg-white rounded-[2.5rem] shadow-sm group-hover:scale-110 transition-transform duration-500">{room?.image || "🏢"}</div>
                      <div>
                        <div className="font-bold text-3xl text-slate-900 tracking-tighter mb-1">{room?.name}</div>
                        <div className="text-[#f7941d] font-bold text-sm uppercase tracking-widest">{new Date(b.booking_date).toLocaleDateString()} • {b.start_time} Uhr</div>
                        <div className="mt-4 flex items-center gap-4"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("code_label")}:</span><span className="bg-white px-6 py-2.5 rounded-2xl ring-2 ring-gray-100 font-mono font-bold text-2xl text-[#004a87] tracking-[0.3em] shadow-inner">{b.booking_code}</span></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      {!b.is_checked_in && (<button onClick={() => handleCancel(b.id)} className="p-5 text-red-300 hover:text-red-500 rounded-3xl transition-all hover:scale-110"><XCircle size={36} /></button>)}
                      {b.is_checked_in ? (<div className="bg-green-100 text-green-700 px-12 py-6 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-4 shadow-sm border border-green-200"><CheckCircle2 size={24} /> {t("checkin_ok")}</div>) : (<button onClick={() => handleCheckIn(b)} className={`px-14 py-6 rounded-full text-xs font-bold uppercase transition-all shadow-xl ${canCheckIn ? "bg-[#549BB7] text-white hover:bg-[#438299] scale-105 active:scale-95" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>{t("checkin_btn")}</button>)}
                    </div>
                  </div>
                );
              })}
              {getUpcomingBookings().length === 0 && <p className="text-gray-300 italic uppercase font-bold text-center py-20 tracking-widest opacity-50">{t('dashboard_empty')}</p>}
            </div>
          </section>
        </div>
      </main>

      {/* MODALS */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xl flex items-center justify-center p-6 z-[100] animate-in fade-in duration-500 text-left text-sm font-bold">
          <div className="bg-white rounded-[5rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-[#004a87] p-12 text-white flex justify-between items-center shrink-0">
              <div><p className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.2em] mb-2 italic">MCI Room Booking</p><h3 className="text-5xl font-bold uppercase italic tracking-tighter">{selectedRoom?.name}</h3></div>
              <button onClick={() => setShowBookingModal(false)} className="bg-white/10 p-5 rounded-full hover:bg-white/20 transition-all hover:rotate-90"><X size={28} /></button>
            </div>
            <div className="p-14 space-y-12 max-h-[75vh] overflow-y-auto">
              <div className="space-y-4 font-bold">
                <label className="text-[11px] text-gray-400 uppercase font-black ml-6 tracking-widest">{t("modal_time_selected")}</label>
                <div className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 flex items-center gap-8 text-2xl font-bold text-slate-800 shadow-inner">
                  <div className="bg-blue-500 p-4 rounded-2xl text-white shadow-lg"><Calendar size={32} /></div>
                  {new Date(selectedDate).toLocaleDateString()} • {selectedTime} Uhr
                </div>
              </div>

              <div className="space-y-6">
                  <label className="text-[11px] text-gray-400 uppercase font-black ml-6 tracking-widest">{t('modal_label_end')}</label>
                  <div className="flex items-center gap-4">
                      <select 
                        value={Math.floor((timeToMinutes(selectedTime) + duration * 60)/60)}
                        onChange={(e) => {
                           const newHH = parseInt(e.target.value);
                           const curMM = (timeToMinutes(selectedTime) + duration * 60) % 60;
                           const newEnd = newHH * 60 + curMM;
                           if (newEnd > timeToMinutes(selectedTime)) setDuration((newEnd - timeToMinutes(selectedTime))/60);
                        }}
                        className="flex-1 bg-gray-50 p-8 rounded-[2.5rem] font-bold text-2xl outline-none ring-2 ring-gray-100 focus:ring-8 focus:ring-[#004a87]/10 transition-all appearance-none text-center cursor-pointer shadow-sm"
                      >
                         {Array.from({length: 17}, (_, i) => i + 7).map(h => (
                           <option key={h} value={h} disabled={h < Math.floor(timeToMinutes(selectedTime)/60)}>
                             {h.toString().padStart(2, '0')}
                           </option>
                         ))}
                      </select>
                      <span className="text-3xl font-bold text-[#004a87]">:</span>
                      <select 
                        value={(timeToMinutes(selectedTime) + duration * 60) % 60}
                        onChange={(e) => {
                           const curHH = Math.floor((timeToMinutes(selectedTime) + duration * 60)/60);
                           const newMM = parseInt(e.target.value);
                           const newEnd = curHH * 60 + newMM;
                           if (newEnd > timeToMinutes(selectedTime) && newEnd <= 1410) setDuration((newEnd - timeToMinutes(selectedTime))/60);
                        }}
                        className="flex-1 bg-gray-50 p-8 rounded-[2.5rem] font-bold text-2xl outline-none ring-2 ring-gray-100 focus:ring-8 focus:ring-[#f7941d]/10 transition-all appearance-none text-center cursor-pointer shadow-sm"
                      >
                         {[0, 15, 30, 45].map(m => (
                           <option key={m} value={m} disabled={(Math.floor((timeToMinutes(selectedTime) + duration * 60)/60) * 60 + m) <= timeToMinutes(selectedTime)}>
                             {m.toString().padStart(2, '0')}
                           </option>
                         ))}
                      </select>
                  </div>
                  <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 flex justify-between items-center px-10 shadow-inner">
                      <span className="text-blue-900/40 text-[10px] uppercase font-black tracking-widest">{t('label_duration')}:</span>
                      <span className="text-[#004a87] font-bold text-2xl italic tracking-tighter">{duration >= 1 ? `${duration}h` : `${duration * 60}min`}</span>
                  </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-gray-100">
                <label className="flex items-center gap-4 cursor-pointer group bg-gray-50 p-6 rounded-3xl transition-all hover:bg-blue-50">
                  <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-6 h-6 rounded-md border-gray-300 text-[#004a87] focus:ring-[#004a87]" />
                  <span className="text-sm font-black uppercase tracking-tighter italic text-slate-700">{t('label_recurring')}</span>
                </label>
                {isRecurring && (
                  <div className="animate-in slide-in-from-top-4 duration-500 space-y-6">
                    <input type="number" min="2" max="12" value={recurringWeeks} onChange={(e) => setRecurringWeeks(parseInt(e.target.value))} className="w-full bg-white p-6 rounded-[2rem] border-2 border-gray-100 font-bold text-xl" />
                    <div className="bg-blue-50/50 rounded-[2.5rem] p-8 border border-blue-100">
                      <h4 className="text-[10px] uppercase font-black text-[#549BB7] mb-4 flex items-center gap-2 italic"><Layers size={14} /> {t('label_building_guarantee')}</h4>
                      <div className="space-y-3">
                        {checkSeriesAvailability(selectedRoom, selectedDate, selectedTime, duration, recurringWeeks).map((p, i) => (
                          <div key={i} className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-slate-400">{new Date(p.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                            {p.status === "ok" ? (<span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> {p.room.name}</span>) : p.status === "alternative" ? (<span className="text-orange-500 flex items-center gap-1"><AlertCircle size={12} /> {p.room.name} {t('label_alternative')}</span>) : (<span className="text-red-500 uppercase tracking-tighter"><XCircle size={12} /> {t('label_building_full')}</span>)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={async () => {
                  const plan = isRecurring ? checkSeriesAvailability(selectedRoom, selectedDate, selectedTime, duration, recurringWeeks) : [{ date: selectedDate, room: selectedRoom, status: "ok" }];
                  if (plan.some((p) => p.status === "conflict")) { alert(t('label_building_full')); return; }
                  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                  const bookingsToInsert = plan.map((p) => ({ room_id: p.room.id, user_id: user.id, booking_date: p.date, start_time: selectedTime, duration, user_email: user.email, booking_code: code }));
                  const { error } = await supabase.from("bookings").insert(bookingsToInsert);
                  if (!error) { setShowBookingModal(false); alert(isRecurring ? t('success_recurring') : t("success_booking")); initApp(); }
                  else alert("Fehler!");
                }} className="w-full bg-[#004a87] text-white py-7 rounded-[3.5rem] font-bold text-2xl shadow-2xl hover:bg-[#549BB7] transform mt-8 transition-all">{isRecurring ? t('btn_book_series') : t("modal_btn_confirm")}</button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[100] p-6 animate-in fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-lg shadow-2xl overflow-hidden text-left animate-in zoom-in-95">
            <div className="bg-[#004a87] p-10 text-white flex justify-between items-center italic uppercase font-bold text-2xl">{t("profile_title")}<button onClick={() => setShowSettingsModal(false)} className="hover:rotate-90 transition-all duration-300"><X size={28} /></button></div>
            <div className="p-14 space-y-10">
              <div className="space-y-3 font-bold"><label className="text-[10px] text-gray-400 uppercase ml-4">{t("admin_label_fname")}</label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full p-6 bg-gray-50 rounded-[2rem] font-bold outline-none ring-2 ring-gray-100 focus:ring-4 focus:ring-[#004a87]/10 transition-all" /></div>
              <div className="space-y-3 font-bold"><label className="text-[10px] text-gray-400 uppercase ml-4">{t("admin_label_lname")}</label><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full p-6 bg-gray-50 rounded-[2rem] font-bold outline-none ring-2 ring-gray-100 focus:ring-4 focus:ring-[#004a87]/10 transition-all" /></div>
              <button onClick={handleUpdateProfile} className="w-full bg-[#004a87] text-white py-7 rounded-[2.25rem] font-bold text-xl shadow-xl active:scale-95 transition-all">{t("save_btn")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}