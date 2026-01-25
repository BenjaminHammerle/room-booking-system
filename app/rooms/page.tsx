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
  History,
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

  useEffect(() => {
    const savedLang = localStorage.getItem("mci_lang") as "de" | "en";
    if (savedLang) setLang(savedLang);
  }, []);

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

  // --- UI & FILTER STATES ---
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
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

  // --- DYNAMISCHE STATUS LOGIK ---
  const getRoomContextStatus = (roomId: string) => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Referenz-Zeitpunkt: "Echt-Jetzt" für heute, "Gewählte-Zeit" für die Zukunft
    const referenceTimeMin =
      selectedDate === todayStr
        ? now.getHours() * 60 + now.getMinutes()
        : timeToMinutes(selectedTime);

    const dayBookings = bookings
      .filter(
        (b) =>
          b.room_id === roomId &&
          b.booking_date === selectedDate &&
          b.status === "active",
      )
      .sort(
        (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
      );

    // 1. Ist der Raum zum Referenzzeitpunkt belegt?
    const currentBooking = dayBookings.find((b) => {
      const start = timeToMinutes(b.start_time);
      const end = start + (b.duration || 1) * 60;
      return referenceTimeMin >= start && referenceTimeMin < end;
    });

    if (currentBooking) {
      const endT = minutesToTime(
        timeToMinutes(currentBooking.start_time) + currentBooking.duration * 60,
      );
      return {
        type: "occupied",
        isOccupiedNow: true,
        label: `${t("label_occupied_until")} ${endT}`,
        className: "room-occupied-until",
      };
    }

    // 2. Ist der Raum frei, hat aber heute/am Zieltag noch spätere Buchungen?
    const nextBooking = dayBookings.find(
      (b) => timeToMinutes(b.start_time) > referenceTimeMin,
    );
    if (nextBooking) {
      return {
        type: "available",
        isOccupiedNow: false,
        label: `${t("label_available_until")} ${nextBooking.start_time}`,
        className: "room-available-until",
      };
    }

    return {
      type: "free",
      isOccupiedNow: false,
      label: t("label_available_all_day"),
      className: "room-available-until",
    };
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

  // --- FILTER & SORTIERUNG ---
  const maxRoomCapacity = useMemo(
    () =>
      rooms.length === 0 ? 100 : Math.max(...rooms.map((r) => r.capacity)),
    [rooms],
  );

  const filteredRooms = useMemo(() => {
    return rooms
      .filter((r) => {
        const status = getRoomContextStatus(r.id);
        const matchesSearch =
          searchQuery &&
          r.name.toLowerCase().includes(searchQuery.toLowerCase());

        // Filter-Logik: Belegte Räume nur bei aktiver Suche anzeigen
        if (!searchQuery && (!r.is_active || status.isOccupiedNow))
          return false;
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
        // 1. Inaktive nach hinten
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;

        // 2. Belegte (zum Zielzeitpunkt) nach hinten
        const statusA = getRoomContextStatus(a.id);
        const statusB = getRoomContextStatus(b.id);
        if (statusA.isOccupiedNow !== statusB.isOccupiedNow)
          return statusA.isOccupiedNow ? 1 : -1;

        // 3. Nach Kapazität (Best Match Logik)
        const req = parseInt(minCapacity) || 0;
        return a.capacity - req - (b.capacity - req);
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

  const activeCount = useMemo(
    () =>
      filteredRooms.filter(
        (r) => r.is_active && !getRoomContextStatus(r.id).isOccupiedNow,
      ).length,
    [filteredRooms, selectedDate, selectedTime, bookings],
  );

  return (
    <div className="room-page-wrapper">
      <nav className="room-navbar">
        <div className="flex items-center gap-2 md:gap-8">
          <img
            src="/MCI.png"
            alt="MCI"
            className="h-8 md:h-12 cursor-pointer"
            onClick={() => router.push("/rooms")}
          />
          <button
            onClick={() => router.push("/reservations")}
            className="nav-link !text-[10px] md:!text-xs"
          >
            <Calendar size={16} />{" "}
            <span className="hidden xs:inline">{t("nav_bookings")}</span>
          </button>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <button
            onClick={handleLangToggle}
            className="lang-toggle-btn !py-1.5 !px-3"
          >
            <Globe size={14} />{" "}
            <span className="text-[10px]">{lang.toUpperCase()}</span>
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
          {/* MOBILE FILTER TOGGLE */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden w-full mb-4 flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Filter size={20} className="text-[#f7941d]" />
              <span className="text-[#004a87] italic uppercase text-sm tracking-widest">
                {t("filter_title")}
              </span>
            </div>
            <ChevronDown
              className={`text-[#004a87] transition-transform ${showMobileFilters ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className={`filter-card hide-scrollbar ${showMobileFilters ? "block" : "hidden lg:block"} max-h-[85vh] overflow-y-auto`}
          >
            <div className="hidden lg:flex items-center gap-2 mb-8 text-[#004a87] italic uppercase text-sm tracking-widest">
              <Filter size={20} className="text-[#f7941d]" />{" "}
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
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    if (
                      d.toISOString().split("T")[0] >=
                      new Date().toISOString().split("T")[0]
                    )
                      setSelectedDate(d.toISOString().split("T")[0]);
                  }}
                  className="p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <ChevronLeft size={20} />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mci-input !text-center flex-1 !px-2"
                />
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(d.toISOString().split("T")[0]);
                  }}
                  className="p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="flex flex-row items-center gap-2 mt-2">
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
                  ).map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="font-bold">:</span>
                <select
                  value={selectedTime.split(":")[1]}
                  onChange={(e) =>
                    setSelectedTime(
                      `${selectedTime.split(":")[0]}:${e.target.value}`,
                    )
                  }
                  className="mci-select text-center flex-1"
                >
                  {["00", "15", "30", "45"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
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
              <div className="flex flex-col gap-1 mt-2">
                <label className="mci-filter-item">
                  <input
                    type="checkbox"
                    checked={onlyAccessible}
                    onChange={() => setOnlyAccessible(!onlyAccessible)}
                    className="filter-checkbox"
                  />
                  <span className="text-sm font-bold text-slate-500 flex items-center gap-2">
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
                      className={`text-sm font-bold ${selectedEquipment.includes(eq.id) ? "text-[var(--mci-blue)]" : "text-slate-500"}`}
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
          </div>
        </aside>

        <div className="flex-1 space-y-16">
          <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mci-animate-fade">
            <div className="text-left">
              <h1 className="room-page-title">{t("title")}</h1>
              {/* MOBIL Badge unter dem Titel */}
              <div className="md:hidden mt-2">
                <div className="bg-[#004a87] text-white px-4 py-2 rounded-xl font-bold text-xs inline-flex items-center gap-2 shadow-md">
                  <History size={16} className="text-[#f7941d]" /> {activeCount}{" "}
                  {t("label_active_rooms")}
                </div>
              </div>
              <p className="hidden md:block text-gray-600 font-bold text-lg md:text-2xl italic">
                {activeCount} {t("label_active_rooms")}
              </p>
            </div>
          </section>

          <div className="room-grid">
            {filteredRooms.map((room, idx) => {
              const status = getRoomContextStatus(room.id);

              return (
                <div
                  key={room.id}
                  className={`room-card group ${!room.is_active || status.isOccupiedNow ? "opacity-70" : ""}`}
                >
                  <div className="room-card-image-wrapper">
                    <img
                      src={room.image_url}
                      className={`room-card-image group-hover:scale-105 transition-all duration-1000 ${status.isOccupiedNow ? "grayscale" : ""}`}
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

                    {/* DYNAMISCHES LIVE STATUS BADGE (Echtzeit Berechnung) */}
                    {room.is_active && (
                      <div
                        className={`${status.className} flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-500`}
                      >
                        {status.type === "occupied" ? (
                          <XCircle size={18} />
                        ) : (
                          <CheckCircle2 size={18} />
                        )}
                        {status.label}
                      </div>
                    )}

                    {!room.is_active && (
                      <div className="room-inactive">
                        <Ban size={18} /> {t("label_inactive")}
                      </div>
                    )}
                  </div>

                  <div className="room-card-content">
                    <div className="flex flex-row justify-between items-start mb-6">
                      <h3 className="font-bold text-3xl md:text-4xl tracking-tighter leading-none text-left">
                        {room.name}
                      </h3>
                      {idx === 0 && room.is_active && !status.isOccupiedNow && (
                        <div className="best-match">
                          <Info size={18} /> {t("label_best_match")}
                        </div>
                      )}
                    </div>
                    <div className="room-info-container text-left">
                      <span className="mci-info-tag">
                        <Users size={20} />
                        <span className="mci-info-tag-text">
                          {room.capacity} {t("admin_label_capacity")}
                        </span>
                      </span>
                      <span className="mci-info-tag">
                        <MapPin size={20} />
                        <span className="mci-info-tag-text">
                          {room.building?.name}
                        </span>
                      </span>
                      <span className="mci-info-tag">
                        <Layers size={20} />
                        <span className="mci-info-tag-text">
                          {room.floor}. OG
                        </span>
                      </span>
                      {room.seating_arrangement && (
                        <span
                          className="mci-info-tag"
                          title={t(room.seating_arrangement)}
                        >
                          <List size={20} />
                          <span className="mci-info-tag-text">
                            {t(room.seating_arrangement)}
                          </span>
                        </span>
                      )}
                    </div>
                    <button
                      disabled={status.isOccupiedNow || !room.is_active}
                      onClick={() => {
                        setSelectedRoom(room);
                        setShowBookingModal(true);
                      }}
                      className={`btn-mci-main ${status.isOccupiedNow || !room.is_active ? "bg-gray-300 shadow-none" : ""}`}
                    >
                      {!room.is_active
                        ? t("label_inactive")
                        : status.isOccupiedNow
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
        userId={user?.id}
        userEmail={user?.email}
        initialDate={selectedDate}
        initialTime={selectedTime}
        minCapacity={minCapacity}
        selectedEquipment={selectedEquipment}
        buildings={buildings}
      />

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
            <div className="p-14 space-y-10 text-left">
              <div className="mci-field-group">
                <label className="mci-label">Email (MCI ID)</label>
                <div className="mci-input opacity-50 bg-gray-100 flex items-center gap-3 cursor-not-allowed">
                  <UserIcon size={18} className="text-gray-400" />
                  {user?.email}
                </div>
              </div>
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
                  await supabase
                    .from("profiles")
                    .update({ first_name: firstName, last_name: lastName })
                    .eq("id", user.id);
                  if (newPassword) {
                    await supabase.auth.updateUser({ password: newPassword });
                    alert(t("password_updated_success"));
                    setNewPassword("");
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
