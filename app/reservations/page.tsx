"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import "./reservations.css";
import BookingModal from "@/app/components/BookingModal";

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

// Heiliges Gebot: Alle Icons explizit importieren
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
} from "lucide-react";

export default function ReservationsPage() {
  const router = useRouter();

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

  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterRoom, setFilterRoom] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterBuilding, setFilterBuilding] = useState("all");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [minCapacity, setMinCapacity] = useState("0");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [checkinFeedback, setCheckinFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const t = (key: string) => dbTrans[key?.toLowerCase()]?.[lang] || key;

  useEffect(() => {
    const savedLang = localStorage.getItem("mci_lang") as Language;
    if (SUPPORTED_LANGS.includes(savedLang)) setLang(savedLang);
    loadAllData();
  }, []);

  const handleLangToggle = () => {
    const currentIndex = SUPPORTED_LANGS.indexOf(lang);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LANGS.length;
    const nextLang = SUPPORTED_LANGS[nextIndex];
    setLang(nextLang);
    localStorage.setItem("mci_lang", nextLang);
  };

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
      for (const b of overdue) {
        await supabase
          .from("bookings")
          .update({ status: BOOKING_STATUS.RELEASED })
          .eq("id", b.id);
      }
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
    setRooms(roomsRes.data || []);
    setProfiles(profilesRes.data || []);
    setBuildings(buildRes.data || []);
    setEquipmentList(equipRes.data || []);
    setLoading(false);
  }

  const handleSecureCheckIn = async (booking: any) => {
    setLoading(true);
    const room = rooms.find((r) => r.id === booking.room_id);
    const building = buildings.find((b) => b.id === room?.building_id);
    if (window.location.hostname === "localhost") {
      await performCheckIn(booking.id);
      return;
    }

    try {
      const ipRes = await fetch("https://api64.ipify.org?format=json");
      const { ip } = await ipRes.json();
      const ipMatch =
        building?.mci_wifi_ip && ip.startsWith(building.mci_wifi_ip);
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
      if (ipMatch || gpsMatch) {
        await performCheckIn(booking.id);
      } else {
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

  const handleEdit = (booking: any) => {
    const room = rooms.find((r) => r.id === booking.room_id);
    setSelectedEquipment(room?.equipment || []);
    setMinCapacity(room?.capacity?.toString() || "0");
    setEditingBooking({ ...booking, room_name: room?.name });
    setShowEditModal(true);
  };

  const handleCancelSingle = async (id: string) => {
    if (!confirm(t("btn_cancel_single") + "?")) return;
    await supabase
      .from("bookings")
      .update({ status: BOOKING_STATUS.CANCELLED })
      .eq("id", id);
    loadAllData();
  };

  const handleCancelSeries = async (code: string) => {
    if (!confirm(t("btn_cancel_series") + "?")) return;
    await supabase
      .from("bookings")
      .update({ status: BOOKING_STATUS.CANCELLED })
      .eq("booking_code", code);
    loadAllData();
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
            timeToMinutes(b.start_time) + b.duration * 60 <= currentMin);
        if (
          filterStatus === "open" &&
          (isPast || b.status !== BOOKING_STATUS.ACTIVE)
        )
          return false;
        if (filterStatus === "finished" && !isPast) return false;
        if (
          filterStatus === "cancelled" &&
          b.status !== BOOKING_STATUS.CANCELLED
        )
          return false;
        if (filterRoom !== "all" && b.room_id !== filterRoom) return false;
        if (filterBuilding !== "all" && room?.building_id !== filterBuilding)
          return false;
        if (isAdmin && filterUser !== "all" && b.user_id !== filterUser)
          return false;
        return true;
      })
      .sort((a, b) => a.booking_date.localeCompare(b.booking_date));
  }, [
    bookings,
    filterStatus,
    filterRoom,
    filterUser,
    filterBuilding,
    isAdmin,
    rooms,
    user,
  ]);

  if (loading && !checkinFeedback)
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FB] text-[#004a87] font-black italic animate-pulse">
        <ShieldCheck size={80} className="mb-6 text-[#549BB7]" />
        <span>mci system check...</span>
      </div>
    );

  return (
    <div className="res-page-wrapper">
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

      <header className="res-page-header mb-12">
        <div className="flex justify-between items-start w-full">
          <div className="flex flex-col text-left">
            <button
              onClick={() => router.push("/rooms")}
              className="nav-link group mb-2"
            >
              <ArrowLeft size={16} />
              <span>{t("archiv_back")}</span>
            </button>
            <h1 className="res-page-title">{t("archiv_title")}</h1>

            {/* MOBILE BADGE: Nur sichtbar wenn Bildschirm < 768px. Nutzt kein .res-stats-badge im CSS für display */}
            <div className="md:hidden mt-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#004a87] text-white rounded-xl shadow-md border-none">
                <History size={14} />
                <span className="text-xs font-bold">
                  {filteredBookings.length} {t("label_entries")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* DESKTOP BADGE: Nur sichtbar wenn Bildschirm >= 768px */}
            <div className="hidden md:flex items-center gap-2 px-6 py-3 bg-[#004a87] text-white rounded-2xl shadow-lg border-none">
              <History size={16} />
              <span className="font-bold">
                {filteredBookings.length} {t("label_entries")}
              </span>
            </div>

            <button
              onClick={handleLangToggle}
              className="lang-toggle-btn mci-ui-toggle !py-2 !px-4 shadow-sm border border-gray-100 bg-white rounded-2xl hover:bg-gray-50 transition-colors shrink-0"
            >
              <Globe size={14} className="text-[#004a87]" />
              <span className="text-xs font-black text-[#004a87] ml-2">
                {lang.toUpperCase()}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="res-layout">
        <aside className="res-sidebar">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden w-full mb-4 flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm text-[#004a87] font-black italic uppercase mci-ui-toggle"
          >
            <div className="flex items-center gap-3">
              <FilterIcon size={20} className="text-[#f7941d]" />
              <span>{t("filter_title")}</span>
            </div>
            <ChevronDown className={showMobileFilters ? "rotate-180" : ""} />
          </button>

          <div
            className={`res-filter-card hide-scrollbar ${showMobileFilters ? "block" : "hidden lg:block"}`}
          >
            <div className="hidden lg:flex items-center gap-3 mb-8 text-[#004a87] font-black italic uppercase text-sm tracking-widest mci-ui-toggle">
              <FilterIcon size={20} className="text-[#f7941d]" />{" "}
              {t("filter_title")}
            </div>
            <div className="space-y-6">
              <div>
                <label className="mci-label">{t("archiv_filter_status")}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="mci-select"
                >
                  <option value="all">{t("archiv_opt_all")}</option>
                  <option value="open">{t("archiv_opt_open")}</option>
                  <option value="finished">{t("archiv_opt_finished")}</option>
                  <option value="cancelled">{t("archiv_opt_cancelled")}</option>
                </select>
              </div>
              <div>
                <label className="mci-label">{t("admin_tab_buildings")}</label>
                <select
                  value={filterBuilding}
                  onChange={(e) => setFilterBuilding(e.target.value)}
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
              <div>
                <label className="mci-label">{t("archiv_filter_room")}</label>
                <select
                  value={filterRoom}
                  onChange={(e) => setFilterRoom(e.target.value)}
                  className="mci-select"
                >
                  <option value="all">{t("archiv_opt_all_rooms")}</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="mci-label">{t("archiv_filter_user")}</label>
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
        </aside>

        <main className="res-list">
          {filteredBookings.map((b) => {
            const room = rooms.find((r) => r.id === b.room_id);
            const { hh, mm } = getEndTimeParts(b.start_time, b.duration);
            const series = bookings
              .filter(
                (bk) =>
                  bk.booking_code === b.booking_code &&
                  bk.status !== BOOKING_STATUS.CANCELLED,
              )
              .sort((a, b) => a.booking_date.localeCompare(b.booking_date));
            const now = new Date();
            const todayStr = now.toISOString().split("T")[0];
            const currentMin = now.getHours() * 60 + now.getMinutes();
            const startMin = timeToMinutes(b.start_time);
            const isCancelled = b.status === BOOKING_STATUS.CANCELLED;
            const isReleased =
              b.status === BOOKING_STATUS.RELEASED ||
              (b.booking_date === todayStr &&
                !b.is_checked_in &&
                currentMin >= startMin + APP_CONFIG.AUTO_RELEASE_MINUTES);
            const isPast =
              b.booking_date < todayStr ||
              (b.booking_date === todayStr &&
                startMin + b.duration * 60 <= currentMin);
            const canCheckIn = isCheckInAvailable(b);

            return (
              <div
                key={b.id}
                className={`res-card ${isCancelled || isPast || isReleased ? "opacity-60" : ""}`}
              >
                <div className="res-image-wrapper">
                  {room?.image_url ? (
                    <img
                      src={room.image_url}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl bg-slate-100">
                      🏢
                    </div>
                  )}
                </div>
                <div className="res-content-block text-left">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="res-room-title !text-3xl m-0">
                      {room?.name}
                    </h3>
                    {series.length > 1 && (
                      <span className="mci-badge text-[var(--mci-blue)] border-blue-100">
                        <Repeat
                          size={12}
                          className="text-[var(--mci-orange)]"
                        />{" "}
                        {t("label_series")}{" "}
                        {series.findIndex((bk) => bk.id === b.id) + 1}/
                        {series.length}
                      </span>
                    )}
                  </div>
                  <p className="mci-sub-label mb-6">
                    {room?.building?.name} • {room?.floor}.{" "}
                    {t("label_floor_short")}
                  </p>
                  <div className="mci-grid-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-[var(--mci-orange)]">
                        <Calendar size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="mci-sub-label !text-[8px]">
                          {t("header_date")}
                        </span>
                        <span className="font-bold text-sm">
                          {b.booking_date}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-[var(--mci-orange)]">
                        <Clock size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="mci-sub-label !text-[8px]">
                          {t("modal_time")}
                        </span>
                        <span className="font-bold text-sm">
                          {b.start_time} - {hh}:{mm}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                        <Users size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="mci-sub-label !text-[8px]">
                          {t("admin_label_capacity")}
                        </span>
                        <span className="font-bold text-sm">
                          {room?.capacity}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                        <Armchair size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="mci-sub-label !text-[8px]">
                          {t("admin_label_seating")}
                        </span>
                        <span className="font-bold text-sm truncate">
                          {t(room?.seating_arrangement)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-50 flex items-center gap-3 w-full">
                    <Layers size={16} className="text-slate-300" />
                    <div className="flex flex-wrap gap-2">
                      {room?.equipment?.map((eqId: string) => (
                        <span
                          key={eqId}
                          className="bg-slate-100 text-[9px] px-2 py-1 rounded-lg font-black uppercase text-slate-500 border border-slate-200/50 flex items-center gap-1.5"
                        >
                          {getEquipmentIcon(eqId)} {t("equip_" + eqId)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="res-action-bar">
                  {isCancelled ? (
                    <div className="res-status-indicator bg-red-50 text-red-300 border-red-100/50">
                      <XCircle size={14} /> {t("archiv_opt_cancelled")}
                    </div>
                  ) : isReleased ? (
                    <div className="res-status-indicator bg-orange-50 text-orange-400 border-orange-100/50">
                      <AlertCircle size={14} /> {t("archiv_status_released")}
                    </div>
                  ) : isPast ? (
                    <div className="res-status-indicator bg-slate-50 text-slate-300 border-slate-100">
                      <CheckCircle2 size={14} /> {t("archiv_opt_finished")}
                    </div>
                  ) : (
                    <div className="w-full flex flex-col gap-3">
                      {b.is_checked_in ? (
                        <div className="res-status-indicator bg-green-50 text-green-400 border-green-100/50">
                          <CheckCircle size={16} /> {t("label_checked_in")}
                        </div>
                      ) : canCheckIn ? (
                        <button
                          onClick={() => handleSecureCheckIn(b)}
                          className="mci-action-btn-unified !bg-green-600 hover:!bg-green-700 text-white shadow-lg"
                        >
                          <Wifi size={16} />
                          <span>{t("btn_checkin")}</span>
                        </button>
                      ) : (
                        <div className="res-status-indicator bg-slate-50 text-slate-300 border-slate-100">
                          <Clock size={14} /> {t("label_waiting")}
                        </div>
                      )}
                      <button
                        onClick={() => handleEdit(b)}
                        className="mci-action-btn-unified !bg-[#f7941d] text-white shadow-lg"
                      >
                        <Edit3 size={16} />{" "}
                        <span>{t("label_edit_booking")}</span>
                      </button>
                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleCancelSingle(b.id)}
                          className="mci-action-btn-unified !bg-slate-100 !text-red-500 border border-red-100"
                        >
                          <Trash2 size={14} />
                          <span>{t("btn_cancel_single")}</span>
                        </button>
                        {series.length > 1 && (
                          <button
                            onClick={() => handleCancelSeries(b.booking_code)}
                            className="mci-action-btn-unified !bg-red-50 !text-red-600 border border-red-200"
                          >
                            <Trash2 size={14} />
                            <span>{t("btn_cancel_series")}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </main>
      </div>

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
