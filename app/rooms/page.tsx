"use client";

// react und react hooks

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import "./room.css";
import BookingModal from "@/app/components/BookingModal";
import LoadingScreen from "@/app/components/LoadingScreen";
import {
  APP_CONFIG,
  BOOKING_STATUS,
  SUPPORTED_LANGS,
  Language,
} from "@/lib/constants";
import { getEquipmentIcon } from "@/lib/icons";
import { timeToMinutes, getEndTimeParts, getTrans } from "@/lib/utils";
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
  History,
  Save,
  Armchair,
} from "lucide-react";

// hauptkomponente für raum buchung seite
export default function RoomBookingPage() {
  const router = useRouter();
  // states für app funktionalität
  const [lang, setLang] = useState<Language>(APP_CONFIG.DEFAULT_LANG);
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
  const [newPassword, setNewPassword] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // desktop breakpoint tracking (≥1410px)
  // background scroll lock für profil modal
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1410);
    };
    checkDesktop(); // Initial check
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // background scroll lock für profil modal
  useEffect(() => {
    if (showSettingsModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showSettingsModal]);

  // datum mit smart default (morgen ab gewisser zeit)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    if (now.getHours() >= APP_CONFIG.SMART_TIME_THRESHOLD_HOUR) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split("T")[0];
    }
    return now.toISOString().split("T")[0];
  });


  // zeit mit smart default (nächste 15min)
  const [selectedTime, setSelectedTime] = useState(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    if ((h >= APP_CONFIG.SMART_TIME_THRESHOLD_HOUR && m > 15) || h < 7)
      return APP_CONFIG.DEFAULT_START_TIME;
    let nextM = Math.ceil(m / 15) * 15;
    let nextH = h;
    if (nextM === 60) {
      nextH++;
      nextM = 0;
    }
    return `${nextH.toString().padStart(2, "0")}:${nextM.toString().padStart(2, "0")}`;
  });


  // filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [minCapacity, setMinCapacity] = useState("0");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [onlyAccessible, setOnlyAccessible] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState("all");
  const [selectedSeating, setSelectedSeating] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState<any>(null);


  // helper variablen und funktionen
  const t = (key: string) => dbTrans[key?.toLowerCase()]?.[lang] || key;
  const nowComp = new Date();
  const currentHour = nowComp.getHours();
  const currentMin = nowComp.getMinutes();
  const isToday = selectedDate === nowComp.toISOString().split("T")[0];


  // beim laden sprache setzen und app initialisieren
  useEffect(() => {
    const savedLang = localStorage.getItem("rbs_lang") as Language;
    if (SUPPORTED_LANGS.includes(savedLang)) setLang(savedLang);
    initApp();
  }, [selectedDate]);


  // sprache wechseln
  const handleLangToggle = () => {
    const currentIndex = SUPPORTED_LANGS.indexOf(lang);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LANGS.length;
    const nextLang = SUPPORTED_LANGS[nextIndex];
    setLang(nextLang);
    localStorage.setItem("rbs_lang", nextLang);
  };


  // app initialisierung - daten laden
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

    const todayStr = new Date().toISOString().split("T")[0];
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const overdue = bookingsRes.data?.filter(
      (b) =>
        b.booking_date === todayStr &&
        b.status === BOOKING_STATUS.ACTIVE &&
        !b.is_checked_in &&
        nowMinutes >=
          timeToMinutes(b.start_time) + APP_CONFIG.AUTO_RELEASE_MINUTES,
    );
    if (overdue?.length) {
      for (const b of overdue)
        await supabase
          .from("bookings")
          .update({ status: BOOKING_STATUS.RELEASED })
          .eq("id", b.id);
      const { data: fresh } = await supabase.from("bookings").select("*");
      if (fresh) setBookings(fresh);
    } else {
      if (bookingsRes.data) setBookings(bookingsRes.data);
    }

    if (transRes.data) {
      const tMap: any = {};
      transRes.data.forEach((i) => (tMap[i.key.toLowerCase()] = i));
      setDbTrans(tMap);
    }
    setEquipmentList(equipRes.data || []);
    if (roomsRes.data) {
      setRooms(roomsRes.data);
      setBuildings(
        Array.from(
          new Map(
            roomsRes.data
              .filter((r) => r.building)
              .map((r) => [r.building.id, r.building]),
          ).values(),
        ) 
        .sort((a: any, b: any) => a.name.localeCompare(b.name)) as any[]
      );
    }
    if (profileRes.data) {
      setIsAdmin(profileRes.data.is_admin);
      setFirstName(profileRes.data.first_name || "");
      setLastName(profileRes.data.last_name || "");
    }
    setLoading(false);
  }

  const handleUpdateProfile = async () => {
    setLoading(true);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName })
      .eq("id", user.id);
    if (newPassword) {
      const { error: pwdError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (pwdError) alert(pwdError.message);
    }
    if (!profileError) {
      setShowSettingsModal(false);
      setNewPassword("");
      await initApp();
    } else alert(profileError.message);
    setLoading(false);
  };

  const getRoomContextStatus = (roomId: string) => {
    const refMin = isToday
      ? currentHour * 60 + currentMin
      : timeToMinutes(selectedTime);
    const dayBookings = bookings
      .filter(
        (b) =>
          b.room_id === roomId &&
          b.booking_date === selectedDate &&
          b.status === BOOKING_STATUS.ACTIVE,
      )
      .sort(
        (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
      );
    const current = dayBookings.find((b) => {
      const start = timeToMinutes(b.start_time);
      const end = start + b.duration;
      return refMin >= start && refMin < end;
    });
    if (current) {
      const endT = getEndTimeParts(
        current.start_time,
        current.duration / 60,
      ).full;
      return {
        type: "occupied",
        isOccupiedNow: true,
        label: `${t("label_occupied_until")} ${endT}`,
        className: "room-occupied-until",
      };
    }
    const next = dayBookings.find((b) => timeToMinutes(b.start_time) > refMin);
    if (next)
      return {
        type: "available",
        isOccupiedNow: false,
        label: `${t("label_available_until")} ${next.start_time}`,
        className: "room-available-until",
      };
    return {
      type: "free",
      isOccupiedNow: false,
      label: t("label_available_all_day"),
      className: "room-available-until",
    };
  };


  // gefilter te räume basierend auf suchkriterien
  const filteredRooms = useMemo(() => {
    const reqCap = parseInt(minCapacity) || 0;
    return rooms
      .filter((r) => {
        if (!r.is_active) return false;
        const status = getRoomContextStatus(r.id);
        const matchesSearch =
          searchQuery &&
          r.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!searchQuery && status.isOccupiedNow) return false;
        if (searchQuery && !matchesSearch) return false;
        if (onlyAccessible && !r.accessible) return false;
        if (reqCap > 0 && r.capacity < reqCap) return false;
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
        const statusA = getRoomContextStatus(a.id);
        const statusB = getRoomContextStatus(b.id);
        if (statusA.isOccupiedNow !== statusB.isOccupiedNow)
          return statusA.isOccupiedNow ? 1 : -1;
        if (reqCap === 0) return a.capacity - b.capacity;
        const deltaA = a.capacity - reqCap;
        const deltaB = b.capacity - reqCap;
        if (Math.abs(deltaA - deltaB) <= 2) {
          if (a.equipment?.length !== b.equipment?.length)
            return (a.equipment?.length || 0) - (b.equipment?.length || 0);
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

  const activeCount = useMemo(
    () =>
      filteredRooms.filter((r) => !getRoomContextStatus(r.id).isOccupiedNow)
        .length,
    [filteredRooms, selectedDate, selectedTime, bookings],
  );

  if (loading && !showBookingModal && !showSettingsModal)
    return <LoadingScreen />;

  return (
    <div className="rbs-page-wrapper text-left">
      {/* navigation bar */}
      <nav className="rbs-navbar">
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
            <span className="hidden md:inline">{t("nav_bookings")}</span>
          </button>
        </div>
        <div className="flex items-center gap-3 md:gap-6 ml-auto">
          <button
            onClick={handleLangToggle}
            className="lang-toggle-btn shadow-sm"
          >
            <Globe size={14} className="text-[#004a87]" />{" "}
            <span className="text-[10px] font-black text-[#004a87] ml-1">
              {lang.toUpperCase()}
            </span>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 group"
            >
              <div className="bg-gray-100 w-11 h-11 rounded-full flex items-center justify-center text-[#004a87] border group-hover:border-[#549BB7] transition-all">
                <UserIcon size={22} />
              </div>
              <span className="hidden md:inline font-bold text-slate-700">
                {firstName || "MCI User"}
              </span>
              <ChevronDown
                size={14}
                className="hidden md:inline text-gray-400"
              />
            </button>

      {/* user menü dropdown */}
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

      <main className="rbs-main-layout">

      {/* filter sidebar */}
        <aside className="rbs-sidebar">
          {/* filter container */}
          <div className="rbs-sidebar-unit">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="rbs-sidebar-toggle"
            >
              <div className="flex items-center gap-3">
                <Filter size={20} className="text-[#f7941d]" />
                <span>{t("filter_title")}</span>
              </div>
              <ChevronDown
                size={24}
                className={`transition-transform duration-200 ${showMobileFilters ? "rotate-180" : ""}`}
              />
            </button>

            <div
              className={`rbs-sidebar-content ${showMobileFilters ? "block" : "hidden min-[1400px]:block"}`}
            >
              <div className="rbs-sidebar-desktop-title">
                <Filter size={20} /> {t("filter_title")}
              </div>
              <div className="px-4 lg:px-6 pt-2 pb-4 lg:pb-6 space-y-6">
                <div className="rbs-field-group">
                  <label className="rbs-label">
                    {t("filter_search_label")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("filter_search_placeholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rbs-input"
                  />
                </div>
                <div className="rbs-field-group">
                  <label className="rbs-label">{t("filter_time_label")}</label>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() - 1);
                        if (
                          d.toISOString().split("T")[0] >=
                          nowComp.toISOString().split("T")[0]
                        )
                          setSelectedDate(d.toISOString().split("T")[0]);
                      }}
                      className="rbs-step-btn"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <input
                      type="date"
                      value={selectedDate}
                      min={nowComp.toISOString().split("T")[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="rbs-input !relative !text-center flex-1 min-w-0 !px-2"
                    />
                    <button
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() + 1);
                        setSelectedDate(d.toISOString().split("T")[0]);
                      }}
                      className="rbs-step-btn"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <select
                      value={selectedTime.split(":")[0]}
                      onChange={(e) =>
                        setSelectedTime(
                          `${e.target.value}:${selectedTime.split(":")[1]}`,
                        )
                      }
                      className="rbs-select text-center flex-1"
                    >
                      {Array.from({ length: 17 }, (_, i) =>
                        (i + 7).toString().padStart(2, "0"),
                      ).map((h) => (
                        <option
                          key={h}
                          value={h}
                          disabled={isToday && parseInt(h) < currentHour}
                        >
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
                      className="rbs-select text-center flex-1"
                    >
                      {["00", "15", "30", "45"].map((m) => (
                        <option
                          key={m}
                          value={m}
                          disabled={
                            isToday &&
                            parseInt(selectedTime.split(":")[0]) ===
                              currentHour &&
                            parseInt(m) <= currentMin
                          }
                        >
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="rbs-field-group">
                  <label className="rbs-label">{t("filter_cap")}</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max={150}
                      value={minCapacity}
                      onChange={(e) => setMinCapacity(e.target.value)}
                      className="filter-capacity-bar"
                    />
                    <input
                      type="number"
                      min="0"
                      max="150"
                      maxLength={3}
                      value={minCapacity}
                      onChange={(e) => {
                        const val = Math.max(
                          0,
                          Math.min(150, parseInt(e.target.value) || 0),
                        );
                        setMinCapacity(val.toString());
                      }}
                      className="filter-capacity-number"
                      style={{ width: "50px" }}
                    />
                  </div>
                </div>
                <div className="rbs-field-group">
                  <label className="rbs-label">{t("filter_location")}</label>
                  <select
                    value={selectedBuildingId}
                    onChange={(e) => setSelectedBuildingId(e.target.value)}
                    className="rbs-select"
                  >
                    <option value="all">{t("filter_all")}</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rbs-field-group">
                  <label className="rbs-label">{t("filter_seating")}</label>
                  <select
                    value={selectedSeating}
                    onChange={(e) => setSelectedSeating(e.target.value)}
                    className="rbs-select"
                  >
                    <option value="all">{t("filter_all")}</option>
                    {Array.from(
                      new Set(
                        rooms.map((r) => r.seating_arrangement).filter(Boolean),
                      ),
                    )
                    .sort((a: any, b: any) => t(a).localeCompare(t(b)))
                    .map((s: any) => (
                      <option key={s} value={s}>
                        {t(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rbs-field-group">
                  <label className="rbs-label">{t("filter_equip")}</label>
                  <div className="flex flex-col gap-1 mt-2">
                    <label
                      className={`rbs-filter-item accessible-filter ${onlyAccessible ? "active" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={onlyAccessible}
                        onChange={() => setOnlyAccessible(!onlyAccessible)}
                        className="filter-checkbox"
                      />
                      <span className="text-sm font-bold text-slate-500 flex items-center gap-2">
                        <Accessibility size={12} />
                        {t("label_accessible")}
                      </span>
                    </label>
                    {equipmentList.map((eq) => (
                      <label key={eq.id} className="rbs-filter-item">
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
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-500">
                          {getEquipmentIcon(eq.id)} {t("equip_" + eq.id)}
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
                  className="filter-reset-btn"
                >
                  <XCircle size={14} className="inline mr-2" />{" "}
                  {t("filter_reset_btn")}
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 space-y-16">
          <section className="room-header-section">
            <div className="text-left">
              <h1 className="rbs-page-title">{t("title")}</h1>
              <div className="mt-2">
                <div className="active-count-badge">
                  <History size={16} className="text-[#f7941d]" /> {activeCount}{" "}
                  {t("label_active_rooms")}
                </div>
              </div>
            </div>
          </section>

          <div className="room-grid">
            {filteredRooms.map((room, idx) => {
              const status = getRoomContextStatus(room.id);

  // hauptkomponente rendern
              return (
                <div
                  key={room.id}
                  className={`room-card group ${status.isOccupiedNow ? "is-occupied" : ""}`}
                >
                  <div className="room-card-image-wrapper">
                    <img
                      src={room.image_url}
                      className={`room-card-image ${status.isOccupiedNow ? "grayscale shadow-inner" : ""}`}
                      alt={room.name}
                    />
                    <div className="room-badge-container">
                      {room.accessible && (
                        <div className="accessible-badge">
                          <Accessibility size={16} /> {t("label_accessible")}
                        </div>
                      )}
                      {room.equipment?.map((eqId: string) => (
                        <div
                          key={eqId}
                          className="rbs-badge flex items-center gap-1"
                          title={t("equip_" + eqId).toUpperCase()}
                        >
                          {getEquipmentIcon(eqId)}{" "}
                          {t("equip_" + eqId).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <div
                      className={`${status.className} room-status-overlay animate-in fade-in slide-in-from-left-4 duration-500`}
                    >
                      {status.type === "occupied" ? (
                        <XCircle size={18} />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}{" "}
                      {status.label}
                    </div>
                  </div>
                  <div className="room-card-content text-left">
                    <div className="room-card-header">
                      <h3 className="room-card-name rbs-card-title">
                        {room.name}
                      </h3>
                      {idx === 0 && !status.isOccupiedNow && (
                        <div className="best-match">
                          <Info size={14} /> {t("label_best_match")}
                        </div>
                      )}
                    </div>
                    <div className="room-info-container">
                      <span className="rbs-info-tag">
                        <Users size={20} />{" "}
                        <span className="rbs-info-tag-text">
                          {room.capacity} {t("admin_label_capacity")}
                        </span>
                      </span>
                      <span className="rbs-info-tag">
                        <MapPin size={20} />{" "}
                        <span className="rbs-info-tag-text">
                          {room.building?.name}
                        </span>
                      </span>
                      <span className="rbs-info-tag">
                        <Layers size={20} />{" "}
                        <span className="rbs-info-tag-text">
                          {room.floor}. OG
                        </span>
                      </span>
                      {room.seating_arrangement && (
                        <span
                          className="rbs-info-tag"
                          title={t(room.seating_arrangement).toUpperCase()}
                        >
                          <Armchair size={20} />{" "}
                          <span className="rbs-info-tag-text truncate">
                            {t(room.seating_arrangement)}
                          </span>
                        </span>
                      )}
                    </div>
                    <button
                      disabled={status.isOccupiedNow}
                      onClick={() => {
                        setSelectedRoom(room);
                        setShowBookingModal(true);
                      }}
                      className={`rbs-btn-main ${status.isOccupiedNow ? "is-disabled" : ""}`}
                    >
                      {status.isOccupiedNow
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

      {/* einstellungen modal */}
      {showSettingsModal && (
        <div className="rbs-modal-overlay">
          <div className="rbs-modal-card max-w-xl">
            <div className="rbs-modal-header">
              <div className="flex flex-col text-left">
                <p className="rbs-modal-subtitle">{t("nav_profile")}</p>
                <h3 className="rbs-modal-title">
                  {firstName} {lastName}
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rbs-modal-close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="rbs-modal-body">
              <div className="rbs-modal-form-group">
                <label className="rbs-label">E-MAIL</label>
                <input
                  value={user?.email || ""}
                  readOnly
                  disabled
                  className="rbs-input !bg-slate-100 !cursor-not-allowed opacity-60"
                />
              </div>

              <div className="rbs-modal-form-grid">
                <div className="rbs-modal-form-group">
                  <label className="rbs-label">{t("admin_label_fname")}</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="rbs-input"
                  />
                </div>
                <div className="rbs-modal-form-group">
                  <label className="rbs-label">{t("admin_label_lname")}</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="rbs-input"
                  />
                </div>
              </div>

              <div className="rbs-modal-form-group">
                <label className="rbs-label">
                  {t("admin_label_password")} ({t("label_new_password")})
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rbs-input"
                />
              </div>
            </div>

            <div className="rbs-modal-footer">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rbs-modal-btn-secondary"
              >
                <XCircle size={20} /> <span>{t("archiv_back")}</span>
              </button>
              <button
                onClick={handleUpdateProfile}
                className="rbs-modal-btn-primary !justify-center"
              >
                <Save size={20} /> <span>{t("save_btn")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}