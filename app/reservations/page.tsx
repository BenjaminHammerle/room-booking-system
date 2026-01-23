"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import "./reservations.css";
import BookingModal from "@/app/components/BookingModal";
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
      <div className="max-w-7xl mx-auto mb-12 flex justify-between items-end">
        <div className="space-y-2">
          <button
            onClick={() => router.push("/rooms")}
            className="flex items-center gap-2 text-gray-400 font-bold hover:text-[#004a87] transition mb-4"
          >
            <ArrowLeft size={18} /> {t("archiv_back")}
          </button>
          <h1 className="text-6xl font-black text-[#004a87] tracking-tighter uppercase italic">
            {t("archiv_title")}
          </h1>
        </div>
        <div className="flex items-center gap-4 mb-2">
          <div className="bg-[#004a87] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg flex items-center gap-3">
            <History size={18} /> {filteredBookings.length} {t("label_entries")}
          </div>
          <button
            onClick={() => setLang(lang === "de" ? "en" : "de")}
            className="p-3 bg-white rounded-xl shadow-sm font-bold text-xs uppercase"
          >
            {lang}
          </button>
        </div>
      </div>

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
            const room = rooms.find((r) => r.id === b.room_id);
            const owner = profiles.find((p) => p.id === b.user_id);

            // Prüfen, wie viele Termine diesen Code haben
            const seriesCount = bookings.filter(
              (bk) => bk.booking_code === b.booking_code,
            ).length;
            const isSeries = seriesCount > 1;

            const isActive = b.status === "active";
            const checkInWindow = isCheckInAvailable(b);

            return (
              <div
                key={b.id}
                className={`res-card group ${isActive ? "res-card-active" : "res-card-expired"}`}
              >
                <div className="flex items-center gap-8 text-left flex-1">
                  <div className="res-icon-box">
                    {room?.image_url ? (
                      <img
                        src={room.image_url}
                        alt={room.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      room?.image || "🏢"
                    )}
                  </div>
                  <div className="res-info-main">
                    <div className="res-room-name flex items-center gap-3">
                      {room?.name}
                      {isSeries && (
                        <span
                          className="badge-series-indicator"
                          title="Teil einer Kursreihe"
                        >
                          <Repeat size={12} className="text-[#f7941d]" />
                          Serie ({seriesCount})
                        </span>
                      )}
                    </div>
                    <div className="res-meta-row">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-[#f7941d]" />{" "}
                        {b.booking_date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-[#f7941d]" />{" "}
                        {b.start_time} -{" "}
                        {minutesToTime(
                          timeToMinutes(b.start_time) + b.duration * 60,
                        )}
                      </span>
                      {isAdmin && (
                        <span className="text-[#004a87] font-black border-l pl-4 flex items-center gap-2">
                          <UserIcon size={14} /> {owner?.first_name}{" "}
                          {owner?.last_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="res-actions">
                  {isActive && !b.is_checked_in && (
                    <button
                      onClick={() => {
                        setEditingBooking(b);
                        setEditTime(b.start_time);
                        setEditDuration(b.duration);
                        setShowEditModal(true);
                      }}
                      className="p-4 text-blue-400 hover:text-[#004a87] transition-all hover:scale-110"
                    >
                      <Edit3 size={24} />
                    </button>
                  )}
                  {checkInWindow && (
                    <button
                      onClick={() => handleCheckIn(b)}
                      className="btn-res-action btn-res-checkin animate-pulse"
                    >
                      <CheckCircle2 size={16} /> {t("checkin_btn")}
                    </button>
                  )}
                  {!b.is_checked_in && isActive && (
                    <button
                      onClick={() => handleCancel(b.id)}
                      className="btn-res-cancel"
                    >
                      <XCircle size={28} />
                    </button>
                  )}
                  {b.is_checked_in && (
                    <div className="res-status-badge bg-green-50 text-green-700 border-green-200 font-black italic">
                      {t("archiv_status_checkin")}
                    </div>
                  )}
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
