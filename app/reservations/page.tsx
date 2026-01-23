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
  User as UserIcon,
  XCircle,
  Globe,
  ChevronDown,
  PlusCircle,
  AlertCircle,
  Building2,
  Users,
  History,
  Edit3,
  X,
  Save,
  CheckCircle,
  Repeat,
} from "lucide-react";

export default function ReservationsPage() {
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
  const [dbTrans, setDbTrans] = useState<any>({});
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [minCapacity, setMinCapacity] = useState("0");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterRoom, setFilterRoom] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterBuilding, setFilterBuilding] = useState("all");

  // Edit States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState(1);

  // Diese Funktion verbindet den Button mit dem Modal
  const handleEdit = (booking: any) => {
    setEditingBooking(booking); // Speichert die Buchung, die wir bearbeiten wollen
    setShowEditModal(true); // Öffnet das Modal
  };

  const t = (key: string) => dbTrans[key?.toLowerCase()]?.[lang] || key;

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

  const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const getUserIP = async () => {
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      return data.ip;
    } catch (e) {
      return null;
    }
  };

  const getEndTimeParts = (startTime: string, duration: number) => {
    const totalMinutes = timeToMinutes(startTime) + duration * 60;
    return {
      hh: Math.floor(totalMinutes / 60)
        .toString()
        .padStart(2, "0"),
      mm: (totalMinutes % 60).toString().padStart(2, "0"),
    };
  };

  const handleCancelSingle = async (id: string) => {
    if (!confirm("Möchtest du diesen einzelnen Termin wirklich stornieren?"))
      return;
    setLoading(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (!error) loadAllData();
    setLoading(false);
  };

  const handleCancelSeries = async (code: string) => {
    if (
      !confirm(
        "Möchtest du die gesamte Serie (alle zukünftigen Termine) stornieren?",
      )
    )
      return;
    setLoading(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("booking_code", code);
    if (!error) loadAllData();
    setLoading(false);
  };

  // --- DATA LOADING ---
  useEffect(() => {
    loadAllData();
  }, []);

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

    const [transRes, profileRes, roomsRes, profilesRes, bookingsRes, buildRes] =
      await Promise.all([
        supabase.from("translations").select("*"),
        supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single(),
        supabase
          .from("rooms")
          .select(
            `*, building:buildings!rooms_building_id_fkey (*), room_combi:rooms_combi!rooms_room_combi_id_fkey (*)`,
          ),
        supabase.from("profiles").select("*").order("last_name"),
        supabase.from("bookings").select("*"),
        supabase.from("buildings").select("*"),
      ]);

    if (transRes.data) {
      const tMap: any = {};
      transRes.data.forEach(
        (i: any) => (tMap[i.key.toLowerCase()] = { de: i.de, en: i.en }),
      );
      setDbTrans(tMap);
    }

    setIsAdmin(profileRes.data?.is_admin || false);
    setRooms(roomsRes.data || []);
    setProfiles(profilesRes.data || []);
    setBuildings(buildRes.data || []);

    let finalBookings = bookingsRes.data || [];
    if (!profileRes.data?.is_admin) {
      finalBookings = finalBookings.filter(
        (b: any) => b.user_id === session.user.id,
      );
    }

    setBookings(
      finalBookings.sort((a: any, b: any) => {
        const dateComp = a.booking_date.localeCompare(b.booking_date);
        if (dateComp !== 0) return dateComp;
        return a.start_time.localeCompare(b.start_time);
      }),
    );

    setLoading(false);
  }

  // --- CHECK-IN LOGIK ---
  const handleCheckIn = async (booking: any) => {
    setLoading(true);
    console.log("--- Check-In Prozess gestartet ---");

    const room = rooms.find((r) => r.id === booking.room_id);
    const building = buildings.find((b) => b.id === room?.building_id);
    const dbPrefix = building?.mci_wifi_ip;
    let locationVerified = false;

    // 1. ENTWICKLER-HINTERTÜR (Localhost)
    if (window.location.hostname === "localhost") {
      console.log(
        "DEBUG: Localhost erkannt - Standort-Prüfung wird übersprungen.",
      );
      const { error } = await supabase
        .from("bookings")
        .update({ is_checked_in: true, checked_in_at: new Date() })
        .eq("id", booking.id);

      if (!error) {
        alert("DEBUG: Localhost Check-In erfolgreich!");
        loadAllData();
      }
      setLoading(false);
      return; // Prozess hier beenden
    }

    console.log(
      "Prüfe Gebäude:",
      building?.name,
      "Erlaubte Prefixe:",
      dbPrefix,
    );

    // --- VERSUCH 1: GPS ---
    try {
      const pos: any = await new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 });
      });

      if (building?.latitude && building?.longitude) {
        const dist = getDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          building.latitude,
          building.longitude,
        );
        console.log("GPS Distanz zum Gebäude:", Math.round(dist), "Meter");
        if (dist <= 250) locationVerified = true;
      }
    } catch (err) {
      console.warn("GPS Check fehlgeschlagen oder verweigert.");
    }

    // --- VERSUCH 2: NETZWERK ---
    if (!locationVerified && dbPrefix) {
      const userIP = await getUserIP();
      console.log("Deine erkannte öffentliche IP:", userIP);

      if (userIP) {
        const validPrefixes = dbPrefix.split(",").map((p: string) => p.trim());
        locationVerified = validPrefixes.some((p: string) =>
          userIP.startsWith(p),
        );
        console.log("IP-Match Ergebnis:", locationVerified);
      }
    }

    // --- FINALE AUSWERTUNG ---
    if (locationVerified) {
      const { error } = await supabase
        .from("bookings")
        .update({ is_checked_in: true, checked_in_at: new Date() })
        .eq("id", booking.id);

      if (!error) {
        alert(t("checkin_ok") || "Erfolgreich eingecheckt!");
        loadAllData();
      }
    } else {
      alert(
        "Check-In verweigert: Weder GPS noch MCI-Netzwerk konnten deinen Standort bestätigen.",
      );
    }
    setLoading(false);
  };

  // --- EDIT LOGIC ---
  const isConflict = useMemo(() => {
    if (!editingBooking) return false;
    const startMin = timeToMinutes(editTime);
    const endMin = startMin + editDuration * 60;
    return bookings.some((b) => {
      if (
        b.id === editingBooking.id ||
        b.room_id !== editingBooking.room_id ||
        b.booking_date !== editingBooking.booking_date ||
        b.status !== "active"
      )
        return false;
      const bStart = timeToMinutes(b.start_time);
      const bEnd = bStart + b.duration * 60;
      return startMin < bEnd && bStart < endMin;
    });
  }, [editTime, editDuration, editingBooking, bookings]);

  const handleUpdateBooking = async () => {
    if (isConflict) return;
    const { error } = await supabase
      .from("bookings")
      .update({ start_time: editTime, duration: editDuration })
      .eq("id", editingBooking.id);
    if (!error) {
      setShowEditModal(false);
      loadAllData();
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm(t("archiv_confirm_cancel"))) return;
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    loadAllData();
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

  // --- FILTER LOGIC ---
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const endH = parseInt(b.start_time.split(":")[0]) + b.duration;
      const isFinished =
        b.booking_date < todayStr ||
        (b.booking_date === todayStr && endH <= now.getHours());
      const room = rooms.find((r) => r.id === b.room_id);

      if (filterStatus === "open" && (isFinished || b.status !== "active"))
        return false;
      if (filterStatus === "finished" && !isFinished) return false;
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
        MCI Archiv Check...
      </div>
    );

  return (
    <div className="res-page-wrapper">
      <header className="res-page-header mb-8 md:mb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2 w-full md:w-auto">
            <button
              onClick={() => router.push("/rooms")}
              className="nav-link group"
            >
              <ArrowLeft
                size={18}
                className="group-hover:-translate-x-1 transition-transform"
              />
              <span>{t("archiv_back")}</span>
            </button>
            <h1 className="res-page-title">{t("archiv_title")}</h1>
          </div>

          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <div className="res-stats-badge">
              <History size={18} className="text-[var(--mci-orange)]" />
              <span>
                {filteredBookings.length} {t("label_entries")}
              </span>
            </div>
            <button
              onClick={handleLangToggle}
              className="lang-toggle-btn"
            >
              <Globe size={14} /> {lang}
            </button>
          </div>
        </div>
      </header>

      <div className="res-layout">
        <aside className="res-sidebar">
          <div className="res-filter-card">
            <div className="filter-title-row">
              <FilterIcon size={20} className="text-[#f7941d]" />{" "}
              {t("filter_title")}
            </div>

            {/* STATUS FILTER */}
            <div className="mci-field-group">
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

            {/* GEBÄUDE FILTER */}
            <div className="mci-field-group">
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

            {/* RAUM FILTER */}
            <div className="mci-field-group">
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

            {/* USER FILTER (Nur Admin) */}
            {isAdmin && (
              <div className="mci-field-group animate-in slide-in-from-top-2">
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
        </aside>

        <main className="res-list">
          <div className="res-sort-info">
            <Clock size={12} /> {t("label_sorted_by_nearest")}
          </div>
          {filteredBookings.map((b) => {
            const room = findById(rooms, b.room_id);
            const activeSeriesDates = bookings
              .filter(
                (bk) =>
                  bk.booking_code === b.booking_code &&
                  bk.status !== "cancelled",
              )
              .sort((a, b) => a.booking_date.localeCompare(b.booking_date));
            const seriesCount = activeSeriesDates.length;
            const isSeries = seriesCount > 1;
            const currentIndex =
              activeSeriesDates.findIndex((bk) => bk.id === b.id) + 1;
            const { hh, mm } = getEndTimeParts(b.start_time, b.duration);
            const canCheckIn =
              typeof isCheckInAvailable === "function"
                ? isCheckInAvailable(b)
                : false;

            return (
              <div
                key={b.id}
                className={`res-card ${isSeries ? "is-series" : ""}`}
              >
                {/* SÄULE 1: BILD (Links) */}
                <div className="res-image-wrapper">
                  {room?.image_url ? (
                    <img
                      src={room.image_url}
                      className="w-full h-full object-cover"
                      alt={room.name}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl bg-slate-100">
                      🏢
                    </div>
                  )}
                </div>

                {/* SÄULE 2: CONTENT (Mitte - Füllt den gesamten Raum aus) */}
                <div className="res-content-block">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="res-room-title">{room?.name}</h3>
                    {isSeries && currentIndex > 0 && (
                      <span className="badge-series-indicator">
                        <Repeat
                          size={12}
                          className="text-[var(--mci-orange)]"
                        />
                        {t("label_series")} ({currentIndex}/{seriesCount})
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 font-bold text-xs uppercase italic tracking-tight mb-8">
                    {room?.building?.name} • {room?.floor}.{" "}
                    {t("label_floor_short")}
                  </p>

                  {/* Die Infos in der Mitte - sauber verteilt */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-y-4 gap-x-8">
                    <div className="res-meta-item">
                      <Calendar
                        size={16}
                        className="text-[var(--mci-orange)]"
                      />
                      <span>
                        {new Date(b.booking_date).toLocaleDateString(
                          lang === "de" ? "de-DE" : "en-US",
                          { weekday: "long", day: "2-digit", month: "long" },
                        )}
                      </span>
                    </div>
                    <div className="res-meta-item">
                      <Clock size={16} className="text-[var(--mci-orange)]" />
                      <span>
                        {b.start_time} - {hh}:{mm} {t("label_uhr")}
                      </span>
                    </div>
                    <div className="res-meta-item">
                      <Users size={16} className="text-slate-300" />
                      <span>
                        {room?.capacity} {t("label_seats")}
                      </span>
                    </div>
                    <div className="res-meta-item">
                      <History size={16} className="text-slate-300" />
                      <span className="tracking-tighter font-black opacity-40">
                        {b.booking_code}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SÄULE 3: AKTIONEN (Rechts) */}
                <div className="res-action-bar">
                  {/* OBERER TEIL: STATUS & DETAILS */}
                  <div className="w-full space-y-3">
                    {b.is_checked_in ? (
                      <div className="res-status-indicator res-status-checked">
                        <CheckCircle size={16} />{" "}
                        <span>{t("label_checked_in")}</span>
                      </div>
                    ) : canCheckIn ? (
                      <button
                        onClick={() => handleCheckIn(b)}
                        className="btn-mci-main"
                      >
                        <CheckCircle2 size={16} />{" "}
                        <span>{t("btn_checkin")}</span>
                      </button>
                    ) : (
                      <div className="res-status-indicator res-status-waiting">
                        <Clock size={16} /> <span>{t("label_waiting")}</span>
                      </div>
                    )}

                    <button
                      onClick={() => handleEdit(b)}
                      className="btn-res-edit"
                    >
                      <Edit3 size={14} /> <span>{t("label_edit_booking")}</span>
                    </button>
                  </div>

                  {/* UNTERER TEIL: STORNO GRUPPE */}
                  <div className="res-cancel-group">
                    <button
                      onClick={() => handleCancelSingle(b.id)}
                      className="btn-res-action btn-res-danger"
                    >
                      <X size={14} /> <span>{t("btn_cancel_single")}</span>
                    </button>
                    {isSeries && (
                      <button
                        onClick={() => handleCancelSeries(b.booking_code)}
                        className="btn-res-action btn-res-danger bg-red-100/30"
                      >
                        <XCircle size={14} />{" "}
                        <span>{t("btn_cancel_series")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </main>
      </div>

      {/* --- EDIT MODAL (Identisch zu Room Seite) --- */}

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
        equipmentList={[]} // Oder laden falls nötig
        lang={lang}
        t={t}
        onSuccess={loadAllData}
        userId={user.id}
        userEmail={user.email}
        minCapacity={minCapacity}
        selectedEquipment={selectedEquipment}
        buildings={buildings}
      />
    </div>
  );
}
