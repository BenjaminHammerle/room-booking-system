"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import "./room.css";
import BookingModal from "@/app/components/BookingModal";
import {
  Calendar,
  Users,
  Clock,
  LogOut,
  ShieldCheck,
  List,
  CheckCircle2,
  User as UserIcon,
  Globe,
  ChevronDown,
  Settings,
  MapPin,
  AlertCircle,
  XCircle,
  Search,
  Layers,
  Filter,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  Accessibility,
  Ban,
  Printer,
  Save,
} from "lucide-react";

// --- TYPES ---
interface Room {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  building_id: string;
  is_active: boolean;
  accessible: boolean;
  image_url: string;
  image?: string;
  seating_arrangement?: string;
  equipment?: string[];
  building?: { id: string; name: string; latitude: number; longitude: number };
  room_combi?: {
    id: string;
    room_id_0: string;
    room_id_1: string;
    room_id_2: string;
    room_id_3: string;
  };
}

interface Booking {
  id: string;
  room_id: string;
  user_id: string;
  booking_date: string;
  start_time: string;
  duration: number;
  status: string;
  is_checked_in: boolean;
  booking_code: string;
}

export default function RoomBookingPage() {
  const router = useRouter();
const [lang, setLang] = useState<"de" | "en">("de");

// 1. Einmaliges Laden beim Öffnen der Seite
useEffect(() => {
  const savedLang = localStorage.getItem("mci_lang") as "de" | "en";
  if (savedLang === "de" || savedLang === "en") {
    setLang(savedLang);
  }
}, []);

// 2. Die neue Toggle-Funktion (Speichert aktiv beim Klick)
const handleLangToggle = () => {
  const newLang = lang === "de" ? "en" : "de";
  setLang(newLang);
  localStorage.setItem("mci_lang", newLang);
};

  // --- DATA STATES ---
  const [dbTrans, setDbTrans] = useState<any>({});
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // --- UI & FILTER STATES (SMART TIME INIT) ---
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    // Wenn es 23:00 Uhr oder später ist, schlage direkt morgen vor
    if (now.getHours() >= 23) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split("T")[0];
    }
    return now.toISOString().split("T")[0];
  });

  const [selectedTime, setSelectedTime] = useState(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    if ((h >= 23 && m > 15) || h < 7) return "07:00";
    let nextM = Math.ceil(m / 15) * 15;
    let nextH = h;
    if (nextM === 60) {
      nextH++;
      nextM = 0;
    }
    return `${nextH.toString().padStart(2, "0")}:${nextM.toString().padStart(2, "0")}`;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [minCapacity, setMinCapacity] = useState("0");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [onlyAccessible, setOnlyAccessible] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedSeating, setSelectedSeating] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [duration, setDuration] = useState(1);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(1);
  const getEndTimeParts = (startTime: string, duration: number) => {
    const totalMinutes = timeToMinutes(startTime) + duration * 60;
    return {
      hh: Math.floor(totalMinutes / 60)
        .toString()
        .padStart(2, "0"),
      mm: (totalMinutes % 60).toString().padStart(2, "0"),
    };
  };

  // --- NOW-ZEIT HELFER ---
  const nowForValidation = new Date();
  const currentHH = nowForValidation.getHours();
  const currentMM = nowForValidation.getMinutes();
  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  // --- HELPERS ---
  const t = (key: string) => dbTrans[key?.toLowerCase()]?.[lang] || key;
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

  const getOccupancyInfo = (
    roomId: string,
    date: string,
    time: string,
    currentBookings: Booking[] = [],
  ) => {
    const checkMin = timeToMinutes(time);
    const activeBookings = currentBookings || [];
    const conflict = activeBookings.find(
      (b) =>
        b.room_id === roomId &&
        b.booking_date === date &&
        b.status === "active" &&
        checkMin >= timeToMinutes(b.start_time) &&
        checkMin < timeToMinutes(b.start_time) + b.duration * 60,
    );
    return conflict
      ? {
          isOccupied: true,
          until: minutesToTime(
            timeToMinutes(conflict.start_time) + conflict.duration * 60,
          ),
        }
      : { isOccupied: false, until: null };
  };

  const isCheckInWindowOpen = (booking: Booking) => {
    const nowLocal = new Date();
    const start = new Date(`${booking.booking_date}T${booking.start_time}`);
    return (
      nowLocal >= new Date(start.getTime() - 15 * 60000) &&
      nowLocal <=
        new Date(start.getTime() + (booking.duration || 1) * 3600000) &&
      booking.status === "active"
    );
  };

  const getConflictRoomIds = (room: Room): string[] => {
    if (!room?.room_combi) return [room.id];
    const c = room.room_combi;
    const singles = [c.room_id_1, c.room_id_2, c.room_id_3].filter(Boolean);
    return room.id === c.room_id_0
      ? Array.from(new Set([c.room_id_0, ...singles]))
      : Array.from(new Set([room.id, c.room_id_0]));
  };

  const isAnyRoomOccupied = (
    roomIds: string[],
    date: string,
    startTime: string,
    durationHours: number,
    currentBookings: Booking[],
  ) => {
    const reqStartMin = timeToMinutes(startTime);
    const reqEndMin = reqStartMin + durationHours * 60;
    return currentBookings.some((b) => {
      if (
        b.status !== "active" ||
        b.booking_date !== date ||
        !roomIds.includes(b.room_id)
      )
        return false;
      const bStartMin = timeToMinutes(b.start_time);
      return (
        reqStartMin < bStartMin + (b.duration || 1) * 60 &&
        bStartMin < reqEndMin
      );
    });
  };

  const getSeriesPlan = (
    room: Room,
    startDate: string,
    startTime: string,
    durationHours: number,
    weeks: number,
    currentBookings: Booking[],
  ) => {
    const plan = [];
    const minCapNum = parseInt(minCapacity) || 0;

    for (let i = 0; i < weeks; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i * 7);
      const curDate = d.toISOString().split("T")[0];

      const conflictIds = getConflictRoomIds(room);
      const isOriginalOccupied = isAnyRoomOccupied(
        conflictIds,
        curDate,
        startTime,
        durationHours,
        currentBookings,
      );

      if (!isOriginalOccupied) {
        plan.push({ date: curDate, room: room, status: "ok" });
      } else {
        // BEST MATCH SUCHE
        const alternatives = rooms
          .filter(
            (r) =>
              r.building_id === room.building_id &&
              r.id !== room.id &&
              r.is_active &&
              r.capacity >= minCapNum &&
              !isAnyRoomOccupied(
                getConflictRoomIds(r),
                curDate,
                startTime,
                durationHours,
                currentBookings,
              ),
          )
          .sort((a, b) => a.capacity - b.capacity); // Nimm den kleinstmöglichen passenden Raum

        const bestAlt = alternatives[0] || null;
        plan.push({
          date: curDate,
          room: bestAlt,
          status: bestAlt ? "alternative" : "conflict",
        });
      }
    }
    return plan;
  };

  // --- INITIAL LOAD ---
  useEffect(() => {
    initApp();
  }, [selectedDate]);

  async function initApp() {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);
    const [transRes, equipRes, roomsRes, bookingsRes, profileRes] =
      await Promise.all([
        supabase.from("translations").select("*"),
        supabase.from("equipment").select("*"),
        supabase
          .from("rooms")
          .select(
            `*, building:buildings!rooms_building_id_fkey (*), room_combi:rooms_combi!rooms_room_combi_id_fkey (*)`,
          ),
        supabase.from("bookings").select("*"),
        supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single(),
      ]);
    // --- Overdue Check (Räume freigeben) ---
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const currentTimeMin = now.getHours() * 60 + now.getMinutes();

    // Hole alle aktiven Buchungen von heute, die NICHT eingecheckt sind
    const { data: todayBookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_date", todayStr)
      .eq("status", "active")
      .eq("is_checked_in", false);

    if (todayBookings) {
      for (const b of todayBookings) {
        const startMin = timeToMinutes(b.start_time);
        // Wenn 15 Minuten vergangen sind -> Stornieren (Freigeben)
        if (currentTimeMin > startMin + 15) {
          await supabase
            .from("bookings")
            .update({ status: "cancelled" }) // oder 'released', je nach DB-Logik
            .eq("id", b.id);
        }
      }
    }
    // --- Ende Overdue Check ---

    if (transRes.data) {
      const tMap: any = {};
      transRes.data.forEach(
        (i: any) => (tMap[i.key.toLowerCase()] = { de: i.de, en: i.en }),
      );
      setDbTrans(tMap);
    }
    if (equipRes.data) setEquipmentList(equipRes.data);
    if (roomsRes.data) {
      setRooms(roomsRes.data);
      setBuildings(
        Array.from(
          new Map(
            roomsRes.data
              .filter((r: any) => r.building)
              .map((r: any) => [r.building.id, r.building]),
          ).values(),
        ) as any[],
      );
    }
    if (profileRes.data) {
      setIsAdmin(profileRes.data.is_admin);
      setFirstName(profileRes.data.first_name || "MCI");
      setLastName(profileRes.data.last_name || "User");
    }
    if (bookingsRes.data) setBookings(bookingsRes.data);
    setLoading(false);
  }

  // --- FILTER & SORT LOGIK ---
  const maxRoomCapacity = useMemo(
    () =>
      rooms.length === 0 ? 100 : Math.max(...rooms.map((r) => r.capacity)),
    [rooms],
  );

  const filteredRooms = useMemo(() => {
    return rooms
      .filter((r) => {
        const occInfo = getOccupancyInfo(
          r.id,
          selectedDate,
          selectedTime,
          bookings,
        );
        const matchesSearch =
          searchQuery &&
          r.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!searchQuery && (!r.is_active || occInfo.isOccupied)) return false;
        if (searchQuery && !matchesSearch) return false;
        if (onlyAccessible && !r.accessible) return false;
        if (minCapacity && r.capacity < parseInt(minCapacity)) return false;
        if (
          selectedBuildingId !== "all" &&
          r.building_id !== selectedBuildingId
        )
          return false;
        if (
          selectedSeating !== "all" &&
          r.seating_arrangement !== selectedSeating
        )
          return false;
        if (
          selectedEquipment.length > 0 &&
          !selectedEquipment.every((id) => r.equipment?.includes(id))
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        const occA = getOccupancyInfo(
          a.id,
          selectedDate,
          selectedTime,
          bookings,
        ).isOccupied;
        const occB = getOccupancyInfo(
          b.id,
          selectedDate,
          selectedTime,
          bookings,
        ).isOccupied;
        if (occA !== occB) return occA ? 1 : -1;
        const req = parseInt(minCapacity) || 0;
        const deltaA = a.capacity - req;
        const deltaB = b.capacity - req;
        const inA = deltaA >= 0 && deltaA <= 2;
        const inB = deltaB >= 0 && deltaB <= 2;
        if (inA && !inB) return -1;
        if (!inA && inB) return 1;
        if (inA && inB) {
          const eqCountA = a.equipment?.length || 0;
          const eqCountB = b.equipment?.length || 0;
          if (eqCountA !== eqCountB) return eqCountA - eqCountB;
        }
        return deltaA - deltaB;
      });
  }, [
    rooms,
    searchQuery,
    minCapacity,
    selectedBuildingId,
    selectedSeating,
    selectedEquipment,
    onlyAccessible,
    selectedDate,
    selectedTime,
    bookings,
  ]);

  // Zählt nur AKTIVE UND FREIE Räume
  const activeCount = useMemo(
    () =>
      filteredRooms.filter(
        (r) =>
          r.is_active &&
          !getOccupancyInfo(r.id, selectedDate, selectedTime, bookings)
            .isOccupied,
      ).length,
    [filteredRooms, selectedDate, selectedTime, bookings],
  );

  // --- UI ACTIONS ---
  const handleDatePagination = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const newDateStr = d.toISOString().split("T")[0];
    if (newDateStr < new Date().toISOString().split("T")[0]) return;
    setSelectedDate(newDateStr);
  };

  const handleCancel = async (id: string) => {
    if (!confirm(t("confirm_cancel"))) return;
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    initApp();
  };

  const handleCheckIn = async (booking: Booking) => {
    const input = prompt(t("checkin_prompt"));
    if (input?.toUpperCase() === booking.booking_code) {
      await supabase
        .from("bookings")
        .update({ is_checked_in: true, checked_in_at: new Date() })
        .eq("id", booking.id);
      initApp();
      alert(t("checkin_ok"));
    }
  };

  if (loading)
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FB] text-[#004a87] font-black uppercase italic animate-pulse">
        <ShieldCheck size={80} className="mb-6 text-[#549BB7]" />
        <span className="text-2xl tracking-tighter">MCI System Check...</span>
      </div>
    );

  return (
    <div className="room-page-wrapper">
      <nav className="room-navbar">
        <div className="flex items-center gap-4 md:gap-12">
          <img
            src="/MCI.png"
            alt="MCI"
            className="h-10 md:h-16 cursor-pointer"
            onClick={() => router.push("/rooms")}
          />
          <button
            onClick={() => router.push("/reservations")}
            className="nav-link flex items-center gap-2"
          >
            <Calendar size={20} />{" "}
            <span className="hidden sm:inline">{t("nav_bookings")}</span>
          </button>
        </div>
        <div className="flex flex-row items-center gap-8">
          <button
            onClick={handleLangToggle}
            className="nav-link text-xs uppercase"
          >
            <Globe size={18} /> {lang}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex flex-row items-center gap-3 group transition-all"
            >
              <div className="bg-gray-100 w-11 h-11 rounded-full flex items-center justify-center text-[#004a87] border group-hover:border-[#549BB7] transition-all">
                <UserIcon size={22} />
              </div>
              <span className="font-bold text-slate-700">{firstName}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-4 w-64 bg-white rounded-[2rem] shadow-2xl border p-2 z-[60] animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => {
                    setShowSettingsModal(true);
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-gray-50 text-slate-700 font-bold transition text-sm"
                >
                  <Settings size={18} /> {t("nav_profile")}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => router.push("/admin")}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-blue-50 text-[#004a87] font-bold transition text-sm"
                  >
                    <ShieldCheck size={18} /> {t("nav_admin")}
                  </button>
                )}
                <hr className="my-2 border-gray-50" />
                <button
                  onClick={() => {
                    supabase.auth.signOut();
                    router.push("/login");
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-red-50 text-red-500 font-bold transition text-sm"
                >
                  <LogOut size={18} /> {t("nav_logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="room-main-layout">
        <aside className="room-sidebar">
          {/* MOBILE FILTER TOGGLE (Nur sichtbar auf kleinen Screens) */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden w-full mb-4 flex items-center justify-between bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-[#004a87] font-black uppercase italic tracking-tighter"
          >
            <div className="flex items-center gap-3">
              <Filter size={20} className="text-[#f7941d]" />
              <span>
                {t("filter_title")}{" "}
                {selectedEquipment.length > 0 &&
                  `(${selectedEquipment.length})`}
              </span>
            </div>
            <ChevronDown
              size={20}
              className={`transition-transform duration-300 ${showMobileFilters ? "rotate-180" : ""}`}
            />
          </button>

          {/* DIE EIGENTLICHE FILTER CARD */}
          <div
            className={`filter-card ${showMobileFilters ? "block" : "hidden lg:block"} animate-in slide-in-from-top-4 duration-300`}
          >
            <div className="filter-title-row hidden lg:flex">
              <Filter size={20} className="text-[#f7941d]" />
              {t("filter_title")}
            </div>

            <div className="mci-field-group">
              <label className="mci-label">{t("filter_search_label")}</label>
              <input
                type="text"
                placeholder={t("filter_search_placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mci-input"
              />
            </div>

            <div className="mci-field-group">
              <label className="mci-label">{t("filter_time_label")}</label>
              <div className="flex flex-row items-center gap-2 mb-2">
                {/* LINKS PFEIL */}
                <button
                  onClick={() => handleDatePagination(-1)}
                  className="p-3 shrink-0 bg-gray-50 rounded-xl hover:bg-white border border-gray-100 shadow-sm transition flex items-center justify-center"
                >
                  <ChevronLeft size={20} />
                </button>

                {/* DATUMS INPUT - Wichtig: flex-1 und min-w-0 */}
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mci-input !text-center flex-1 min-w-0 !px-2"
                />

                {/* RECHTS PFEIL */}
                <button
                  onClick={() => handleDatePagination(1)}
                  className="p-3 shrink-0 bg-gray-50 rounded-xl hover:bg-white border border-gray-100 shadow-sm transition flex items-center justify-center"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="flex flex-row items-center gap-2 mt-2">
                {/* HH SELECT MIT VALIDIERUNG */}
                <select
                  value={selectedTime.split(":")[0]}
                  onChange={(e) =>
                    setSelectedTime(
                      `${e.target.value}:${selectedTime.split(":")[1]}`,
                    )
                  }
                  className="mci-select text-center flex-1"
                >
                  {Array.from({ length: 17 }, (_, i) =>
                    (i + 7).toString().padStart(2, "0"),
                  ).map((h) => {
                    const hNum = parseInt(h);
                    const selectedMin = parseInt(selectedTime.split(":")[1]);
                    // Sperren wenn Stunde vorbei ODER (Stunde ist jetzt UND gewählte Minute ist schon vorbei)
                    const isDisabled =
                      isToday &&
                      (hNum < currentHH ||
                        (hNum === currentHH && selectedMin <= currentMM));
                    return (
                      <option key={h} value={h} disabled={isDisabled}>
                        {h}
                      </option>
                    );
                  })}
                </select>
                <span className="font-bold">:</span>
                {/* MM SELECT MIT VALIDIERUNG */}
                <select
                  value={selectedTime.split(":")[1]}
                  onChange={(e) =>
                    setSelectedTime(
                      `${selectedTime.split(":")[0]}:${e.target.value}`,
                    )
                  }
                  className="mci-select text-center flex-1"
                >
                  {["00", "15", "30", "45"].map((m) => {
                    const mNum = parseInt(m);
                    const selectedHour = parseInt(selectedTime.split(":")[0]);
                    // Sperren wenn heute UND gewählte Stunde ist die aktuelle Stunde UND Minute ist vorbei
                    const isDisabled =
                      isToday &&
                      selectedHour === currentHH &&
                      mNum <= currentMM;
                    return (
                      <option key={m} value={m} disabled={isDisabled}>
                        {m}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="mci-field-group">
              <label className="mci-label">{t("filter_cap")}</label>
              <div className="flex flex-row items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max={maxRoomCapacity}
                  value={minCapacity}
                  onChange={(e) => setMinCapacity(e.target.value)}
                  className="filter-capacity-bar"
                />
                <input
                  type="number"
                  min="0"
                  value={minCapacity}
                  onChange={(e) => setMinCapacity(e.target.value)}
                  className="filter-capacity-number"
                />
              </div>
            </div>

            <div className="mci-field-group">
              <label className="mci-label">{t("filter_location")}</label>
              <select
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="mci-select"
              >
                <option value="all">{t("filter_all")}</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mci-field-group">
              <label className="mci-label">{t("filter_seating")}</label>
              <select
                value={selectedSeating}
                onChange={(e) => setSelectedSeating(e.target.value)}
                className="mci-select"
              >
                <option value="all">{t("filter_all")}</option>
                {Array.from(
                  new Set(
                    rooms.map((r) => r.seating_arrangement).filter(Boolean),
                  ),
                ).map((s: any) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mci-field-group">
              <label className="mci-label">{t("filter_equip")}</label>
              <div className="mci-filter-list">
                <label className="mci-filter-item">
                  <input
                    type="checkbox"
                    checked={onlyAccessible}
                    onChange={() => setOnlyAccessible(!onlyAccessible)}
                    className="filter-checkbox"
                  />
                  <span
                    className={`mci-filter-text ${onlyAccessible ? "mci-filter-text-accessible-active" : "mci-filter-text-inactive"}`}
                  >
                    <Accessibility size={16} /> {t("label_accessible")}
                  </span>
                </label>
                {equipmentList.map((eq) => (
                  <label key={eq.id} className="mci-filter-item">
                    <input
                      type="checkbox"
                      checked={selectedEquipment.includes(eq.id)}
                      onChange={() =>
                        setSelectedEquipment((prev) =>
                          prev.includes(eq.id)
                            ? prev.filter((id) => id !== eq.id)
                            : [...prev, eq.id],
                        )
                      }
                      className="filter-checkbox"
                    />
                    <span
                      className={`mci-filter-text ${selectedEquipment.includes(eq.id) ? "mci-filter-text-active" : "mci-filter-text-inactive"}`}
                    >
                      {lang === "de" ? eq.name_de : eq.name_en}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setSearchQuery("");
                setMinCapacity("0");
                setSelectedEquipment([]);
                setOnlyAccessible(false);
                setSelectedBuildingId("all");
                setSelectedSeating("all");
              }}
              className="w-full py-4 text-[9px] font-black text-gray-300 uppercase hover:text-red-400 transition border-t border-dashed mt-4"
            >
              <XCircle size={14} className="inline mr-2" />{" "}
              {t("filter_reset_btn")}
            </button>
            {/* KLEINER OPTIONALER FIX: "Filter anwenden" Button am Handy */}
            {showMobileFilters && (
              <button
                onClick={() => setShowMobileFilters(false)}
                className="lg:hidden btn-mci-main !py-4 !text-sm mt-4"
              >
                {t("apply_filters") || "Filter anwenden"}
              </button>
            )}
          </div>
        </aside>

        <div className="flex-1 space-y-16">
          <section className="text-left animate-in fade-in duration-1000">
            <h1 className="room-page-title">{t("title")}</h1>
            <p className="text-gray-600 font-bold text-lg md:text-2xl italic">
              {activeCount} {t("label_active_rooms")}
            </p>
          </section>

          <div className="room-grid">
            {filteredRooms.map((room, idx) => {
              const occ = getOccupancyInfo(
                room.id,
                selectedDate,
                selectedTime,
                bookings,
              );
              return (
                <div
                  key={room.id}
                  className={`room-card group ${!room.is_active || occ.isOccupied ? "opacity-70" : ""}`}
                >
                  <div className="room-card-image-wrapper">
                    <img
                      src={room.image_url}
                      className={`room-card-image group-hover:scale-105 transition-all duration-1000 ${occ.isOccupied ? "grayscale shadow-inner" : ""}`}
                      alt={room.name}
                    />
                    <div className="room-badge-container">
                      {room.accessible && (
                        <div className="accessible-badge">
                          <Accessibility size={16} /> {t("label_accessible")}
                        </div>
                      )}
                      {room.equipment?.map((eqId: string) => {
                        const eq = equipmentList.find((e) => e.id === eqId);
                        return (
                          <div key={eqId} className="mci-badge">
                            {eq
                              ? lang === "de"
                                ? eq.name_de
                                : eq.name_en
                              : eqId}
                          </div>
                        );
                      })}
                    </div>
                    {occ.isOccupied && room.is_active && (
                      <div className="room-occupied-until">
                        <XCircle size={18} /> {t("label_occupied_until")}{" "}
                        {occ.until}
                      </div>
                    )}
                    {!room.is_active && (
                      <div className="room-inactive">
                        <Ban size={18} /> {t("label_inactive")}
                      </div>
                    )}
                  </div>
                  <div className="room-card-content">
                    <div className="flex flex-row justify-between items-start mb-4 md:mb-6">
                      <h3 className="font-bold text-3xl md:text-4xl tracking-tighter leading-none">
                        {room.name}
                      </h3>
                      {idx === 0 && room.is_active && !occ.isOccupied && (
                        <div className="best-match">
                          <Info size={18} /> {t("label_best_match")}
                        </div>
                      )}
                    </div>
                    <div className="room-info-container">
                      <span className="mci-info-tag">
                        <Users size={20} className="text-[#f7941d]" />{" "}
                        {room.capacity} {t("admin_label_capacity")}
                      </span>
                      <span className="mci-info-tag">
                        <MapPin size={20} className="text-[#f7941d]" />{" "}
                        {room.building?.name}
                      </span>
                      <span className="mci-info-tag">
                        <Layers size={20} className="text-[#f7941d]" />{" "}
                        {room.floor}. OG
                      </span>
                      {room.seating_arrangement && (
                        <span className="mci-info-tag">
                          <List size={20} className="text-[#f7941d]" />{" "}
                          {t(room.seating_arrangement)}
                        </span>
                      )}
                    </div>
                    <button
                      disabled={occ.isOccupied || !room.is_active}
                      onClick={() => {
                        setSelectedRoom(room);
                        setDuration(1);
                        setIsRecurring(false);
                        setShowBookingModal(true);
                      }}
                      className={`btn-mci-main ${occ.isOccupied || !room.is_active ? "bg-gray-300 shadow-none" : ""}`}
                    >
                      {!room.is_active
                        ? t("label_inactive")
                        : occ.isOccupied
                          ? t("btn_occupied")
                          : t("btn_reserve")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* --- ELEGANTES BUCHUNGS-MODAL (VERTIKAL GESTAPELT) --- */}

      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        mode="create"
        room={selectedRoom}
        rooms={rooms}
        bookings={bookings}
        equipmentList={equipmentList}
        lang={lang}
        t={t}
        onSuccess={initApp}
        userId={user.id}
        userEmail={user.email}
        initialDate={selectedDate}
        initialTime={selectedTime}
        minCapacity={minCapacity}
        selectedEquipment={selectedEquipment}
        buildings={buildings} // <--- DAS STEUERT DIE DATEN INS MODAL
      />

      {/* --- PROFIL SETTINGS MODAL --- */}
      {showSettingsModal && (
        <div className="mci-modal-overlay animate-in fade-in">
          <div className="mci-modal-card max-w-lg animate-in zoom-in-95">
            <div className="mci-modal-header italic uppercase font-bold text-2xl">
              <div className="flex items-center gap-3">
                <Settings size={28} />
                <span>{t("profile_title")}</span>
              </div>
              <button onClick={() => setShowSettingsModal(false)}>
                <X size={28} />
              </button>
            </div>

            <div className="p-14 space-y-10">
              {/* E-MAIL (Nur Anzeige) */}
              <div className="mci-field-group">
                <label className="mci-label">Email (MCI ID)</label>
                <div className="mci-input opacity-50 bg-gray-100 flex items-center gap-3 cursor-not-allowed">
                  <UserIcon size={18} className="text-gray-400" />
                  {user?.email}
                </div>
              </div>

              {/* NAMEN */}
              <div className="flex flex-row gap-6">
                <div className="mci-field-group flex-1">
                  <label className="mci-label">{t("admin_label_fname")}</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mci-input"
                  />
                </div>
                <div className="mci-field-group flex-1">
                  <label className="mci-label">{t("admin_label_lname")}</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mci-input"
                  />
                </div>
              </div>

              {/* PASSWORT ÄNDERN */}
              <div className="mci-field-group">
                <label className="mci-label">{t("label_new_password")}</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mci-input"
                />
              </div>

              <button
                onClick={async () => {
                  setLoading(true);
                  // 1. Profil-Daten (Name) updaten
                  await supabase
                    .from("profiles")
                    .update({ first_name: firstName, last_name: lastName })
                    .eq("id", user.id);

                  // 2. Passwort updaten, falls etwas eingegeben wurde
                  if (newPassword) {
                    const { error } = await supabase.auth.updateUser({
                      password: newPassword,
                    });
                    if (!error) {
                      alert(
                        t("password_updated_success") ||
                          "Passwort erfolgreich aktualisiert!",
                      );
                      setNewPassword("");
                    } else {
                      alert("Fehler beim Passwort-Update: " + error.message);
                    }
                  }

                  setShowSettingsModal(false);
                  initApp();
                  setLoading(false);
                }}
                className="btn-mci-main text-xl py-6 rounded-[2.25rem] shadow-xl"
              >
                {t("save_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
