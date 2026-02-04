"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import "./reservations.css";
import BookingModal from "@/app/components/BookingModal";
import LoadingScreen from "@/app/components/LoadingScreen";

// Integration der zentralen lib-Architektur
import {
  APP_CONFIG,
  BOOKING_STATUS,
  SUPPORTED_LANGS,
  Language,
} from "@/lib/constants";
import { getEquipmentIcon } from "@/lib/icons";
import {
  timeToMinutes,
  getEndTimeParts,
  getTrans,
  getDistance,
} from "@/lib/utils";

// Heiliges Gebot: Alle Icons explizit importieren um Fehler zu vermeiden
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  Filter as FilterIcon,
  XCircle,
  Globe,
  ChevronDown,
  History,
  Edit3,
  UserIcon,
  CheckCircle,
  Repeat,
  Layers,
  AlertCircle,
  Armchair,
  ShieldCheck,
  Trash2,
  Users,
  MapPin,
  Wifi,
  Save,
  Navigation,
  Info,
  ChevronUp,
  MoreHorizontal,
  CircleX,
} from "lucide-react";

export default function ReservationsPage() {
  const router = useRouter();

  // Zustandsverwaltung
  const [lang, setLang] = useState<Language>(APP_CONFIG.DEFAULT_LANG);
  const [dbTrans, setDbTrans] = useState<any>({});
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Steuerung für Expansion
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Filter-Steuerung
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterRoom, setFilterRoom] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterBuilding, setFilterBuilding] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [minCapacity, setMinCapacity] = useState("0");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  const [checkinFeedback, setCheckinFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const t = (key: string) => dbTrans[key?.toLowerCase()]?.[lang] || key;

  // HEILIGES GEBOT: BACKGROUND SCROLL LOCK (Verhindert Scrollen der Liste bei offenem Filter)
  useEffect(() => {
    if (showMobileFilters) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showMobileFilters]);

  // --- CORE FUNCTIONS (SAFEGUARDED) ---

  const handleLangToggle = () => {
    const currentIndex = SUPPORTED_LANGS.indexOf(lang);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LANGS.length;
    const nextLang = SUPPORTED_LANGS[nextIndex];
    setLang(nextLang);
    localStorage.setItem("mci_lang", nextLang);
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCheckInAvailable = (booking: any) => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    if (
      booking.booking_date !== todayStr ||
      booking.status !== BOOKING_STATUS.ACTIVE ||
      booking.is_checked_in
    )
      return false;
    const startMin = timeToMinutes(booking.start_time);
    const currentMin = now.getHours() * 60 + now.getMinutes();
    return currentMin >= startMin - 15 && currentMin < startMin + 15;
  };

  const handleEdit = (booking: any) => {
    const room = rooms.find((r) => r.id === booking.room_id);
    setSelectedEquipment(room?.equipment || []);
    setMinCapacity(room?.capacity?.toString() || "0");
    setEditingBooking({ ...booking, room_name: room?.name });
    setShowEditModal(true);
  };

  const handleSecureCheckIn = async (booking: any) => {
    setLoading(true);
    const room = rooms.find((r) => r.id === booking.room_id);
    const building = buildings.find((b) => b.id === room?.building_id);

    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const { ip } = await ipRes.json();
      const allowedPrefixes = (building?.mci_wifi_ip || "").split(",");
      const ipMatch = allowedPrefixes.some((p: string) =>
        ip.startsWith(p.trim()),
      );
      let gpsMatch = false;
      const pos: any = await new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 });
      });
      if (pos && building?.latitude && building?.longitude) {
        const dist = getDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          building.latitude,
          building.longitude,
        );
        if (dist <= APP_CONFIG.CHECKIN_RADIUS_METERS) gpsMatch = true;
      }
      if (ipMatch || gpsMatch) await performCheckIn(booking.id);
      else {
        setCheckinFeedback({ type: "error", text: t("msg_checkin_denied") });
        setTimeout(() => {
          setCheckinFeedback(null);
          setLoading(false);
        }, 3000);
      }
    } catch (err) {
      setCheckinFeedback({ type: "error", text: t("msg_checkin_denied") });
      setTimeout(() => {
        setCheckinFeedback(null);
        setLoading(false);
      }, 3000);
    }
  };

  async function performCheckIn(id: string) {
    const { error } = await supabase
      .from("bookings")
      .update({ is_checked_in: true, checked_in_at: new Date() })
      .eq("id", id);
    if (!error) {
      setCheckinFeedback({ type: "success", text: t("msg_checkin_success") });
      setTimeout(() => {
        setCheckinFeedback(null);
        loadAllData();
      }, 2000);
    }
  }

  // --- DATA LOADING & INIT ---

  async function loadAllData() {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);

    const [
      transRes,
      profileRes,
      roomsRes,
      profilesRes,
      bookingsRes,
      buildRes,
      equipRes,
    ] = await Promise.all([
      supabase.from("translations").select("*"),
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase
        .from("rooms")
        .select(`*, building:buildings!rooms_building_id_fkey (*)`),
      supabase.from("profiles").select("*").order("last_name"),
      supabase.from("bookings").select("*"),
      supabase.from("buildings").select("*"),
      supabase.from("equipment").select("*"),
    ]);

    const nowComp = new Date();
    const todayStr = nowComp.toISOString().split("T")[0];
    const currentMin = nowComp.getHours() * 60 + nowComp.getMinutes();
    const overdue = bookingsRes.data?.filter(
      (b) =>
        b.booking_date === todayStr &&
        b.status === BOOKING_STATUS.ACTIVE &&
        !b.is_checked_in &&
        currentMin >=
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
    setIsAdmin(profileRes.data?.is_admin || false);
    setFilterUser(session.user.id);
    setRooms(roomsRes.data || []);
    setProfiles(profilesRes.data || []);
    setBuildings(buildRes.data || []);
    setEquipmentList(equipRes.data || []);
    setLoading(false);
  }

  const filteredBookings = useMemo(() => {
    let list = isAdmin
      ? bookings
      : bookings.filter((b) => b.user_id === user?.id);

    return list
      .filter((b) => {
        const room = rooms.find((r) => r.id === b.room_id);
        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];
        const currentMin = now.getHours() * 60 + now.getMinutes();

        const isPast =
          b.booking_date < todayStr ||
          (b.booking_date === todayStr &&
            timeToMinutes(b.start_time) + b.duration <= currentMin);

        // HEILIGES GEBOT: Datums-Filter als oberste Instanz (gilt für alle Tabs)
        if (filterDate && b.booking_date !== filterDate) return false;

        if (filterStatus === "open") {
          return b.status === BOOKING_STATUS.ACTIVE && !isPast;
        }
        if (filterStatus === "finished") {
          return (
            (b.status === BOOKING_STATUS.ACTIVE && isPast) ||
            b.status === BOOKING_STATUS.RELEASED
          );
        }
        if (filterStatus === "cancelled") {
          return b.status === BOOKING_STATUS.CANCELLED;
        }

        if (filterRoom !== "all" && b.room_id !== filterRoom) return false;
        if (filterBuilding !== "all" && room?.building_id !== filterBuilding)
          return false;
        if (isAdmin && filterUser !== "all" && b.user_id !== filterUser)
          return false;
        return true;
      })
      .sort((a, b) => {
        const dateCompare = a.booking_date.localeCompare(b.booking_date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });
    // HEILIGES GEBOT: filterDate muss hier zwingend rein!
  }, [
    bookings,
    filterStatus,
    filterRoom,
    filterUser,
    filterBuilding,
    filterDate,
    isAdmin,
    rooms,
    user,
  ]);

  useEffect(() => {
    const savedLang = localStorage.getItem("mci_lang") as Language;
    if (SUPPORTED_LANGS.includes(savedLang)) setLang(savedLang);
    loadAllData();
  }, []);

  // --- SYSTEM-WIDE LOADING SCREEN (SHIELDCHECK BRANDING) ---
  if (loading && !checkinFeedback) return <LoadingScreen />;

  return (
    <div className="rbs-page-wrapper text-left">
      {checkinFeedback && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-white/90 animate-in fade-in">
          <div
            className={`p-10 rounded-[3rem] shadow-2xl text-center max-w-sm ${checkinFeedback.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
          >
            {checkinFeedback.type === "success" ? (
              <CheckCircle size={60} className="mx-auto mb-4 animate-bounce" />
            ) : (
              <AlertCircle size={60} className="mx-auto mb-4" />
            )}
            <p className="text-xl font-black uppercase italic">
              {checkinFeedback.text}
            </p>
          </div>
        </div>
      )}
      {/* NAVBAR HEADER (wie rooms) */}
      <nav className="rbs-navbar">
        <div className="flex items-center gap-2 md:gap-8">
          <img
            src="/MCI.png"
            alt="MCI"
            className="h-8 md:h-12 cursor-pointer"
            onClick={() => router.push("/rooms")}
          />
          <button
            onClick={() => router.push("/rooms")}
            className="nav-link !text-[10px] md:!text-xs"
          >
            <ArrowLeft size={16} />
            <span className="hidden md:inline">{t("archiv_back")}</span>
          </button>
        </div>
        <div className="flex items-center gap-3 md:gap-6 ml-auto">
          <button
            onClick={handleLangToggle}
            className="lang-toggle-btn shadow-sm"
          >
            <Globe size={14} className="text-[#004a87]" />
            <span className="text-[10px] font-black text-[#004a87] ml-1">
              {lang.toUpperCase()}
            </span>
          </button>
        </div>
      </nav>
      {/* PAGE CONTENT */}
      <div className="rbs-main-layout">
        <aside className="rbs-sidebar">
          <div className="rbs-sidebar-unit">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="rbs-sidebar-toggle"
            >
              <div className="flex items-center gap-3">
                <FilterIcon size={20} className="text-[#f7941d]" />
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
              {/* Desktop-Titel: Wird nur auf Desktop angezeigt */}
              <div className="rbs-sidebar-desktop-title">
                <FilterIcon size={20} />
                <span>{t("filter_title")}</span>
              </div>

              <div className="px-4 lg:px-6 pt-2 pb-4 lg:pb-6 space-y-6">
                <div>
                  <label className="mci-label">
                    {t("archiv_filter_status")}
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="mci-select"
                  >
                    <option value="all">{t("archiv_opt_all")}</option>
                    <option value="open">{t("archiv_opt_open")}</option>
                    <option value="finished">{t("archiv_opt_finished")}</option>
                    <option value="cancelled">
                      {t("archiv_opt_cancelled")}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="mci-label">{t("filter_time_label") || "Datum"}</label>
                  <div className="relative group">
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="mci-input"
                    />
                    {filterDate && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          setFilterDate("");
                        }}
                        /* z-index erhöht, damit der Klick vor dem unsichtbaren Browser-Icon landet */
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 z-10 transition-colors"
                      >
                        <CircleX size={20} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mci-label">
                    {t("admin_tab_buildings")}
                  </label>
                  <select
                    value={filterBuilding}
                    onChange={(e) => setFilterBuilding(e.target.value)}
                    className="mci-select"
                  >
                    <option value="all">{t("filter_all")}</option>
                    {buildings
                      .filter((b) => b.is_active !== false)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="mci-label">{t("archiv_filter_room")}</label>
                  <select
                    value={filterRoom}
                    onChange={(e) => setFilterRoom(e.target.value)}
                    className="mci-select"
                  >
                    <option value="all">{t("archiv_opt_all_rooms")}</option>
                    {rooms
                      .filter((r) => r.is_active !== false)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </div>
                {isAdmin && (
                  <div>
                    <label className="mci-label">
                      {t("archiv_filter_user")}
                    </label>
                    <select
                      value={filterUser}
                      onChange={(e) => setFilterUser(e.target.value)}
                      className="mci-select"
                    >
                      <option value="all">{t("archiv_opt_all_users")}</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.last_name}, {p.first_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
        <div className="flex-1 space-y-16">
          <section className="res-header-section">
            <div className="text-left">
              <h1 className="rbs-page-title">{t("archiv_title")}</h1>
              <div className="mt-2">
                <div className="res-stats-badge">
                  <History size={16} className="text-[#f7941d]" />
                  {filteredBookings.length} {t("label_entries")}
                </div>
              </div>
            </div>
          </section>

          <main className="res-list">
            {filteredBookings.map((b) => {
              const room = rooms.find((r) => r.id === b.room_id);
              const building = room?.building;
              const series = bookings
                .filter(
                  (bk) =>
                    bk.booking_code === b.booking_code &&
                    bk.status !== BOOKING_STATUS.CANCELLED,
                )
                .sort((a, b) => a.booking_date.localeCompare(b.booking_date));
              const bookingUser = profiles.find((p) => p.id === b.user_id);
              const isExpanded = expandedCards.has(b.id);
              const isCancelled = b.status === BOOKING_STATUS.CANCELLED;
              const isReleased =
                b.status === BOOKING_STATUS.RELEASED ||
                (b.booking_date === new Date().toISOString().split("T")[0] &&
                  !b.is_checked_in &&
                  new Date().getHours() * 60 + new Date().getMinutes() >=
                    timeToMinutes(b.start_time) +
                      APP_CONFIG.AUTO_RELEASE_MINUTES);
              const canCheckIn = isCheckInAvailable(b);
              const isFinished =
                b.booking_date < new Date().toISOString().split("T")[0] ||
                (b.booking_date === new Date().toISOString().split("T")[0] &&
                  // HEILIGES GEBOT: b.duration direkt addieren (Minuten-Schema)
                  timeToMinutes(b.start_time) + b.duration <=
                    new Date().getHours() * 60 + new Date().getMinutes());

              // Korrektur: getEndTimeParts benötigt Stunden (Minuten / 60)
              const { hh, mm } = getEndTimeParts(b.start_time, b.duration / 60);
              const formattedDate = new Date(b.booking_date).toLocaleDateString(
                lang,
                {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                },
              );

              return (
                <div
                  key={b.id}
                  className={`res-card ${isExpanded ? "is-expanded" : ""} ${isCancelled || isReleased ? "opacity-60" : ""}`}
                >
                  {/* Mobile Identity */}
                  <div className="res-mobile-head-img">
                    <div className="res-image-wrapper !w-full !h-[180px]">
                      {room?.image_url ? (
                        <img
                          src={room.image_url}
                          className="w-full h-full object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl bg-slate-100">
                          🏢
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="res-card-row-top">
                    <div className="res-col-identity">
                      <div className="res-titles">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3
                            className="res-room-title mci-card-title"
                            title={room?.name}
                          >
                            {room?.name}
                          </h3>
                          {series.length > 1 && (
                            <span className="mci-badge text-orange-500 border-orange-100 shadow-none">
                              <Repeat size={10} />{" "}
                              <span>
                                {t("label_series")}{" "}
                                {series.findIndex((bk) => bk.id === b.id) + 1}/
                                {series.length}
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="res-header-meta text-[var(--mci-blue)]">
                          {building?.name} • {room?.floor}. {t("label_floor")}
                        </p>

                        <div className="flex items-center gap-2 mt-1 text-[10px] font-black uppercase italic text-slate-400">
                          <UserIcon
                            size={12}
                            className="text-[var(--rbs-orange)]"
                          />
                          <span>
                            {bookingUser
                              ? `${bookingUser.first_name} ${bookingUser.last_name}`
                              : b.user_email}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          <div className="mci-info-tag !px-3">
                            <Calendar size={14} className="text-orange-500" />
                            <span>{formattedDate}</span>
                          </div>
                          <div className="mci-info-tag !px-3">
                            <Clock size={14} className="text-orange-500" />
                            <span>
                              {b.start_time} - {hh}:{mm}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="res-col-actions-top">
                      {!isCancelled && !isReleased ? (
                        <div className="res-col-actions-btn">
                          {/* SLOT 1: DYNAMISCHER STATUS / CHECK-IN */}
                          {b.is_checked_in ? (
                            <div
                              className="mci-action-btn-unified bg-green-50 text-green-600 shadow-sm"
                              title={t("label_checked_in")}
                            >
                              <CheckCircle size={16} />
                              <span className="res-btn-label">
                                {t("label_checked_in")}
                              </span>
                            </div>
                          ) : canCheckIn ? (
                            <button
                              onClick={() => handleSecureCheckIn(b)}
                              className="mci-action-btn-unified !h-[3.2rem] !bg-green-600 text-white shadow-md animate-pulse"
                              title={t("btn_checkin")}
                            >
                              <Wifi size={16} />
                              <span className="res-btn-label">
                                {t("btn_checkin")}
                              </span>
                            </button>
                          ) : (
                            <div
                              className="mci-action-btn-unified bg-slate-50 text-slate-400 border border-slate-100 shadow-sm"
                              title={t("label_waiting")}
                            >
                              <Clock size={16} />
                              <span className="res-btn-label">
                                {t("label_waiting")}
                              </span>
                            </div>
                          )}

                          {/* SLOT 2: BEARBEITEN */}
                          <button
                            onClick={() => handleEdit(b)}
                            // Deaktiviert wenn beendet (Heilige Regel: Logik-Präzision)
                            disabled={isFinished}
                            className={`res-btn-edit ${isFinished ? "opacity-40 cursor-not-allowed grayscale shadow-none" : ""}`}
                            title={t("label_edit_booking")}
                          >
                            <Edit3 size={16} />
                            <span className="res-btn-label">
                              {t("label_edit_booking")}
                            </span>
                          </button>

                          {/* SLOT 3: DETAILS TOGGLE */}
                          <button
                            onClick={() => toggleCard(b.id)}
                            className="mci-action-btn-unified !h-[3.2rem] !bg-slate-50 text-slate-400 border border-slate-100 shadow-sm"
                          >
                            {isExpanded ? (
                              <ChevronUp size={20} />
                            ) : (
                              <MoreHorizontal size={20} />
                            )}
                          </button>
                        </div>
                      ) : (
                        /* SLOT: STORNIERT / FREIGEGEBEN */
                        <div className="res-status-indicator">
                          {isCancelled ? (
                            <XCircle size={20} />
                          ) : (
                            <AlertCircle size={20} />
                          )}
                          <span className="text-[10px] uppercase font-medium italic">
                            {isCancelled
                              ? t("archiv_opt_cancelled")
                              : t("archiv_status_released")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="res-card-row-details animate-in slide-in-from-top-2 duration-300">
                      <div className="res-equip-strip">
                        <div className="flex flex-wrap gap-2 py-4 border-b border-slate-50 no-margin-left">
                          {room?.equipment?.map((eqId: string) => (
                            <span
                              key={eqId}
                              className="rbs-badge"
                              title={t("equip_" + eqId).toUpperCase()}
                            >
                              {getEquipmentIcon(eqId)}{" "}
                              <span className="hidden sm:inline ml-1 font-bold">
                                {t("equip_" + eqId).toUpperCase()}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="res-details-content grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div className="res-details-left">
                          <div className="res-image-wrapper res-detail-img-desktop mb-3">
                            {room?.image_url ? (
                              <img
                                src={room.image_url}
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl bg-slate-100">
                                🏢
                              </div>
                            )}
                          </div>
                          <div className="res-map-wrapper grayscale framed-map">
                            {building?.latitude && (
                              <iframe
                                title="Map"
                                src={`https://maps.google.com/maps?q=${building.latitude},${building.longitude}&z=16&output=embed`}
                                className="w-full h-full border-none"
                                loading="lazy"
                              />
                            )}
                          </div>
                        </div>
                        <div className="res-details-right">
                          <div className="space-y-2">
                            <div className="mci-info-tag !py-4">
                              <Users size={18} />
                              <span>
                                {room?.capacity} {t("admin_label_capacity")}
                              </span>
                            </div>
                            <div
                              className="mci-info-tag !py-4"
                              title={t(room?.seating_arrangement)}
                            >
                              <Armchair size={18} />
                              <span className="truncate">
                                {t(room?.seating_arrangement)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-auto pt-6 flex flex-col gap-2">
                            {series.length > 1 && (
                              <button
                                onClick={() => {
                                  if (confirm(t("btn_cancel_series") + "?"))
                                    supabase
                                      .from("bookings")
                                      .update({
                                        status: BOOKING_STATUS.CANCELLED,
                                      })
                                      .eq("booking_code", b.booking_code)
                                      .then(() => loadAllData());
                                }}
                                className="mci-action-btn-unified !h-[3rem] !bg-red-50 !text-red-600 border border-red-200"
                                title={t("btn_cancel_series")}
                              >
                                <Trash2 size={16} />{" "}
                                <span className="truncate">
                                  {t("btn_cancel_series")}
                                </span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm(t("btn_cancel_single") + "?"))
                                  supabase
                                    .from("bookings")
                                    .update({
                                      status: BOOKING_STATUS.CANCELLED,
                                    })
                                    .eq("id", b.id)
                                    .then(() => loadAllData());
                              }}
                              className="mci-action-btn-unified !h-[3rem] !bg-slate-100 !text-red-500 border border-red-100"
                              title={t("btn_cancel_single")}
                            >
                              <Trash2 size={16} />{" "}
                              <span className="truncate">
                                {t("btn_cancel_single")}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </main>
        </div>{" "}
        {/* Ende flex-1 */}
      </div>{" "}
      {/* Ende res-main-content */}
      <BookingModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingBooking(null);
        }}
        mode="edit"
        booking={editingBooking}
        rooms={rooms}
        bookings={bookings}
        equipmentList={equipmentList}
        lang={lang}
        t={t}
        onSuccess={loadAllData}
        userId={user?.id}
        userEmail={user?.email}
        buildings={buildings}
        minCapacity={minCapacity}
        selectedEquipment={selectedEquipment}
      />
    </div>
  );
}
