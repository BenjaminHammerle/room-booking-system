"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { updateUserAdmin, createNewUserAdmin } from "./actions";
import "./admin.css";

// integration der zentralen lib-architektur für einheitliche daten und helfer
import {
  APP_CONFIG,
  BOOKING_STATUS,
  SUPPORTED_LANGS,
  Language,
  SEATING_OPTIONS,
} from "@/lib/constants";
import { getEquipmentIcon } from "@/lib/icons";
import { timeToMinutes, getTrans } from "@/lib/utils";

// alle icons einzeln importiert
import {
  Users,
  Calendar,
  BarChart3,
  X,
  ArrowLeft,
  Power,
  Plus,
  Edit3,
  UserPlus,
  Home,
  Layers,
  PlusCircle,
  Globe,
  Search,
  Monitor,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  Printer,
  Accessibility,
  Repeat,
  Info,
  ShieldCheck,
  Trash2,
  MapPin,
  Clock,
  Save,
} from "lucide-react";

// hauptkomponente für die administratoren-konsole
export default function AdminPage() {
  const router = useRouter();

  // zustandsverwaltung für navigation und sprache
  const [activeTab, setActiveTab] = useState("planning");
  const [lang, setLang] = useState<Language>(APP_CONFIG.DEFAULT_LANG);
  const [dbTrans, setDbTrans] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // daten-zustände für alle verwalteten entitäten
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);

  // modal-zustände für die verwaltung von objekten
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showUserEditModal, setShowUserEditModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // zustände für selektierte objekte
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [currentBuilding, setCurrentBuilding] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    is_admin: false,
  });

  // spezial-zustände für die kombiraum-konfiguration
  const [isCombi, setIsCombi] = useState(false);
  const [combiParts, setCombiParts] = useState<string[]>([]);

  // ui-steuerung für interaktive elemente
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [planningSearch, setPlanningSearch] = useState("");
  const [viewMode, setViewMode] = useState<"day" | "14days">("day");
  const [selectedRoomForCalendar, setSelectedRoomForCalendar] =
    useState<string>("");

  // übersetzungs-helper für dynamische inhalte
  const t = (key: string) => dbTrans[key?.toLowerCase()]?.[lang] || key;

  // initialisierung: sprache laden und daten-fetch auslösen
  useEffect(() => {
    const savedLang = localStorage.getItem("mci_lang") as Language;
    if (SUPPORTED_LANGS.includes(savedLang)) setLang(savedLang);
    loadAdminData();
  }, []);

  const handleLangToggle = () => {
    const currentIndex = SUPPORTED_LANGS.indexOf(lang);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LANGS.length;
    const nextLang = SUPPORTED_LANGS[nextIndex];
    setLang(nextLang);
    localStorage.setItem("mci_lang", nextLang);
  };

  // zentrales laden aller administrativen tabellen aus supabase inkl. SICHERHEITSCHECK
  async function loadAdminData() {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const [transRes, profRes, roomRes, buildRes, bookRes, equipRes] =
      await Promise.all([
        supabase.from("translations").select("*"),
        supabase.from("profiles").select("*").order("last_name"),
        supabase.from("rooms").select("*").order("name"),
        supabase.from("buildings").select("*").order("name"),
        supabase.from("bookings").select("*"),
        supabase.from("equipment").select("*"),
      ]);

    // SICHERHEITS-CHECK: Ist der Nutzer Admin?
    const currentUserProfile = profRes.data?.find(
      (p) => p.id === session.user.id,
    );
    if (!currentUserProfile || !currentUserProfile.is_admin) {
      router.push("/rooms");
      return;
    }

    if (transRes.data) {
      const tMap: any = {};
      transRes.data.forEach((i) => (tMap[i.key.toLowerCase()] = i));
      setDbTrans(tMap);
    }
    setProfiles(profRes.data || []);
    setRooms(roomRes.data || []);
    setBuildings(buildRes.data || []);
    setBookings(bookRes.data || []);
    setEquipmentList(equipRes.data || []);
    setLoading(false);
  }

  // berechnung der statistischen kennzahlen
  const stats = useMemo(() => {
    const activeB = bookings.filter((b) => b.status === BOOKING_STATUS.ACTIVE);
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];

    const topLifetime = rooms
      .map((r) => ({
        name: r.name,
        count: bookings.filter(
          (b) => b.room_id === r.id && b.status !== BOOKING_STATUS.CANCELLED,
        ).length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topLastWeek = rooms
      .map((r) => ({
        name: r.name,
        count: bookings.filter(
          (b) =>
            b.room_id === r.id &&
            b.status !== BOOKING_STATUS.CANCELLED &&
            b.booking_date >= oneWeekAgoStr,
        ).length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalDur = activeB.reduce((sum, b) => sum + (b.duration || 0), 0);
    return {
      topLifetime,
      topLastWeek,
      checkInRate:
        bookings.length > 0
          ? Math.round(
              (bookings.filter((b) => b.is_checked_in).length /
                bookings.length) *
                100,
            )
          : 0,
      avgDuration:
        activeB.length > 0 ? (totalDur / activeB.length).toFixed(1) : "0",
      totalBookings: activeB.length,
    };
  }, [bookings, rooms]);

  const calendarDays = useMemo(() => {
    const days = [];
    const base = new Date(selectedDate);
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  }, [selectedDate]);

  const getPositionX = (time: string) => {
    const [h, m] = (time || "07:00").split(":").map(Number);
    return Math.max(0, ((h * 60 + m - 7 * 60) / ((23.5 - 7) * 60)) * 100);
  };

  const handleSaveBuilding = async () => {
    setLoading(true);
    const { error } = currentBuilding.id
      ? await supabase
          .from("buildings")
          .update(currentBuilding)
          .eq("id", currentBuilding.id)
      : await supabase.from("buildings").insert([currentBuilding]);
    if (!error) {
      setShowBuildingModal(false);
      loadAdminData();
    } else {
      alert(error.message);
      setLoading(false);
    }
  };

  const handleSaveRoom = async () => {
    setLoading(true);
    const { data: savedRoom, error } = currentRoom.id
      ? await supabase
          .from("rooms")
          .update(currentRoom)
          .eq("id", currentRoom.id)
          .select()
          .single()
      : await supabase.from("rooms").insert([currentRoom]).select().single();

    if (!error && savedRoom) {
      if (isCombi) {
        await supabase.from("rooms_combi").upsert(
          {
            room_id_0: savedRoom.id,
            name: savedRoom.name,
            room_id_1: combiParts[0] || null,
            room_id_2: combiParts[1] || null,
            room_id_3: combiParts[2] || null,
          },
          { onConflict: "room_id_0" },
        );
      } else {
        await supabase
          .from("rooms_combi")
          .delete()
          .eq("room_id_0", savedRoom.id);
      }
      setShowRoomModal(false);
      loadAdminData();
    } else {
      alert(error?.message);
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    setLoading(true);
    const res: any = await updateUserAdmin(editUser.id, editUser);
    if (!res?.error) {
      setShowUserEditModal(false);
      loadAdminData();
    } else {
      alert(res.error);
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const res: any = await createNewUserAdmin(newUser);
    if (!res?.error) {
      setShowAddUserModal(false);
      setNewUser({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        is_admin: false,
      });
      loadAdminData();
    } else {
      alert(res.error);
      setLoading(false);
    }
  };

  const toggleStatus = async (type: "rooms" | "buildings", item: any) => {
    await supabase
      .from(type)
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    loadAdminData();
  };

  if (loading)
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FB] text-[#004a87] font-black italic animate-pulse">
        <ShieldCheck size={80} className="mb-6 text-[#549BB7]" />
        <span>mci system check...</span>
      </div>
    );

  return (
    <div className="admin-page-wrapper">
      <header className="admin-header-nav no-print">
        <div className="flex flex-col items-start text-left">
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
          <h1 className="res-page-title">{t("nav_admin")}</h1>
        </div>
        <button
          onClick={handleLangToggle}
          className="lang-toggle-btn !py-1.5 !px-3"
        >
          <Globe size={14} />{" "}
          <span className="text-[10px]">{lang.toUpperCase()}</span>
        </button>
      </header>

      <div className="admin-layout-grid">
        <aside className="admin-sidebar-container no-print">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden w-full mb-4 flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm text-[#004a87] font-black italic uppercase"
          >
            <div className="flex items-center gap-3">
              <Menu size={20} className="text-[#f7941d]" />
              <span>{t("admin_menu_title")}</span>
            </div>
            <ChevronDown className={showMobileMenu ? "rotate-180" : ""} />
          </button>

          <div
            className={`admin-menu-card hide-scrollbar ${showMobileMenu ? "block" : "hidden lg:block"}`}
          >
            <div className="hidden lg:flex items-center gap-3 mb-8 text-[#004a87] font-black italic uppercase text-sm tracking-widest">
              <Menu size={20} className="text-[#f7941d]" />{" "}
              {t("admin_menu_title")}
            </div>
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab("planning");
                  setShowMobileMenu(false);
                }}
                className={`admin-tab-btn ${activeTab === "planning" ? "active" : ""}`}
              >
                <Calendar size={18} />
                <span>{t("admin_sidebar_planning")}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("buildings");
                  setShowMobileMenu(false);
                }}
                className={`admin-tab-btn ${activeTab === "buildings" ? "active" : ""}`}
              >
                <Home size={18} />
                <span>{t("admin_tab_buildings")}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("rooms");
                  setShowMobileMenu(false);
                }}
                className={`admin-tab-btn ${activeTab === "rooms" ? "active" : ""}`}
              >
                <Layers size={18} />
                <span>{t("admin_sidebar_rooms")}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("users");
                  setShowMobileMenu(false);
                }}
                className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`}
              >
                <Users size={18} />
                <span>{t("admin_sidebar_users")}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("stats");
                  setShowMobileMenu(false);
                }}
                className={`admin-tab-btn ${activeTab === "stats" ? "active" : ""}`}
              >
                <BarChart3 size={18} />
                <span>{t("admin_sidebar_stats")}</span>
              </button>
            </nav>
          </div>
        </aside>

        <main className="flex-1 w-full min-w-0">
          {/* TAB: PLANNING */}
          {activeTab === "planning" && (
            <div className="space-y-6 mci-animate-fade">
              <div className="admin-header-row">
                <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
                  <button
                    onClick={() => setViewMode("day")}
                    className={`px-4 py-2 rounded-lg font-bold text-xs transition ${viewMode === "day" ? "bg-white text-[#004a87] shadow-sm" : "text-slate-400"}`}
                  >
                    {t("admin_planning_view_day")}
                  </button>
                  <button
                    onClick={() => setViewMode("14days")}
                    className={`px-4 py-2 rounded-lg font-bold text-xs transition ${viewMode === "14days" ? "bg-white text-[#004a87] shadow-sm" : "text-slate-400"}`}
                  >
                    {t("admin_planning_view_14days")}
                  </button>
                </div>
                <button
                  onClick={() => window.print()}
                  className="mci-action-btn-unified !w-auto px-6 !bg-slate-800 text-white shadow-lg"
                >
                  <Printer size={16} /> {t("admin_btn_print")}
                </button>
              </div>

              {viewMode === "day" ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setSelectedDate(
                            (d) =>
                              new Date(
                                new Date(d).setDate(new Date(d).getDate() - 1),
                              )
                                .toISOString()
                                .split("T")[0],
                          )
                        }
                        className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="mci-input !w-auto !py-2"
                      />
                      <button
                        onClick={() =>
                          setSelectedDate(
                            (d) =>
                              new Date(
                                new Date(d).setDate(new Date(d).getDate() + 1),
                              )
                                .toISOString()
                                .split("T")[0],
                          )
                        }
                        className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                    <div className="relative flex-1 min-w-[200px]">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                        size={18}
                      />
                      <input
                        type="text"
                        placeholder={t("filter_search_placeholder")}
                        value={planningSearch}
                        onChange={(e) => setPlanningSearch(e.target.value)}
                        className="mci-input !pl-10 !w-full !py-2"
                      />
                    </div>
                  </div>
                  <div className="admin-menu-card overflow-x-auto">
                    <div className="min-w-[900px]">
                      <div className="flex border-b pb-3 mb-3">
                        <div className="w-48 shrink-0 mci-sub-label text-left">
                          {t("header_room")}
                        </div>
                        <div className="flex-1 relative h-5">
                          {[7, 9, 11, 13, 15, 17, 19, 21, 23].map((h) => (
                            <span
                              key={h}
                              className="absolute mci-sub-label border-l pl-2 h-full text-[10px]"
                              style={{ left: `${getPositionX(h + ":00")}%` }}
                            >
                              {h}:00
                            </span>
                          ))}
                        </div>
                      </div>
                      {rooms
                        .filter((r) =>
                          r.name
                            .toLowerCase()
                            .includes(planningSearch.toLowerCase()),
                        )
                        .map((room) => (
                          <div key={room.id} className="timeline-row">
                            <div className="timeline-room-info text-left">
                              <p className="mci-text-bold truncate">
                                {room.name}
                              </p>
                              <p className="mci-sub-label">
                                {
                                  buildings.find(
                                    (b) => b.id === room.building_id,
                                  )?.name
                                }
                              </p>
                            </div>
                            <div className="timeline-bar-container">
                              {bookings
                                .filter(
                                  (b) =>
                                    b.room_id === room.id &&
                                    b.booking_date === selectedDate &&
                                    b.status === "active",
                                )
                                .map((b) => (
                                  <div
                                    key={b.id}
                                    className={`absolute top-0 bottom-0 px-2 flex flex-col justify-center border-l-2 border-white/20 ${b.is_checked_in ? "bg-green-500" : "bg-[#004a87]"} text-white shadow-sm overflow-hidden`}
                                    style={{
                                      left: `${getPositionX(b.start_time)}%`,
                                      width: `${((b.duration * 60) / ((23.5 - 7) * 60)) * 100}%`,
                                    }}
                                  >
                                    <span className="font-black text-[9px] truncate">
                                      {
                                        profiles.find((p) => p.id === b.user_id)
                                          ?.last_name
                                      }
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-left">
                  <select
                    value={selectedRoomForCalendar}
                    onChange={(e) => setSelectedRoomForCalendar(e.target.value)}
                    className="mci-select max-w-md"
                  >
                    <option value="">{t("admin_planning_select_room")}</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {selectedRoomForCalendar && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                      {calendarDays.map((day) => (
                        <div
                          key={day}
                          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm min-h-[120px] text-left"
                        >
                          <p className="mci-sub-label border-b pb-2 mb-2 text-[var(--mci-orange)]">
                            {new Date(day).toLocaleDateString(
                              lang === "de" ? "de-DE" : "en-US",
                              { weekday: "short", day: "2-digit" },
                            )}
                          </p>
                          <div className="space-y-1">
                            {bookings
                              .filter(
                                (b) =>
                                  b.room_id === selectedRoomForCalendar &&
                                  b.booking_date === day &&
                                  b.status === "active",
                              )
                              .map((bk) => (
                                <div
                                  key={bk.id}
                                  className="p-1 bg-blue-50 text-[9px] font-bold text-[#004a87] rounded border border-blue-100"
                                >
                                  {bk.start_time} ({bk.duration}h)
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: STATS */}
          {activeTab === "stats" && (
            <div className="space-y-8 mci-animate-fade text-left">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="admin-menu-card !p-8 text-center">
                  <p className="mci-stat-label">
                    {t("admin_stats_checkin_rate")}
                  </p>
                  <p className="mci-stat-value mci-text-orange">
                    {stats.checkInRate}%
                  </p>
                </div>
                <div className="admin-menu-card !p-8 text-center">
                  <p className="mci-stat-label">
                    {t("admin_stats_avg_duration")}
                  </p>
                  <p className="mci-stat-value mci-text-blue">
                    {stats.avgDuration}{" "}
                    <span className="text-sm opacity-40">h</span>
                  </p>
                </div>
                <div className="admin-menu-card !p-8 text-center">
                  <p className="mci-stat-label">{t("admin_stats_total")}</p>
                  <p className="mci-stat-value mci-text-blue">
                    {stats.totalBookings}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="admin-menu-card">
                  <h3 className="mci-stat-label border-b pb-4 mb-6">
                    {t("admin_stats_top_lifetime")}
                  </h3>
                  {stats.topLifetime.map((r, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center border-b border-slate-50 pb-3 mb-3 text-sm text-left"
                    >
                      <span className="mci-text-bold">
                        {i + 1}. {r.name}
                      </span>
                      <span className="bg-slate-50 px-4 py-1 rounded-full mci-sub-label mci-text-blue">
                        {r.count}x
                      </span>
                    </div>
                  ))}
                </div>
                <div className="admin-menu-card border-l-4 border-l-[var(--mci-orange)]">
                  <h3 className="mci-stat-label border-b pb-4 mb-6 mci-text-orange">
                    {t("admin_stats_top_last_week")}
                  </h3>
                  {stats.topLastWeek.map((r, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center border-b border-slate-50 pb-3 mb-3 text-sm text-left"
                    >
                      <span className="mci-text-bold">
                        {i + 1}. {r.name}
                      </span>
                      <span className="bg-orange-50 px-4 py-1 rounded-full mci-sub-label mci-text-orange">
                        {r.count}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: BUILDINGS */}
          {activeTab === "buildings" && (
            <div className="space-y-6 mci-animate-fade text-left">
              <div className="admin-header-row">
                <h2 className="res-page-title !text-2xl">
                  {t("admin_title_buildings")}
                </h2>
                <button
                  onClick={() => {
                    setCurrentBuilding({
                      name: "",
                      distance: 0,
                      floors: 1,
                      latitude: 47.26,
                      longitude: 11.39,
                      accessible: true,
                      mci_wifi_ip: "",
                      image_url: "",
                      is_active: true,
                    });
                    setShowBuildingModal(true);
                  }}
                  className="mci-action-btn-unified !w-auto px-6 !bg-[var(--mci-blue)] text-white shadow-md"
                >
                  <Plus size={16} /> {t("admin_btn_add_building")}
                </button>
              </div>
              <div className="admin-card-grid">
                {buildings.map((b) => (
                  <div
                    key={b.id}
                    className={`admin-menu-card flex justify-between items-center !p-5 ${!b.is_active && "opacity-40 grayscale"}`}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="mci-icon-box">
                        {b.image_url ? (
                          <img
                            src={b.image_url}
                            className="w-10 h-10 object-cover rounded-lg"
                            alt=""
                          />
                        ) : (
                          <Home size={22} />
                        )}
                      </div>
                      <div>
                        <h3 className="mci-text-bold">{b.name}</h3>
                        <p className="mci-sub-label">
                          {b.distance} Min • {b.floors} OG
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCurrentBuilding(b);
                          setShowBuildingModal(true);
                        }}
                        className="p-2 text-slate-300 hover:text-[#004a87] transition"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => toggleStatus("buildings", b)}
                        className={`p-2 transition ${b.is_active ? "text-slate-200 hover:text-red-500" : "text-red-500 hover:text-green-500"}`}
                      >
                        <Power size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: ROOMS */}
          {activeTab === "rooms" && (
            <div className="space-y-6 mci-animate-fade text-left">
              <div className="admin-header-row">
                <h2 className="res-page-title !text-2xl">
                  {t("admin_title_rooms")}
                </h2>
                <button
                  onClick={() => {
                    setCurrentRoom({
                      name: "",
                      capacity: 4,
                      floor: 0,
                      is_active: true,
                      equipment: [],
                      seating_arrangement: SEATING_OPTIONS[0],
                      building_id: buildings[0]?.id,
                      image_url: "",
                      accessible: true,
                    });
                    setIsCombi(false);
                    setCombiParts([]);
                    setShowRoomModal(true);
                  }}
                  className="mci-action-btn-unified !w-auto px-6 !bg-[var(--mci-blue)] text-white shadow-md"
                >
                  <Plus size={16} /> {t("admin_btn_add_room")}
                </button>
              </div>
              <div className="admin-card-grid">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`admin-menu-card flex justify-between items-center !p-5 ${!room.is_active && "opacity-40 grayscale"}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="mci-icon-box">
                        {room.image_url ? (
                          <img
                            src={room.image_url}
                            className="w-10 h-10 object-cover rounded-lg"
                            alt=""
                          />
                        ) : (
                          <Monitor size={22} />
                        )}
                      </div>
                      <div>
                        <h3 className="mci-text-bold">{room.name}</h3>
                        <p className="mci-sub-label">
                          {
                            buildings.find((b) => b.id === room.building_id)
                              ?.name
                          }{" "}
                          • {room.floor}. OG
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCurrentRoom(room);
                          setIsCombi(!!room.room_combi_id);
                          setShowRoomModal(true);
                        }}
                        className="p-2 text-slate-300 hover:text-[#004a87] transition"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => toggleStatus("rooms", room)}
                        className={`p-2 transition ${room.is_active ? "text-slate-200 hover:text-red-500" : "text-red-500 hover:text-green-500"}`}
                      >
                        <Power size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: USERS */}
          {activeTab === "users" && (
            <div className="space-y-6 mci-animate-fade text-left">
              <div className="admin-header-row">
                <h2 className="res-page-title !text-2xl">
                  {t("admin_sidebar_users")}
                </h2>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="mci-action-btn-unified !w-auto px-6 !bg-[var(--mci-blue)] text-white shadow-md"
                >
                  <UserPlus size={16} /> {t("admin_btn_add_user")}
                </button>
              </div>
              <div className="admin-menu-card !p-0 overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <table className="admin-table w-full min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="mci-sub-label p-6 text-left">Name</th>
                        <th className="mci-sub-label p-6 text-left">E-Mail</th>
                        <th className="mci-sub-label p-6 text-left">Rolle</th>
                        <th className="p-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50 transition border-b border-slate-50 last:border-0"
                        >
                          <td>
                            <p className="mci-text-bold px-6">
                              {p.first_name} {p.last_name}
                            </p>
                          </td>
                          <td className="text-slate-400 text-sm px-6">
                            {p.email}
                          </td>
                          <td className="px-6">
                            <span
                              className={`px-4 py-1 rounded-full text-[10px] font-black italic ${p.is_admin ? "bg-[#004a87] text-white" : "bg-slate-100 text-slate-400"}`}
                            >
                              {p.is_admin ? "ADMIN" : "USER"}
                            </span>
                          </td>
                          <td className="text-right px-6">
                            <button
                              onClick={() => {
                                setEditUser(p);
                                setShowUserEditModal(true);
                              }}
                              className="text-slate-300 hover:text-[#004a87] p-2 transition"
                            >
                              <Edit3 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- MODALS --- */}

      {showBuildingModal && currentBuilding && (
        <div className="mci-modal-overlay">
          <div className="mci-modal-card max-w-xl animate-in zoom-in-95">
            <div className="mci-modal-header text-white">
              <div className="flex flex-col text-left">
                <p className="text-xs font-black opacity-70 uppercase italic">
                  Building Management
                </p>
                <h3 className="text-4xl font-black uppercase italic tracking-tighter">
                  {currentBuilding.name || "New Building"}
                </h3>
              </div>
              <button
                onClick={() => setShowBuildingModal(false)}
                className="bg-white/10 p-3 rounded-full hover:rotate-90 transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="mci-modal-body p-10 space-y-6 text-left">
              {currentBuilding.image_url && (
                <div className="mci-image-preview-frame">
                  <img
                    src={currentBuilding.image_url}
                    alt="Building Preview"
                    className="w-full h-full object-cover rounded-2xl"
                  />
                </div>
              )}
              <div>
                <label className="mci-label">{t("admin_field_name")}</label>
                <input
                  value={currentBuilding.name}
                  onChange={(e) =>
                    setCurrentBuilding({
                      ...currentBuilding,
                      name: e.target.value,
                    })
                  }
                  className="mci-input"
                />
              </div>
              <div>
                <label className="mci-label">
                  {t("admin_field_image_url")}
                </label>
                <input
                  value={currentBuilding.image_url}
                  onChange={(e) =>
                    setCurrentBuilding({
                      ...currentBuilding,
                      image_url: e.target.value,
                    })
                  }
                  className="mci-input"
                />
              </div>
              <div className="mci-grid-2">
                <div>
                  <label className="mci-label">{t("filter_dist")}</label>
                  <input
                    type="number"
                    value={currentBuilding.distance}
                    onChange={(e) =>
                      setCurrentBuilding({
                        ...currentBuilding,
                        distance: parseInt(e.target.value),
                      })
                    }
                    className="mci-input"
                  />
                </div>
                <div>
                  <label className="mci-label">{t("admin_field_floor")}</label>
                  <input
                    type="number"
                    value={currentBuilding.floors}
                    onChange={(e) =>
                      setCurrentBuilding({
                        ...currentBuilding,
                        floors: parseInt(e.target.value),
                      })
                    }
                    className="mci-input"
                  />
                </div>
              </div>
              <div className="mci-grid-2">
                <div>
                  <label className="mci-label">Lat</label>
                  <input
                    type="number"
                    value={currentBuilding.latitude}
                    onChange={(e) =>
                      setCurrentBuilding({
                        ...currentBuilding,
                        latitude: parseFloat(e.target.value),
                      })
                    }
                    className="mci-input"
                  />
                </div>
                <div>
                  <label className="mci-label">Long</label>
                  <input
                    type="number"
                    value={currentBuilding.longitude}
                    onChange={(e) =>
                      setCurrentBuilding({
                        ...currentBuilding,
                        longitude: parseFloat(e.target.value),
                      })
                    }
                    className="mci-input"
                  />
                </div>
              </div>
              <div>
                <label className="mci-label">{t("admin_label_wifi_ip")}</label>
                <input
                  value={currentBuilding.mci_wifi_ip}
                  onChange={(e) =>
                    setCurrentBuilding({
                      ...currentBuilding,
                      mci_wifi_ip: e.target.value,
                    })
                  }
                  className="mci-input font-mono"
                  placeholder="192.168"
                />
              </div>

              <label className="mci-filter-item mt-4">
                <input
                  type="checkbox"
                  checked={currentBuilding.accessible}
                  onChange={(e) =>
                    setCurrentBuilding({
                      ...currentBuilding,
                      accessible: e.target.checked,
                    })
                  }
                  className="filter-checkbox"
                />
                <span className="font-bold text-slate-600 flex items-center gap-2">
                  <Accessibility size={16} /> {t("label_accessible")}
                </span>
              </label>
              <div>
                <button
                  onClick={handleSaveBuilding}
                  className="mci-action-btn-unified !bg-green-600 text-white mt-8 shadow-xl"
                >
                  <Save size={20} /> {t("admin_btn_save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRoomModal && currentRoom && (
        <div className="mci-modal-overlay">
          <div className="mci-modal-card max-w-2xl animate-in zoom-in-95">
            <div className="mci-modal-header text-white">
              <div className="flex flex-col text-left">
                <p className="text-xs font-black opacity-70 uppercase italic">
                  Room Configuration
                </p>
                <h3 className="text-4xl font-black uppercase italic tracking-tighter">
                  {currentRoom.name || "New Room"}
                </h3>
              </div>
              <button
                onClick={() => setShowRoomModal(false)}
                className="bg-white/10 p-3 rounded-full hover:rotate-90 transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="mci-modal-body p-10 space-y-6 text-left">
              {currentRoom.image_url && (
                <div className="mci-image-preview-frame">
                  <img
                    src={currentRoom.image_url}
                    alt="Room Preview"
                    className="w-full h-full object-cover rounded-2xl"
                  />
                </div>
              )}
              <div className="mci-grid-2">
                <div>
                  <label className="mci-label">
                    {t("admin_label_roomname")}
                  </label>
                  <input
                    value={currentRoom.name}
                    onChange={(e) =>
                      setCurrentRoom({ ...currentRoom, name: e.target.value })
                    }
                    className="mci-input"
                  />
                </div>
                <div>
                  <label className="mci-label">
                    {t("admin_label_building_select")}
                  </label>
                  <select
                    value={currentRoom.building_id}
                    onChange={(e) =>
                      setCurrentRoom({
                        ...currentRoom,
                        building_id: e.target.value,
                      })
                    }
                    className="mci-select"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mci-label">
                  {t("admin_field_image_url")}
                </label>
                <input
                  value={currentRoom.image_url}
                  onChange={(e) =>
                    setCurrentRoom({
                      ...currentRoom,
                      image_url: e.target.value,
                    })
                  }
                  className="mci-input"
                />
              </div>
              <div className="mci-grid-2">
                <div>
                  <label className="mci-label">
                    {t("admin_label_capacity")}
                  </label>
                  <input
                    type="number"
                    value={currentRoom.capacity}
                    onChange={(e) =>
                      setCurrentRoom({
                        ...currentRoom,
                        capacity: parseInt(e.target.value),
                      })
                    }
                    className="mci-input"
                  />
                </div>
                <div>
                  <label className="mci-label">{t("admin_label_floor")}</label>
                  <input
                    type="number"
                    value={currentRoom.floor}
                    onChange={(e) =>
                      setCurrentRoom({
                        ...currentRoom,
                        floor: parseInt(e.target.value),
                      })
                    }
                    className="mci-input"
                  />
                </div>
              </div>
              <div>
                <label className="mci-label">{t("admin_label_seating")}</label>
                <select
                  value={currentRoom.seating_arrangement}
                  onChange={(e) =>
                    setCurrentRoom({
                      ...currentRoom,
                      seating_arrangement: e.target.value,
                    })
                  }
                  className="mci-select"
                >
                  {SEATING_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {t(o)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mci-label">
                  {t("admin_label_equip_select")}
                </label>
                <div className="grid grid-cols-2 gap-3 p-6 bg-slate-50 rounded-[2rem] border border-gray-100">
                  {equipmentList.map((eq) => (
                    <label key={eq.id} className="mci-filter-item">
                      <input
                        type="checkbox"
                        checked={currentRoom.equipment?.includes(eq.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...(currentRoom.equipment || []), eq.id]
                            : currentRoom.equipment.filter(
                                (x: any) => x !== eq.id,
                              );
                          setCurrentRoom({ ...currentRoom, equipment: next });
                        }}
                        className="filter-checkbox"
                      />
                      <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        {getEquipmentIcon(eq.id)} {getTrans(eq, "name", lang)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="mci-filter-item mt-4">
                <input
                  type="checkbox"
                  checked={currentRoom.accessible}
                  onChange={(e) =>
                    setCurrentRoom({
                      ...currentRoom,
                      accessible: e.target.checked,
                    })
                  }
                  className="filter-checkbox"
                />
                <span className="font-bold text-slate-600 flex items-center gap-2">
                  <Accessibility size={16} /> {t("label_accessible")}
                </span>
              </label>

              <div className="p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100 text-left mt-4">
                <label className="flex items-center justify-between cursor-pointer mb-3">
                  <span className="text-xs font-black uppercase italic text-[#004a87]">
                    {t("admin_label_is_combi")}
                  </span>
                  <input
                    type="checkbox"
                    checked={isCombi}
                    onChange={(e) => setIsCombi(e.target.checked)}
                    className="filter-checkbox"
                  />
                </label>
                {isCombi && (
                  <div className="space-y-2">
                    {[0, 1, 2].map((idx) => (
                      <select
                        key={idx}
                        value={combiParts[idx] || ""}
                        onChange={(e) => {
                          const n = [...combiParts];
                          n[idx] = e.target.value;
                          setCombiParts(n);
                        }}
                        className="mci-select !bg-white"
                      >
                        <option value="">{t("admin_label_combi_parts")}</option>
                        {rooms
                          .filter((r) => r.id !== currentRoom.id)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <button
                  onClick={handleSaveRoom}
                  className="mci-action-btn-unified !bg-green-600 text-white mt-8 shadow-xl"
                >
                  <Save size={20} /> {t("admin_btn_save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserEditModal && editUser && (
        <div className="mci-modal-overlay">
          <div className="mci-modal-card max-w-xl animate-in zoom-in-95">
            <div className="mci-modal-header text-white">
              <div className="flex flex-col text-left">
                <p className="text-xs font-black opacity-70 uppercase italic">
                  User Profile
                </p>
                <h3 className="text-4xl font-black uppercase italic tracking-tighter">
                  {editUser.email}
                </h3>
              </div>
              <button
                onClick={() => setShowUserEditModal(false)}
                className="bg-white/10 p-3 rounded-full hover:rotate-90 transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="mci-modal-body p-10 space-y-6 text-left">
              <div className="mci-grid-2">
                <div>
                  <label className="mci-label">{t("admin_label_fname")}</label>
                  <input
                    value={editUser.first_name}
                    onChange={(e) =>
                      setEditUser({ ...editUser, first_name: e.target.value })
                    }
                    className="mci-input"
                  />
                </div>
                <div>
                  <label className="mci-label">{t("admin_label_lname")}</label>
                  <input
                    value={editUser.last_name}
                    onChange={(e) =>
                      setEditUser({ ...editUser, last_name: e.target.value })
                    }
                    className="mci-input"
                  />
                </div>
              </div>
              <div>
                <label className="mci-label">
                  {t("admin_label_password")} ({t("label_new_password")})
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  onChange={(e) =>
                    setEditUser({ ...editUser, password: e.target.value })
                  }
                  className="mci-input"
                />
              </div>
              <label className="mci-filter-item">
                <input
                  type="checkbox"
                  checked={editUser.is_admin}
                  onChange={(e) =>
                    setEditUser({ ...editUser, is_admin: e.target.checked })
                  }
                  className="filter-checkbox"
                />
                <span className="font-bold text-slate-600">
                  {t("admin_label_admin")}
                </span>
              </label>
              <div>
                <button
                  onClick={handleUpdateUser}
                  className="mci-action-btn-unified !bg-green-600 text-white mt-8 shadow-xl"
                >
                  <Save size={20} /> {t("admin_btn_save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddUserModal && (
        <div className="mci-modal-overlay">
          <div className="mci-modal-card max-w-xl animate-in zoom-in-95">
            <div className="mci-modal-header text-white">
              <div className="flex flex-col text-left">
                <p className="text-xs font-black opacity-70 uppercase italic">
                  Identity Management
                </p>
                <h3 className="text-4xl font-black uppercase italic tracking-tighter">
                  {t("admin_modal_add_user_title")}
                </h3>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="bg-white/10 p-3 rounded-full hover:rotate-90 transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <form
              onSubmit={handleCreateUser}
              className="mci-modal-body p-10 space-y-6 text-left"
            >
              <div className="mci-grid-2">
                <div>
                  <label className="mci-label">{t("admin_label_fname")}</label>
                  <input
                    required
                    value={newUser.first_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, first_name: e.target.value })
                    }
                    className="mci-input"
                  />
                </div>
                <div>
                  <label className="mci-label">{t("admin_label_lname")}</label>
                  <input
                    required
                    value={newUser.last_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, last_name: e.target.value })
                    }
                    className="mci-input"
                  />
                </div>
              </div>
              <div>
                <label className="mci-label">{t("admin_label_email")}</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  className="mci-input"
                />
              </div>
              <div>
                <label className="mci-label">{t("admin_label_password")}</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  className="mci-input"
                />
              </div>
              <label className="mci-filter-item">
                <input
                  type="checkbox"
                  checked={newUser.is_admin}
                  onChange={(e) =>
                    setNewUser({ ...newUser, is_admin: e.target.checked })
                  }
                  className="filter-checkbox"
                />
                <span className="font-bold text-slate-600">
                  {t("admin_label_admin")}
                </span>
              </label>
              <div>
                <button
                  type="submit"
                  className="mci-action-btn-unified !bg-[var(--mci-blue)] text-white mt-8 shadow-xl"
                >
                  <UserPlus size={20} /> {t("admin_btn_add_user")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
