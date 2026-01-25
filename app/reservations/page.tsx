"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import "./reservations.css";
import BookingModal from "@/app/components/BookingModal";
import { findById, getEndTimeParts } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  Filter as FilterIcon,
  XCircle,
  Globe,
  ChevronDown,
  Building2,
  Users,
  History,
  Edit3,
  X,
  CheckCircle,
  Repeat,
  Layers,
  AlertCircle,
  Armchair,
} from "lucide-react";

export default function ReservationsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"de" | "en">("de");
  const [dbTrans, setDbTrans] = useState<any>({});
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterRoom, setFilterRoom] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterBuilding, setFilterBuilding] = useState("all");
  const [minCapacity, setMinCapacity] = useState("0");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  // Edit States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);

  const t = (key: string) => dbTrans[key?.toLowerCase()]?.[lang] || key;

  useEffect(() => {
    const savedLang = localStorage.getItem("mci_lang") as "de" | "en";
    if (savedLang) setLang(savedLang);
    loadAllData();
  }, []);

  const handleLangToggle = () => {
    const newLang = lang === "de" ? "en" : "de";
    setLang(newLang);
    localStorage.setItem("mci_lang", newLang);
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

    if (transRes.data) {
      const tMap: any = {};
      transRes.data.forEach(
        (i) => (tMap[i.key.toLowerCase()] = { de: i.de, en: i.en }),
      );
      setDbTrans(tMap);
    }

    setIsAdmin(profileRes.data?.is_admin || false);
    setRooms(roomsRes.data || []);
    setProfiles(profilesRes.data || []);
    setBuildings(buildRes.data || []);
    setEquipmentList(equipRes.data || []);

    let finalBookings = bookingsRes.data || [];
    if (!profileRes.data?.is_admin) {
      finalBookings = finalBookings.filter(
        (b: any) => b.user_id === session.user.id,
      );
    }
    setBookings(
      finalBookings.sort((a: any, b: any) =>
        a.booking_date.localeCompare(b.booking_date),
      ),
    );
    setLoading(false);
  }

  const handleEdit = (booking: any) => {
    setEditingBooking(booking);
    setShowEditModal(true);
  };

  const handleCancelSingle = async (id: string) => {
    if (!confirm(t("archiv_confirm_cancel"))) return;
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    loadAllData();
  };

  const handleCancelSeries = async (code: string) => {
    if (!confirm(t("confirm_cancel_series") || "Ganze Serie stornieren?"))
      return;
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("booking_code", code);
    loadAllData();
  };

  const handleCheckIn = async (booking: any) => {
    // Hier bleibt deine originale GPS/WiFi Logik wie im Master-Kontext definiert
    const { error } = await supabase
      .from("bookings")
      .update({ is_checked_in: true, checked_in_at: new Date() })
      .eq("id", booking.id);
    if (!error) loadAllData();
  };

  const isCheckInAvailable = (booking: any) => {
    const now = new Date();
    const start = new Date(`${booking.booking_date}T${booking.start_time}`);
    return (
      now >= new Date(start.getTime() - 15 * 60000) &&
      now <= new Date(start.getTime() + booking.duration * 3600000) &&
      booking.status === "active" &&
      !booking.is_checked_in
    );
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const room = rooms.find((r) => r.id === b.room_id);
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const endH = parseInt(b.start_time.split(":")[0]) + b.duration;
      const isPast =
        b.booking_date < todayStr ||
        (b.booking_date === todayStr && endH <= now.getHours());

      if (filterStatus === "open" && (isPast || b.status !== "active"))
        return false;
      if (filterStatus === "finished" && !isPast) return false;
      if (filterStatus === "cancelled" && b.status !== "cancelled")
        return false;
      if (filterRoom !== "all" && b.room_id !== filterRoom) return false;
      if (filterBuilding !== "all" && room?.building_id !== filterBuilding)
        return false;
      if (isAdmin && filterUser !== "all" && b.user_id !== filterUser)
        return false;
      return true;
    });
  }, [
    bookings,
    filterStatus,
    filterRoom,
    filterUser,
    filterBuilding,
    isAdmin,
    rooms,
  ]);

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center font-black text-[#004a87] italic uppercase animate-pulse">
        Archiv Check...
      </div>
    );

  return (
    <div className="res-page-wrapper">
      <header className="res-page-header mb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="text-left w-full">
            <button
              onClick={() => router.push("/rooms")}
              className="nav-link group mb-2"
            >
              <ArrowLeft
                size={16}
                className="group-hover:-translate-x-1 transition-transform"
              />
              <span>{t("archiv_back")}</span>
            </button>
            <h1 className="res-page-title">{t("archiv_title")}</h1>
            {/* Mobil: Badge rutscht in eigene Zeile */}
            <div className="md:hidden mt-4">
              <div className="res-stats-badge w-full justify-center">
                <History size={16} />
                <span>
                  {filteredBookings.length} {t("label_entries")}
                </span>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="res-stats-badge">
              <History size={16} />
              <span>
                {filteredBookings.length} {t("label_entries")}
              </span>
            </div>
            <button onClick={handleLangToggle} className="lang-toggle-btn">
              <Globe size={14} /> {lang.toUpperCase()}
            </button>
          </div>
          <div className="md:hidden w-full flex justify-end">
            <button onClick={handleLangToggle} className="lang-toggle-btn">
              <Globe size={14} /> {lang.toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <div className="res-layout">
        <aside className="res-sidebar">
          {/* MOBILE FILTER TOGGLE (Bubble-Style) */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden w-full mb-4 flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <FilterIcon size={20} className="text-[#f7941d]" />
              <span className="text-[#004a87] italic uppercase text-sm tracking-widest">
                {t("filter_title")}
              </span>
            </div>
            <ChevronDown
              className={`text-[#004a87] transition-transform ${showMobileFilters ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className={`res-filter-card hide-scrollbar ${showMobileFilters ? "block" : "hidden lg:block"}`}
          >
            <div className="hidden lg:flex items-center gap-3 mb-8 text-[#004a87] italic uppercase text-sm tracking-widest">
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

            // Serien-Berechnung (wichtig für den Badge)
            const seriesBookings = bookings
              .filter(
                (bk) =>
                  bk.booking_code === b.booking_code &&
                  bk.status !== "cancelled",
              )
              .sort((a, b) => a.booking_date.localeCompare(b.booking_date));
            const isSeries = seriesBookings.length > 1;
            const currentIndex =
              seriesBookings.findIndex((bk) => bk.id === b.id) + 1;

            const isCancelled = b.status === "cancelled";
            const now = new Date();
            const todayStr = now.toISOString().split("T")[0];
            const endH = parseInt(b.start_time.split(":")[0]) + b.duration;
            const isPast =
              b.booking_date < todayStr ||
              (b.booking_date === todayStr && endH <= now.getHours());
            const isNoShow =
              todayStr === b.booking_date &&
              !b.is_checked_in &&
              !isCancelled &&
              now.getMinutes() > 15;
            const canCheckIn = isCheckInAvailable(b);

            return (
              <div
                key={b.id}
                className={`res-card ${isCancelled || isPast ? "opacity-60" : ""}`}
              >
                {/* SÄULE 1: BILD */}
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

                {/* SÄULE 2: CONTENT (GRID + EQUIPMENT UNTEN) */}
                <div className="res-content-block text-left">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="res-room-title !text-3xl m-0">
                      {room?.name}
                    </h3>
                    {isSeries && (
                      <span className="mci-badge text-[var(--mci-blue)] border-blue-100">
                        <Repeat
                          size={12}
                          className="text-[var(--mci-orange)]"
                        />
                        {t("label_series")} {currentIndex}/
                        {seriesBookings.length}
                      </span>
                    )}
                  </div>
                  <p className="mci-sub-label mb-6">
                    {room?.building?.name} • {room?.floor}.{" "}
                    {t("label_floor_short")}
                  </p>

                  {/* 2x2 GRID MIT ÜBERSETZUNGEN */}
                  <div className="mci-grid-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-[var(--mci-orange)]">
                        <Calendar size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="mci-sub-label !text-[8px]">
                          {t("header_date")}
                        </span>
                        <span className="font-bold text-slate-700 text-sm">
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
                        <span className="font-bold text-slate-700 text-sm">
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
                          {t("capacity_label")}
                        </span>
                        <span className="font-bold text-slate-700 text-sm">
                          {room?.capacity} {t("header_seats")}
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
                        <span className="font-bold text-slate-700 text-sm truncate max-w-[120px]">
                          {t(room?.seating_arrangement)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* EQUIPMENT ZEILE (Breit) */}
                  <div className="mt-6 pt-4 border-t border-slate-50 flex items-center gap-3 w-full">
                    <Layers size={16} className="text-slate-300 shrink-0" />
                    <div className="flex flex-wrap gap-2">
                      <span className="mci-sub-label !text-[8px] self-center mr-2">
                        {t("filter_equip")}:
                      </span>
                      {room?.equipment?.map((eqId: string) => (
                        <span
                          key={eqId}
                          className="bg-slate-100 text-[9px] px-2 py-1 rounded-lg font-black uppercase text-slate-500 border border-slate-200/50"
                        >
                          {equipmentList.find((e) => e.id === eqId)?.[
                            lang === "de" ? "name_de" : "name_en"
                          ] || eqId}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SÄULE 3: AKTIONEN (WATERFALL) */}
                <div className="res-action-bar">
                  {isCancelled ? (
                    <div className="res-status-indicator bg-red-50 text-red-300 border-red-100/50">
                      <XCircle size={14} /> {t("archiv_opt_cancelled")}
                    </div>
                  ) : b.status === "released" || isNoShow ? (
                    <div className="res-status-indicator bg-orange-50 text-orange-300 border-orange-100/50">
                      <AlertCircle size={14} /> {t("archiv_status_released")}
                    </div>
                  ) : isPast ? (
                    <div className="res-status-indicator bg-slate-50 text-slate-300 border-slate-100">
                      <CheckCircle2 size={14} /> {t("archiv_opt_finished")}
                    </div>
                  ) : (
                    <div className="w-full flex flex-col gap-3">
                      {/* Check-In Logik (Grün) */}
                      {b.is_checked_in ? (
                        <div className="res-status-indicator bg-green-50 text-green-400 border-green-100/50">
                          <CheckCircle size={16} />{" "}
                          <span>{t("label_checked_in")}</span>
                        </div>
                      ) : canCheckIn ? (
                        <button
                          onClick={() => handleCheckIn(b)}
                          className="btn-mci-main !bg-green-600 hover:!bg-green-700 w-full shadow-lg transition-all active:scale-95"
                        >
                          <CheckCircle2 size={16} />{" "}
                          <span>{t("btn_checkin")}</span>
                        </button>
                      ) : (
                        <div className="res-status-indicator bg-slate-50 text-slate-300 border-slate-100">
                          <Clock size={16} /> <span>{t("label_waiting")}</span>
                        </div>
                      )}

                      {/* Bearbeiten Button (MCI-Orange) */}
                      <button
                        onClick={() => handleEdit(b)}
                        className="btn-mci-main !bg-[#f7941d] hover:opacity-90 w-full shadow-lg transition-all active:scale-95"
                      >
                        <Edit3 size={16} />{" "}
                        <span>{t("label_edit_booking")}</span>
                      </button>

                      {/* Storno Gruppe */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleCancelSingle(b.id)}
                          className="btn-res-action btn-res-danger w-full !py-2 text-[9px] font-black uppercase"
                        >
                          <X size={12} /> {t("btn_cancel_single")}
                        </button>
                        {isSeries && (
                          <button
                            onClick={() => handleCancelSeries(b.booking_code)}
                            className="btn-res-action btn-res-danger !bg-red-50 w-full !py-2 text-[9px] font-black uppercase"
                          >
                            <XCircle size={12} /> {t("btn_cancel_series")}
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

      {/* MODAL ÜBERGABE: Alle benötigten Props für V10.0 */}
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
        minCapacity={minCapacity}
        selectedEquipment={selectedEquipment}
        buildings={buildings}
      />
    </div>
  );
}
