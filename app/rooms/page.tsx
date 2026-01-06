'use client';

import React, {useState, useEffect} from 'react';
import {supabase} from '@/lib/supabase';
import {useRouter} from 'next/navigation';
import {
    Calendar, Users, Monitor, BookOpen, Wifi, X,
    Clock, LogOut, ShieldCheck, List, SlidersHorizontal,
    ChevronLeft, ChevronRight, CheckCircle2, User as UserIcon,
    Globe, ChevronDown, Settings, MapPin, AlertCircle, XCircle, Layers
} from 'lucide-react';

export default function RoomBookingPage() {
    const router = useRouter();
    const [lang, setLang] = useState<'de' | 'en'>('de');

    // Data-Driven States
    const [dbTrans, setDbTrans] = useState<any>({});
    const [equipmentList, setEquipmentList] = useState<any[]>([]);
    const [timeSlots, setTimeSlots] = useState<string[]>([]);

    // App States
    const [rooms, setRooms] = useState<any[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    // UI States
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showPickerModal, setShowPickerModal] = useState(false);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [duration, setDuration] = useState(1);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState('09:00');

    // Filter States
    const [minCapacity, setMinCapacity] = useState("");
    const [maxDist, setMaxDist] = useState("");
    const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]); // KORREKTUR: State für Equipment-Filter
    const [selectedBuildingId, setSelectedBuildingId] = useState<string>('all');
    const [selectedSeating, setSelectedSeating] = useState<string>('all');

    // Dynamischer Text-Helper
    const t = (key: string) => dbTrans[key]?.[lang] || key;


    // ENUM -> translation keys
    const seatingKeyMap: Record<string, string> = {
        'school with a central corridor': 'seating_school_corridor',
        'edv room': 'seating_edv',
        'wow room': 'seating_wow',
        'exam room': 'seating_exam',
        'parliament': 'seating_parliament',
        'meeting room': 'seating_meeting',
        'conference room': 'seating_conference',
    };

    const translateSeating = (value: string) => t(seatingKeyMap[value] || value);

    useEffect(() => {
        initApp();
    }, [selectedDate]);

    async function initApp() {
        setLoading(true);
        const {data: {session}} = await supabase.auth.getSession();
        if (!session) {
            router.push('/login');
            return;
        }
        setUser(session.user);

        // Alles parallel laden für Speed
        const [transRes, equipRes, timesRes, roomsRes, bookingsRes, profileRes] = await Promise.all([
            supabase.from('translations').select('*'),
            supabase.from('equipment').select('*'),
            supabase.from('timeslots').select('*').order('id'),
            supabase.from('rooms').select(`
        *,
        building:buildings!rooms_building_id_fkey (
          id,
          name,
          latitude,
          longitude
        ),
        room_combi:rooms_combi!rooms_room_combi_id_fkey (
          id,
          name,
          room_id_0,
          room_id_1,
          room_id_2,
          room_id_3
        )
      `),
            supabase.from('bookings').select('*'),
            supabase.from('profiles').select('*').eq('id', session.user.id).single()
        ]);


        // Texte mappen
        if (transRes.data) {
            const tMap: any = {};
            transRes.data.forEach(i => tMap[i.key] = {de: i.de, en: i.en});
            setDbTrans(tMap);
        }

        if (equipRes.data) setEquipmentList(equipRes.data);
        if (timesRes.data) setTimeSlots(timesRes.data.map(ts => ts.time_string));
        if (roomsRes.data) setRooms(roomsRes.data);
        if (profileRes.data) {
            setIsAdmin(profileRes.data.is_admin || false);
            setFirstName(profileRes.data.first_name || "A");
            setLastName(profileRes.data.last_name || "");
        }

        if (bookingsRes.data) {
            setBookings(bookingsRes.data);
            checkAutoRelease(bookingsRes.data);
        }

        setLoading(false);
    }

    // --- LOGIK: CHECK-IN & SICHERHEIT ---
    const isCheckInWindowOpen = (booking: any) => {
        const now = new Date();
        const [hours, minutes] = booking.start_time.split(':').map(Number);
        const start = new Date(booking.booking_date);
        start.setHours(hours, minutes, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + (booking.duration || 1));
        const thirtyMinsBefore = new Date(start.getTime() - 30 * 60000);
        return now >= thirtyMinsBefore && now <= end && booking.status === 'active';
    };

    const handleCheckIn = async (booking: any) => {
        if (!isCheckInWindowOpen(booking)) {
            alert(t('checkin_early_error'));
            return;
        }

        const isLocal = window.location.hostname === 'localhost';

        const verifyCode = async () => {
            const input = prompt(t('checkin_prompt'));
            if (input?.toUpperCase() === booking.booking_code) {
                const {error} = await supabase.from('bookings').update({
                    is_checked_in: true,
                    checked_in_at: new Date()
                }).eq('id', booking.id);
                if (!error) {
                    alert(t('checkin_ok'));
                    initApp();
                }
            } else {
                alert(t('checkin_wrong_code'));
            }
        };

        if (isLocal) {
            await verifyCode();
            return;
        }

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const room = rooms.find(r => r.id === booking.room_id);
            const R = 6371e3;

            const bLat = room?.building?.latitude ?? 47.2692;
            const bLon = room?.building?.longitude ?? 11.3933;

            const dLat = (pos.coords.latitude - bLat) * Math.PI / 180;
            const dLon = (pos.coords.longitude - bLon) * Math.PI / 180;

            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(pos.coords.latitude * Math.PI / 180) *
                Math.cos(bLat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);

            const dist = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

            if (dist <= 150) {
                await verifyCode();
            } else {
                const ipCheck = await fetch('https://api.ipify.org?format=json').then(res => res.json());
                if (ipCheck.ip.startsWith('138.22')) {
                    await verifyCode();
                } else {
                    alert(t('not_at_mci'));
                }
            }
        }, () => alert(t('gps_required')));
    };

    const checkAutoRelease = async (all: any[]) => {
        const now = new Date();
        const toRelease = all.filter(b => b.status === 'active' && !b.is_checked_in && (now.getTime() - new Date(`${b.booking_date}T${b.start_time}`).getTime()) / 60000 >= 10);
        for (const b of toRelease) await supabase.from('bookings').update({status: 'released'}).eq('id', b.id);
    };

    const handleCancel = async (id: string) => {
        if (!confirm(t('confirm_cancel'))) return;
        const {error} = await supabase.from('bookings').update({status: 'cancelled'}).eq('id', id);
        if (!error) initApp();
    };

    const handleUpdateProfile = async () => {
        const {error} = await supabase.from('profiles').update({
            first_name: firstName,
            last_name: lastName
        }).eq('id', user.id);
        if (!error) {
            setShowSettingsModal(false);
            initApp();
        }
    };

    // --- LOGIK: ROOM_COMBI (Konflikt-Regeln) ---
    const getConflictRoomIds = (room: any): string[] => {
        const c = room?.room_combi;
        if (!c) return [room.id];

        const combiId = c.room_id_0; // gemeinsamer / Kombi-Raum
        const singles = [c.room_id_1, c.room_id_2, c.room_id_3].filter(Boolean);

        // Wenn Kombi-Raum gebucht wird -> blockiert alles
        if (room.id === combiId) {
            return Array.from(new Set([combiId, ...singles]));
        }

        // Wenn Einzelraum gebucht wird -> blockiert nur sich selbst + Kombi-Raum
        if (singles.includes(room.id)) {
            return Array.from(new Set([room.id, combiId]));
        }

        return [room.id];
    };

    const overlaps = (startA: Date, endA: Date, startB: Date, endB: Date) =>
        startA < endB && startB < endA;

    const isAnyRoomOccupied = (
        roomIds: string[],
        date: string,
        startTime: string,
        durationHours: number
    ) => {
        const [h, m] = startTime.split(':').map(Number);

        const reqStart = new Date(`${date}T00:00:00`);
        reqStart.setHours(h, m, 0, 0);

        const reqEnd = new Date(reqStart);
        reqEnd.setHours(reqEnd.getHours() + durationHours);

        return bookings.some(b => {
            if (b.status !== 'active') return false;
            if (b.booking_date !== date) return false;
            if (!roomIds.includes(b.room_id)) return false;

            const [bh, bm] = b.start_time.split(':').map(Number);
            const bStart = new Date(`${b.booking_date}T00:00:00`);
            bStart.setHours(bh, bm, 0, 0);

            const bEnd = new Date(bStart);
            bEnd.setHours(bEnd.getHours() + (b.duration || 1));

            return overlaps(reqStart, reqEnd, bStart, bEnd);
        });
    };

    // --- LOGIK: VERFÜGBARKEIT ---
    const isSlotOccupied = (roomId: string, date: string, time: string) => {
        const checkHour = parseInt(time.split(':')[0]);
        return bookings.some(b => {
            if (b.room_id !== roomId || b.booking_date !== date || b.status !== 'active') return false;
            const start = parseInt(b.start_time.split(':')[0]);
            return checkHour >= start && checkHour < (start + (b.duration || 1));
        });
    };

    const getMaxDuration = () => {
        if (!selectedRoom) return 1;
        const startHour = parseInt(selectedTime.split(':')[0]);
        let max = 0;
        for (let h = startHour; h < 21; h++) {
            const timeString = h < 10 ? `0${h}:00` : `${h}:00`;
            if (isSlotOccupied(selectedRoom.id, selectedDate, timeString)) break;
            max++;
        }
        return Math.min(max, 8);
    };

    const buildingOptions = Array.from(
        new Map(
            rooms
                .filter(r => r?.building?.id) // nur wenn join da ist
                .map(r => [r.building.id, r.building]) // de-dupe by id
        ).values()
    ).sort((a: any, b: any) => (a?.name || '').localeCompare(b?.name || ''));

    const seatingOptions = Array.from(
        new Set(
            rooms
                .map(r => r?.seating_arrangement)
                .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
        )
    ).sort((a, b) => a.localeCompare(b));

    // KORREKTUR: Filter-Logik für Ausstattung
    const filteredRooms = rooms
        .filter(room => {
            if (!room.is_active || isSlotOccupied(room.id, selectedDate, selectedTime)) return false;
            if (minCapacity && room.capacity < parseInt(minCapacity)) return false;
            if (maxDist && (room.floor || 0) > parseInt(maxDist)) return false;
            if (selectedBuildingId !== 'all' && room?.building?.id !== selectedBuildingId) return false;
            if (selectedSeating !== 'all' && room?.seating_arrangement !== selectedSeating) return false;

            if (selectedEquipment.length > 0) {
                const hasAll = selectedEquipment.every(id => room.equipment && room.equipment.includes(id));
                if (!hasAll) return false;
            }

            return true;
        })
        .sort((a, b) => {
            // Wenn keine Suche nach Kapazität aktiv ist, optional nur nach capacity sortieren
            if (!minCapacity) return (a.capacity || 0) - (b.capacity || 0);

            const target = parseInt(minCapacity);

            // Relevanz: Abstand zur Zielkapazität (exakt zuerst, dann 1,2,3...)
            const da = Math.abs((a.capacity || 0) - target);
            const db = Math.abs((b.capacity || 0) - target);

            if (da !== db) return da - db;

            // Bei gleichem Abstand: kleinere Kapazität zuerst (ist bei deinem Filter >= target meist egal)
            return (a.capacity || 0) - (b.capacity || 0);
        });

    const getUpcomingBookings = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        return bookings
            .filter(b => b.user_id === user?.id && b.status === 'active' && b.booking_date >= todayStr)
            .sort((a, b) => (a.booking_date + a.start_time).localeCompare(b.booking_date + b.start_time))
            .slice(0, 5);
    };

    if (loading) return <div
        className="h-screen flex items-center justify-center font-bold text-[#004a87] italic uppercase tracking-widest">MCI
        RoomReserve...</div>;

    return (
        <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-900">

            {/* NAVBAR */}
            <nav className="bg-white border-b sticky top-0 z-50 px-12 h-24 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-12">
                    <img src="/MCI.png" alt="MCI" className="h-20 w-auto object-contain cursor-pointer"
                         onClick={() => router.push('/rooms')}/>
                    <button onClick={() => router.push('/reservations')}
                            className="flex items-center gap-2 text-slate-600 font-bold hover:text-[#004a87] transition">
                        <Calendar size={20} className="text-gray-300"/> {t('nav_bookings')}
                    </button>
                </div>

                <div className="flex items-center gap-8">
                    <button onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
                            className="flex items-center gap-2 text-xs font-bold uppercase text-gray-400 hover:text-[#004a87] transition">
                        <Globe size={16}/> {lang}
                    </button>

                    <div className="relative">
                        <button onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-3 hover:opacity-80 transition group">
                            <div
                                className="bg-gray-100 w-11 h-11 rounded-full flex items-center justify-center text-[#004a87] border border-gray-200">
                                <UserIcon size={22}/></div>
                            <span className="font-bold text-slate-700">{firstName}</span>
                            <ChevronDown size={14} className="text-gray-400"/>
                        </button>

                        {showUserMenu && (
                            <div
                                className="absolute right-0 mt-4 w-64 bg-white rounded-3xl shadow-2xl border border-gray-100 p-2 z-[60] animate-in fade-in slide-in-from-top-2">
                                <button onClick={() => {
                                    setShowSettingsModal(true);
                                    setShowUserMenu(false);
                                }}
                                        className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-gray-50 text-slate-700 font-bold transition text-sm">
                                    <Settings size={18} className="text-gray-300"/> {t('nav_profile')}
                                </button>
                                {isAdmin && <button onClick={() => router.push('/admin')}
                                                    className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-blue-50 text-[#004a87] font-bold transition text-sm">
                                    <ShieldCheck size={18}/> {t('nav_admin')}</button>}
                                <hr className="my-2 border-gray-50"/>
                                <button onClick={() => {
                                    supabase.auth.signOut();
                                    router.push('/login');
                                }}
                                        className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-red-50 text-red-500 font-bold transition text-sm">
                                    <LogOut size={18}/> {t('nav_logout')}</button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            <main className="max-w-[1500px] mx-auto p-12 flex gap-16">
                <div className="flex-1 space-y-16 text-left">
                    <section>
                        <h1 className="text-3xl font-bold text-[#004a87] mb-2 tracking-tight uppercase italic">{t('title')}</h1>
                        <p className="text-gray-400 font-medium text-xl">{t('subtitle')}</p>
                    </section>

                    {/* RAUM-GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        {filteredRooms.map(room => (
                            <div key={room.id}
                                 className="bg-white rounded-[3.5rem] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-2xl transition-all duration-500 text-left">
                                <div className="relative h-56 bg-gray-100">
                                    <img
                                        src={room.image_url || "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80"}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"/>
                                    <div
                                        className="absolute top-8 right-8 bg-[#4ade80] text-white px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl">{t('status_free')}</div>

                                    {/* Equipment Overlay Badges */}
                                    <div className="absolute bottom-6 left-8 flex flex-wrap gap-2">
                                        {room.equipment?.map((eqId: string) => {
                                            const eq = equipmentList.find(e => e.id === eqId);
                                            return eq ? (
                                                <div key={eqId}
                                                     className="bg-white/90 px-3 py-1.5 rounded-xl shadow-sm text-[#004a87] text-[9px] font-bold uppercase tracking-wider border border-white/50">
                                                    {lang === 'de' ? eq.name_de : eq.name_en}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                                <div className="p-12">
                                    <h3 className="font-bold text-3xl mb-3 tracking-tight">{room.name}</h3>
                                    <div
                                        className="mb-10 text-gray-400 font-bold text-[10px] uppercase tracking-widest space-y-2">

                                        {/* ZEILE 1: Personen + Bestuhlung */}
                                        <div className="flex gap-6">
                      <span className="flex items-center gap-1.5">
                        <Users size={16}/> {room.capacity} {t('capacity_label')}
                      </span>

                                            {room.seating_arrangement && (
                                                <span className="flex items-center gap-1.5">
                          <List size={16}/> {translateSeating(room.seating_arrangement)}
                        </span>
                                            )}
                                        </div>

                                        {/* ZEILE 2: Standort + Etage */}
                                        <div className="flex gap-6">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={16}/> {room?.building?.name}
                      </span>

                                            <span className="flex items-center gap-1.5">
                        <Layers size={16}/> {room.floor}. {t('distance_label')}
                      </span>
                                        </div>

                                    </div>
                                    <button onClick={() => {
                                        setSelectedRoom(room);
                                        setShowBookingModal(true);
                                    }}
                                            className="w-full bg-[#004a87] text-white py-6 rounded-[2rem] font-bold shadow-xl hover:bg-[#549BB7] transition-all transform active:scale-95">
                                        {t('btn_reserve')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* DASHBOARD: NÄCHSTE TERMINE */}
                    <section className="bg-white rounded-[3.5rem] p-12 border border-gray-100 shadow-sm text-left">
                        <h2 className="text-2xl font-bold mb-10 flex items-center gap-4 text-slate-800 tracking-tight italic uppercase">
                            <Clock className="text-[#549BB7]" size={32}/> {t('dashboard_title')}
                        </h2>
                        <div className="grid gap-6">
                            {getUpcomingBookings().map(b => {
                                const room = rooms.find(r => r.id === b.room_id);
                                const canCheckIn = isCheckInWindowOpen(b);

                                return (
                                    <div key={b.id}
                                         className="bg-gray-50 p-8 rounded-[2.5rem] flex justify-between items-center border border-gray-100 transition hover:bg-white hover:shadow-md">
                                        <div className="flex items-center gap-8">
                                            <div className="text-5xl">{room?.image || '🏢'}</div>
                                            <div>
                                                <div
                                                    className="font-bold text-2xl text-slate-900 leading-tight tracking-tight">{room?.name}</div>
                                                <div
                                                    className="text-gray-400 font-bold text-sm mt-1 uppercase tracking-widest">{b.booking_date} • {b.start_time} Uhr
                                                </div>
                                                <div className="mt-3 flex items-center gap-2">
                                                    <span
                                                        className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{t('code_label')}:</span>
                                                    <span
                                                        className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-mono font-bold text-sm tracking-widest">{b.booking_code}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {!b.is_checked_in && (
                                                <button onClick={() => handleCancel(b.id)}
                                                        className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition">
                                                    <XCircle size={26}/>
                                                </button>
                                            )}
                                            {b.is_checked_in ? (
                                                <div
                                                    className="bg-green-100 text-green-700 px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                                    <CheckCircle2 size={16}/> {t('checkin_ok')}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleCheckIn(b)}
                                                    className={`px-10 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${canCheckIn ? 'bg-[#549BB7] text-white shadow-xl hover:bg-[#438299]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                                >
                                                    {t('checkin_btn')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {getUpcomingBookings().length === 0 &&
                                <p className="text-center py-10 text-gray-300 italic">Keine anstehenden Termine.</p>}
                        </div>
                    </section>
                </div>

                {/* SIDEBAR */}
                <aside className="w-[400px] text-left">
                    <div className="sticky top-36 space-y-10 max-h-[calc(100vh-9rem)] overflow-y-auto pr-2">

                        {/* DATUM-KARTE */}
                        <div className="bg-white rounded-[3.5rem] p-10 border border-gray-100 shadow-sm text-center">
                            <div className="flex items-center justify-between mb-8">
                                <button
                                    onClick={() => {
                                        let d = new Date(selectedDate);
                                        d.setDate(d.getDate() - 1);
                                        setSelectedDate(d.toISOString().split('T')[0]);
                                    }}
                                    className="p-3 hover:bg-gray-100 rounded-full transition"
                                >
                                    <ChevronLeft size={28} className="text-gray-300"/>
                                </button>

                                <div>
                                    <div className="text-[#549BB7] flex justify-center mb-3">
                                        <Calendar size={34}/>
                                    </div>
                                    <p className="font-bold text-xl text-slate-800 italic">
                                        {new Date(selectedDate).toLocaleDateString(
                                            lang === 'de' ? 'de-DE' : 'en-US',
                                            {weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'}
                                        )}
                                    </p>
                                </div>

                                <button
                                    onClick={() => {
                                        let d = new Date(selectedDate);
                                        d.setDate(d.getDate() + 1);
                                        setSelectedDate(d.toISOString().split('T')[0]);
                                    }}
                                    className="p-3 hover:bg-gray-100 rounded-full transition"
                                >
                                    <ChevronRight size={28} className="text-gray-300"/>
                                </button>
                            </div>

                            <button
                                onClick={() => setShowPickerModal(true)}
                                className="
    w-full h-16
    border-2 border-dashed border-gray-200
    rounded-[2rem]
    font-bold text-gray-400
    hover:border-[#549BB7] hover:text-[#549BB7]
    transition
    relative
  "
                            >
                                {/* Icon links, vertikal korrekt zentriert */}
                                <div className="absolute left-6 inset-y-0 flex items-center">
                                    <Clock size={20}/>
                                </div>

                                {/* Text wirklich zentriert */}
                                <div className="flex items-center justify-center h-full pl-15">
                                    {selectedTime} Uhr – {t('btn_date')}
                                </div>
                            </button>
                        </div>

                        {/* FILTER KARTE */}
                        <div className="bg-white rounded-[3.5rem] p-10 border border-gray-100 shadow-sm">
                            <div
                                className="flex items-center gap-4 text-slate-900 font-bold text-2xl mb-2 pb-2 border-b border-gray-50 uppercase tracking-tighter italic">
                                <SlidersHorizontal size={24} className="text-[#f7941d]"/> {t('filter_title')}
                            </div>
                            <div className="space-y-4">
                                
                                {/* FILTER Kapazität */}
                                <div className="space-y-4">
                                    <label
                                        className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-3">{t('filter_cap')}</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        step={1}
                                        placeholder="z.B. 6"
                                        value={minCapacity}
                                        onChange={(e) => {
                                            const raw = e.target.value;

                                            // erlaubt "leer" (Filter aus)
                                            if (raw === "") {
                                                setMinCapacity("");
                                                return;
                                            }
                                            const n = Number(raw);
                                            if (Number.isNaN(n)) return;

                                            setMinCapacity(String(Math.max(0, Math.floor(n))));
                                        }}
                                        className="w-full bg-gray-50 border-none ring-1 ring-gray-100 p-5 rounded-[1.5rem] focus:ring-2 focus:ring-[#f7941d] outline-none transition"
                                    />
                                </div>

                                {/* FILTER Standort */}
                                <div className="space-y-4">
                                    <label
                                        className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-3">
                                        {t('filter_location')}
                                    </label>

                                    <select
                                        value={selectedBuildingId}
                                        onChange={(e) => setSelectedBuildingId(e.target.value)}
                                        className="w-full bg-gray-50 border-none ring-1 ring-gray-100 p-5 rounded-[1.5rem] focus:ring-2 focus:ring-[#f7941d] outline-none transition font-bold text-sm"
                                    >
                                        <option value="all">{t('filter_all')}</option>
                                        {buildingOptions.map((b: any) => (
                                            <option key={b.id} value={b.id}>
                                                {b.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* FILTER Bestuhlung */}
                                <div className="space-y-4">
                                    <label
                                        className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-3">
                                        {t('filter_seating')}
                                    </label>

                                    <select
                                        value={selectedSeating}
                                        onChange={(e) => setSelectedSeating(e.target.value)}
                                        className="w-full bg-gray-50 border-none ring-1 ring-gray-100 p-5 rounded-[1.5rem] focus:ring-2 focus:ring-[#f7941d] outline-none transition font-bold text-sm"
                                    >
                                        <option value="all">{t('filter_all')}</option>
                                        {seatingOptions.map((s) => (
                                            <option key={s} value={s}>
                                                {translateSeating(s)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* FILTER Equipment */}
                                <div className="space-y-4">
                                    <label
                                        className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-3">{t('filter_equip')}</label>
                                    {equipmentList.map(eq => (
                                        <label key={eq.id} className="flex items-center gap-5 cursor-pointer group">
                                            {/* KORREKTUR: Checkbox State & Toggle */}
                                            <input
                                                type="checkbox"
                                                checked={selectedEquipment.includes(eq.id)}
                                                onChange={() => {
                                                    setSelectedEquipment(prev =>
                                                        prev.includes(eq.id) ? prev.filter(id => id !== eq.id) : [...prev, eq.id]
                                                    );
                                                }}
                                                className="w-7 h-7 rounded-xl border-gray-200 text-[#004a87] focus:ring-[#004a87] transition cursor-pointer"
                                            />
                                            <span
                                                className={`text-sm font-bold transition-all ${selectedEquipment.includes(eq.id) ? 'text-[#004a87]' : 'text-gray-500'}`}>
                              {lang === 'de' ? eq.name_de : eq.name_en}
                            </span>
                                        </label>
                                    ))}
                                </div>

                            </div>
                        </div>
                    </div>
                </aside>
            </main>

            {/* MODALS */}
            {showBookingModal && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-[100] backdrop-blur-md animate-in fade-in duration-300">
                    <div
                        className="bg-white rounded-[4rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-left">
                        <div className="bg-[#004a87] p-12 text-white flex justify-between items-center">
                            <h3 className="text-4xl font-bold tracking-tight italic uppercase">{selectedRoom?.name}</h3>
                            <button onClick={() => setShowBookingModal(false)}
                                    className="bg-white/10 p-4 rounded-full hover:bg-white/20 transition"><X size={24}/>
                            </button>
                        </div>
                        <div className="p-12 space-y-10">
                            <div className="space-y-4 font-bold">
                                <label
                                    className="text-[10px] text-gray-400 uppercase tracking-widest">{t('modal_time')}</label>
                                <div
                                    className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex items-center gap-4 text-xl">
                                    <Calendar className="text-blue-500"/> {selectedDate} • {selectedTime} Uhr
                                </div>
                            </div>
                            <div className="space-y-4 font-bold">
                                <label
                                    className="text-[10px] text-gray-400 uppercase tracking-widest">{t('modal_duration')}</label>
                                <select value={duration} onChange={e => setDuration(parseInt(e.target.value))}
                                        className="w-full bg-gray-50 p-6 rounded-[1.5rem] ring-1 ring-gray-100 outline-none focus:ring-2 focus:ring-[#004a87] text-lg">
                                    {Array.from({length: getMaxDuration()}, (_, i) => i + 1).map(d => (
                                        <option key={d} value={d}>{d} h</option>))}
                                </select>
                            </div>
                            <button
                                onClick={async () => {
                                    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

                                    // 1) Konflikt-IDs bestimmen (asymmetrische Logik)
                                    const conflictIds = getConflictRoomIds(selectedRoom);

                                    // 2) Prüfen ob irgendein Konflikt-Raum im Zeitraum belegt ist
                                    const occupied = isAnyRoomOccupied(
                                        conflictIds,
                                        selectedDate,
                                        selectedTime,
                                        duration
                                    );

                                    if (occupied) {
                                        alert("Nicht verfügbar: Der Kombi-Raum oder der gewählte Raum ist im Zeitraum bereits gebucht.");
                                        return;
                                    }

                                    // 3) Erst dann buchen
                                    const {error} = await supabase.from('bookings').insert([{
                                        room_id: selectedRoom.id,
                                        user_id: user.id,
                                        booking_date: selectedDate,
                                        start_time: selectedTime,
                                        duration,
                                        user_email: user.email,
                                        booking_code: code
                                    }]);

                                    if (!error) {
                                        setShowBookingModal(false);
                                        alert(t('success_booking'));
                                        initApp();
                                    }
                                }}
                                className="w-full bg-[#004a87] text-white py-6 rounded-[2rem] font-bold text-xl shadow-2xl hover:bg-[#549BB7] transition active:scale-95"
                            >
                                {t('modal_btn_confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSettingsModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-6">
                    <div className="bg-white rounded-[3.5rem] w-full max-w-lg shadow-2xl overflow-hidden text-left">
                        <div
                            className="bg-[#004a87] p-12 text-white flex justify-between items-center italic uppercase font-bold text-2xl">{t('profile_title')}
                            <button onClick={() => setShowSettingsModal(false)}><X/></button>
                        </div>
                        <div className="p-12 space-y-8">
                            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                                   className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 font-bold"
                                   placeholder="Vorname"/>
                            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                                   className="w-full p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 font-bold"
                                   placeholder="Nachname"/>
                            <button onClick={handleUpdateProfile}
                                    className="w-full bg-[#004a87] text-white py-6 rounded-[2rem] font-bold shadow-xl">{t('save_btn')}</button>
                        </div>
                    </div>
                </div>
            )}

            {showPickerModal && (
                <div
                    className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-in zoom-in-95">
                    <div className="bg-white rounded-[4rem] w-full max-w-lg overflow-hidden shadow-2xl">
                        <div
                            className="bg-slate-900 p-8 text-white flex justify-between items-center italic uppercase font-bold text-2xl">Zeitraum
                            wählen
                            <button onClick={() => setShowPickerModal(false)}><X/></button>
                        </div>
                        <div className="p-10 space-y-10 text-center">
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                   className="w-full p-5 bg-gray-50 rounded-[1.5rem] ring-1 ring-gray-100 font-bold text-xl"/>
                            <div className="grid grid-cols-3 gap-3 max-h-56 overflow-y-auto pr-3 custom-scrollbar">
                                {timeSlots.map(t => (<button key={t} onClick={() => {
                                    setSelectedTime(t);
                                    setShowPickerModal(false);
                                }}
                                                             className={`p-4 rounded-2xl font-bold text-sm transition-all ${selectedTime === t ? 'bg-[#004a87] text-white shadow-xl scale-95' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>{t}</button>))}
                            </div>
                            <button onClick={() => setShowPickerModal(false)}
                                    className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-bold text-lg">Fertig
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}