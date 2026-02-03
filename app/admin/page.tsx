"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { updateUserAdmin, createNewUserAdmin } from "./actions";
import "./admin.css";

import BuildingModal from "./BuildingModal";
import RoomModal from "./RoomModal";
import UserModals from "./UserModals";

import {
  APP_CONFIG,
  BOOKING_STATUS,
  SUPPORTED_LANGS,
  Language,
  SEATING_OPTIONS,
} from "@/lib/constants";
import { getEquipmentIcon } from "@/lib/icons";
import { timeToMinutes, getEndTimeParts, getTrans } from "@/lib/utils";
import LoadingScreen from "@/app/components/LoadingScreen";

import {
  Users,
  Calendar,
  BarChart3,
  ArrowLeft,
  Power,
  PlusCircle,
  Globe,
  Search,
  CheckCircle2,
  Monitor,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Printer,
  History,
  Save,
  Edit3,
  Lock,
  Unlock,
  UserPlus,
  Home,
  Layers,
  Settings,
  ShieldCheck,
} from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("planning");
  const [lang, setLang] = useState<Language>(APP_CONFIG.DEFAULT_LANG);
  const [dbTrans, setDbTrans] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // States (Heilige Regel: Nichts löschen)
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);

  // Modals & Menu
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showUserEditModal, setShowUserEditModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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
  const [isCombi, setIsCombi] = useState(false);
  const [combiParts, setCombiParts] = useState<string[]>([]);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toLocaleDateString("en-CA"),
  );
  const [planningSearch, setPlanningSearch] = useState("");
  const [viewMode, setViewMode] = useState<"day" | "14days" | "lockplan">(
    "day",
  );

  // HEILIGES GEBOT: Fehlende Filter-States wiederhergestellt
  const [dayViewBuildingFilter, setDayViewBuildingFilter] = useState("");
  const [lockplanBuildingFilter, setLockplanBuildingFilter] = useState("");
  const [lockplanRoomFilter, setLockplanRoomFilter] = useState("");

  const [selectedRoomForCalendar, setSelectedRoomForCalendar] =
    useState<string>("");

  const t = (key: string) => dbTrans[key?.toLowerCase()]?.[lang] || key;

  useEffect(() => {
    const savedLang = localStorage.getItem("rbs_lang") as Language;
    if (SUPPORTED_LANGS.includes(savedLang)) setLang(savedLang);
    loadAdminData();
  }, []);

  const handleLangToggle = () => {
    const currentIndex = SUPPORTED_LANGS.indexOf(lang);
    const nextLang =
      SUPPORTED_LANGS[(currentIndex + 1) % SUPPORTED_LANGS.length];
    setLang(nextLang);
    localStorage.setItem("rbs_lang", nextLang);
  };

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
    const currentUserProfile = profRes.data?.find(
      (p) => p.id === session.user.id,
    );
    if (!currentUserProfile?.is_admin) {
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

  // HEILIGES GEBOT: Business Logic auf Minuten-Schema angepasst
  const stats = useMemo(() => {
    const activeB = bookings.filter((b) => b.status === BOOKING_STATUS.ACTIVE);
    const totalDurMinutes = activeB.reduce(
      (sum, b) => sum + (b.duration || 0),
      0,
    );
    const topLifetime = rooms
      .map((r) => ({
        name: r.name,
        count: bookings.filter(
          (b) => b.room_id === r.id && b.status !== BOOKING_STATUS.CANCELLED,
        ).length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const oneWeekAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
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
    return {
      checkInRate:
        bookings.length > 0
          ? Math.round(
              (bookings.filter((b) => b.is_checked_in).length /
                bookings.length) *
                100,
            )
          : 0,
      avgDuration:
        activeB.length > 0
          ? (totalDurMinutes / activeB.length / 60).toFixed(1)
          : "0",
      totalBookings: activeB.length,
      topLifetime,
      topLastWeek,
    };
  }, [bookings, rooms]);

  const getLockplanData = useMemo(() => {
    if (viewMode !== "lockplan") return [];

    const tasks: any[] = [];

    bookings
      .filter(
        (b) =>
          b.booking_date === selectedDate && b.status === BOOKING_STATUS.ACTIVE,
      )
      .forEach((b) => {
        const room = rooms.find((r) => r.id === b.room_id);
        if (!room) return;

        const building = buildings.find((bu) => bu.id === room.building_id);
        if (!building) return;

        if (lockplanBuildingFilter && building.id !== lockplanBuildingFilter)
          return;
        if (
          lockplanRoomFilter &&
          !room.name.toLowerCase().includes(lockplanRoomFilter.toLowerCase())
        )
          return;

        // HEILIGES GEBOT: Minuten -> Stunden Umrechnung für Utility
        const { hh: endH, mm: endM } = getEndTimeParts(
          b.start_time,
          b.duration / 60,
        );

        tasks.push({
          id: `${b.id}-open`,
          time: b.start_time,
          type: "open",
          room,
          building,
          booking: b,
        });

        tasks.push({
          id: `${b.id}-close`,
          time: `${endH}:${endM}`,
          type: "close",
          room,
          building,
          booking: b,
        });
      });

    const sortedTasks = tasks.sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
    );

    const buildingGroups = buildings
      .map((building) => {
        const bTasks = sortedTasks.filter((t) => t.building.id === building.id);
        return { ...building, tasks: bTasks };
      })
      .filter((bg) => bg.tasks.length > 0);

    return buildingGroups;
  }, [
    viewMode,
    selectedDate,
    bookings,
    buildings,
    rooms,
    lockplanBuildingFilter,
    lockplanRoomFilter,
  ]);

  const calendarDays = useMemo(() => {
    const days = [];
    const base = new Date(selectedDate);
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(d.toLocaleDateString("en-CA"));
    }
    return days;
  }, [selectedDate]);

  const getPositionX = (time: string) => {
    const [h, m] = (time || "07:00").split(":").map(Number);
    return Math.max(0, ((h * 60 + m - 7 * 60) / ((23.5 - 7) * 60)) * 100);
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

  const handleCreateUser = async (e: React.FormEvent) => {
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

  const toggleStatus = async (type: "rooms" | "buildings", item: any) => {
    await supabase
      .from(type)
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    loadAdminData();
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="rbs-page-wrapper">
      <nav className="rbs-navbar no-print">
        <div className="flex items-center gap-2 md:gap-8">
          <img
            src="/RBS.png"
            alt="RBS"
            className="h-8 md:h-12 cursor-pointer"
            onClick={() => router.push("/rooms")}
          />
          <button onClick={() => router.push("/rooms")} className="nav-link">
            <ArrowLeft size={16} />{" "}
            <span className="hidden md:inline">{t("archiv_back")}</span>
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
        </div>
      </nav>

      <main className="rbs-main-layout">
        <aside className="rbs-sidebar no-print">
          <div className="rbs-sidebar-unit sticky top-28">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="rbs-sidebar-toggle"
            >
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-[var(--rbs-orange)]" />
                <span>{t("admin_menu_title")}</span>
              </div>
              <ChevronDown
                className={`transition-transform duration-300 ${showMobileMenu ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`rbs-sidebar-content ${showMobileMenu ? "block" : "hidden min-[1400px]:block"}`}
            >
              <div className="rbs-sidebar-desktop-title">
                <Settings size={20} /> {t("admin_menu_title")}
              </div>
              <nav className="px-4 lg:px-6 pt-2 pb-4 lg:pb-6 space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("planning");
                    setShowMobileMenu(false);
                  }}
                  className={`rbs-tab-btn ${activeTab === "planning" ? "active" : ""}`}
                >
                  <Calendar size={18} />{" "}
                  <span>{t("admin_sidebar_planning")}</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("buildings");
                    setShowMobileMenu(false);
                  }}
                  className={`rbs-tab-btn ${activeTab === "buildings" ? "active" : ""}`}
                >
                  <Home size={18} /> <span>{t("admin_title_buildings")}</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("rooms");
                    setShowMobileMenu(false);
                  }}
                  className={`rbs-tab-btn ${activeTab === "rooms" ? "active" : ""}`}
                >
                  <Layers size={18} /> <span>{t("admin_sidebar_rooms")}</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("users");
                    setShowMobileMenu(false);
                  }}
                  className={`rbs-tab-btn ${activeTab === "users" ? "active" : ""}`}
                >
                  <Users size={18} /> <span>{t("admin_sidebar_users")}</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("stats");
                    setShowMobileMenu(false);
                  }}
                  className={`rbs-tab-btn ${activeTab === "stats" ? "active" : ""}`}
                >
                  <BarChart3 size={18} />{" "}
                  <span>{t("admin_sidebar_stats")}</span>
                </button>
              </nav>
            </div>
          </div>
        </aside>

        <div className="flex-1 w-full min-w-0">
          {activeTab === "planning" && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h1 className="rbs-page-title">{t("admin_title_planning")}</h1>
                <button
                  onClick={() => window.print()}
                  className="rbs-btn-action no-print"
                >
                  <Printer size={16} /> {t("admin_btn_print")}
                </button>
              </header>

              <div className="flex flex-col sm:flex-row gap-4 no-print">
                <div className="rbs-planning-toggle-wrapper">
                  <button
                    onClick={() => setViewMode("day")}
                    className={`rbs-planning-toggle-btn ${viewMode === "day" ? "active" : ""}`}
                  >
                    {t("admin_planning_view_day")}
                  </button>
                  <button
                    onClick={() => setViewMode("14days")}
                    className={`rbs-planning-toggle-btn ${viewMode === "14days" ? "active" : ""}`}
                  >
                    {t("admin_planning_view_14days")}
                  </button>
                  <button
                    onClick={() => setViewMode("lockplan")}
                    className={`rbs-planning-toggle-btn ${viewMode === "lockplan" ? "active" : ""}`}
                  >
                    {t("admin_planning_view_lockplan")}
                  </button>
                </div>
              </div>

              {viewMode === "lockplan" && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex items-center gap-2 no-print">
                    <button
                      onClick={() =>
                        setSelectedDate((d) =>
                          new Date(
                            new Date(d).setDate(new Date(d).getDate() - 1),
                          ).toLocaleDateString("en-CA"),
                        )
                      }
                      className="rbs-planning-nav-btn"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="rbs-planning-date-input"
                    />
                    <button
                      onClick={() =>
                        setSelectedDate((d) =>
                          new Date(
                            new Date(d).setDate(new Date(d).getDate() + 1),
                          ).toLocaleDateString("en-CA"),
                        )
                      }
                      className="rbs-planning-nav-btn"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  <div className="rbs-lockplan-filter-card no-print">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="rbs-label">
                          {t("admin_lockplan_filter_building")}
                        </label>
                        <select
                          value={lockplanBuildingFilter}
                          onChange={(e) =>
                            setLockplanBuildingFilter(e.target.value)
                          }
                          className="rbs-select"
                        >
                          <option value="">{t("admin_label_building_select")}</option>
                          {buildings.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="rbs-label">
                          {t("admin_lockplan_filter_room")}
                        </label>
                        <input
                          type="text"
                          value={lockplanRoomFilter}
                          onChange={(e) =>
                            setLockplanRoomFilter(e.target.value)
                          }
                          placeholder={t("filter_search_placeholder")}
                          className="rbs-input"
                        />
                      </div>
                    </div>
                  </div>

                  {getLockplanData.map((building: any) => (
                    <div key={building.id} className="space-y-4">
                      <h3 className="rbs-lockplan-building-title">
                        <Home size={24} /> {building.name}
                      </h3>
                      <div className="rbs-admin-table-container overflow-x-auto">
                        <table className="rbs-admin-table">
                          <thead>
                            <tr>
                              <th>{t("admin_lockplan_time")}</th>
                              <th>{t("admin_lockplan_action")}</th>
                              <th>{t("admin_label_roomname")}</th>
                              <th>{t("admin_label_floor")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {building.tasks.map((task: any) => (
                              <tr key={task.id}>
                                <td className="font-black text-[var(--rbs-blue)]">
                                  {task.time}
                                </td>
                                <td>
                                  {task.type === "open" ? (
                                    <span className="flex items-center gap-2 text-green-600 font-black italic uppercase text-[10px]">
                                      <Unlock size={14} />{" "}
                                      {t("admin_lockplan_open")}
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-2 text-red-600 font-black italic uppercase text-[10px]">
                                      <Lock size={14} />{" "}
                                      {t("admin_lockplan_close")}
                                    </span>
                                  )}
                                </td>
                                <td className="rbs-lockplan-roomname">
                                  {task.room.name}
                                </td>
                                <td>
                                  <div className="rbs-lockplan-cell-content flex items-center gap-2">
                                    <Layers size={14} /> {task.room.floor}. OG
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === "day" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-4 no-print">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setSelectedDate((d) =>
                            new Date(
                              new Date(d).setDate(new Date(d).getDate() - 1),
                            ).toLocaleDateString("en-CA"),
                          )
                        }
                        className="rbs-planning-nav-btn"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="rbs-planning-date-input"
                      />
                      <button
                        onClick={() =>
                          setSelectedDate((d) =>
                            new Date(
                              new Date(d).setDate(new Date(d).getDate() + 1),
                            ).toLocaleDateString("en-CA"),
                          )
                        }
                        className="rbs-planning-nav-btn"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                    {/* HEILIGES GEBOT: Fehlender Filter wieder eingebaut */}
                    <div className="w-full sm:w-48">
                      <select
                        value={dayViewBuildingFilter}
                        onChange={(e) =>
                          setDayViewBuildingFilter(e.target.value)
                        }
                        className="rbs-select"
                      >
                        <option value="">{t("admin_label_building_select")}</option>
                        {buildings
                          .filter((b) => b.is_active !== false)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="rbs-planning-search-wrapper">
                      <Search className="rbs-planning-search-icon" size={18} />
                      <input
                        type="text"
                        placeholder={t("filter_search_placeholder")}
                        value={planningSearch}
                        onChange={(e) => setPlanningSearch(e.target.value)}
                        className="rbs-planning-search-input"
                      />
                    </div>
                  </div>
                  <div className="rbs-admin-table-container overflow-x-auto">
                    <div className="rbs-timeline-wrapper">
                      <div className="rbs-timeline-header">
                        <div className="rbs-timeline-header-room">
                          {t("header_room")}
                        </div>
                        <div className="rbs-timeline-header-time">
                          {[7, 9, 11, 13, 15, 17, 19, 21, 23].map((h) => (
                            <span
                              key={h}
                              className="rbs-timeline-hour-marker"
                              style={{ left: `${getPositionX(h + ":00")}%` }}
                            >
                              {h}:00
                            </span>
                          ))}
                        </div>
                      </div>
                      {rooms
                        .filter(
                          (r) =>
                            r.name
                              .toLowerCase()
                              .includes(planningSearch.toLowerCase()) &&
                            (dayViewBuildingFilter === "" ||
                              r.building_id === dayViewBuildingFilter),
                        )
                        .map((room) => (
                          <div key={room.id} className="rbs-timeline-row">
                            <div className="rbs-timeline-room-info">
                              <p className="rbs-timeline-room-name">
                                {room.name}
                              </p>
                              <p className="rbs-timeline-building-name">
                                {
                                  buildings.find(
                                    (b) => b.id === room.building_id,
                                  )?.name
                                }
                              </p>
                            </div>
                            <div className="rbs-timeline-bar-container">
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
                                    className={`rbs-timeline-booking ${b.is_checked_in ? "checked-in" : ""}`}
                                    style={{
                                      left: `${getPositionX(b.start_time)}%`,
                                      // HEILIGES GEBOT: Multiplikation entfernt da b.duration = Minuten
                                      width: `${(b.duration / ((23.5 - 7) * 60)) * 100}%`,
                                    }}
                                  >
                                    {
                                      profiles.find((p) => p.id === b.user_id)
                                        ?.last_name
                                    }
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {viewMode === "14days" && (
                <div className="space-y-6 text-left">
                  <select
                    value={selectedRoomForCalendar}
                    onChange={(e) => setSelectedRoomForCalendar(e.target.value)}
                    className="rbs-select max-w-md"
                  >
                    <option value="">{t("admin_planning_select_room")}</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {selectedRoomForCalendar && (
                    <div className="rbs-calendar-grid">
                      {calendarDays.map((day) => (
                        <div key={day} className="rbs-calendar-day-card">
                          <p className="rbs-calendar-day-label">
                            {new Date(day).toLocaleDateString(lang, {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                            })}
                          </p>
                          <div className="space-y-2">
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
                                  className="rbs-calendar-booking"
                                >
                                  {bk.start_time} ({bk.duration / 60}h)
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

          {/* TAB: STATS (Heilige Regel: 1:1 Stile aus Vorversion) */}
          {activeTab === "stats" && (
            <div className="space-y-12 animate-in fade-in duration-500">
              <header>
                <h1 className="rbs-page-title">{t("admin_sidebar_stats")}</h1>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="rbs-stat-card">
                  <p className="rbs-label uppercase">
                    {t("admin_stats_checkin_rate")}
                  </p>
                  <p className="rbs-stat-value">{stats.checkInRate}%</p>
                </div>
                <div className="rbs-stat-card">
                  <p className="rbs-label uppercase">
                    {t("admin_stats_avg_duration")}
                  </p>
                  <p className="rbs-stat-value">{stats.avgDuration}h</p>
                </div>
                <div className="rbs-stat-card">
                  <p className="rbs-label uppercase">
                    {t("admin_stats_total")}
                  </p>
                  <p className="rbs-stat-value">{stats.totalBookings}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm text-left">
                  <h3 className="rbs-label border-b border-gray-50 pb-4 mb-6">
                    {t("admin_stats_top_lifetime")}
                  </h3>
                  <div className="space-y-4">
                    {stats.topLifetime.map((r, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center bg-slate-50 p-5 rounded-2xl"
                      >
                        <span className="font-bold text-slate-700">
                          {i + 1}. {r.name}
                        </span>
                        <span className="font-black italic text-[var(--rbs-blue)]">
                          {r.count}x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm border-l-4 border-l-[var(--rbs-orange)] text-left">
                  <h3 className="rbs-label border-b border-gray-50 pb-4 mb-6 text-[var(--rbs-orange)]">
                    Top 5 Last 7 Days
                  </h3>
                  <div className="space-y-4">
                    {stats.topLastWeek.map((r, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center bg-orange-50/50 p-5 rounded-2xl"
                      >
                        <span className="font-bold text-slate-700">
                          {i + 1}. {r.name}
                        </span>
                        <span className="font-black italic text-[var(--rbs-orange)]">
                          {r.count}x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: BUILDINGS & ROOMS (Heilige Regel: 1:1 Wide-Card) */}
          {(activeTab === "buildings" || activeTab === "rooms") && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <header className="flex justify-between items-center">
                <h1 className="rbs-page-title">
                  {activeTab === "buildings"
                    ? t("admin_title_buildings")
                    : t("admin_title_rooms")}
                </h1>
                <button
                  onClick={() => {
                    if (activeTab === "buildings") {
                      setCurrentBuilding({
                        name: "",
                        distance: 0,
                        floors: 1,
                        is_active: true,
                      });
                      setShowBuildingModal(true);
                    } else {
                      setCurrentRoom({
                        name: "",
                        capacity: 4,
                        floor: 0,
                        is_active: true,
                        equipment: [],
                        seating_arrangement: SEATING_OPTIONS[0],
                        building_id: buildings[0]?.id,
                      });
                      setShowRoomModal(true);
                    }
                  }}
                  className="rbs-btn-action"
                >
                  <PlusCircle size={18} />{" "}
                  {activeTab === "buildings"
                    ? t("admin_btn_add_building")
                    : t("admin_btn_add_room")}
                </button>
              </header>
              <div className="rbs-admin-grid">
                {(activeTab === "buildings" ? buildings : rooms).map((item) => (
                  <div key={item.id} className="rbs-wide-card">
                    <div className="flex items-center gap-6 min-w-0 text-left">
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            className="w-full h-full object-cover"
                          />
                        ) : activeTab === "buildings" ? (
                          <Home size={28} className="text-slate-300" />
                        ) : (
                          <Monitor size={28} className="text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black italic uppercase text-[var(--rbs-blue)] text-lg truncate">
                          {item.name}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          {activeTab === "buildings"
                            ? `${item.distance} Min • ${item.floors} OG`
                            : `${buildings.find((b) => b.id === item.building_id)?.name} • ${item.floor}. OG`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (activeTab === "buildings") {
                            setCurrentBuilding(item);
                            setShowBuildingModal(true);
                          } else {
                            setCurrentRoom(item);
                            setShowRoomModal(true);
                          }
                        }}
                        className="p-3 text-slate-300 hover:text-[var(--rbs-blue)] transition"
                      >
                        <Edit3 size={20} />
                      </button>
                      <button
                        onClick={() => toggleStatus(activeTab as any, item)}
                        className={`p-3 transition ${item.is_active ? "text-slate-200 hover:text-red-500" : "text-red-500 hover:text-green-500"}`}
                      >
                        <Power size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: USERS (Heilige Regel: 1:1 Admin-Table) */}
          {activeTab === "users" && (
            <div className="space-y-8 animate-in fade-in duration-500 text-left">
              <header className="flex justify-between items-center">
                <h1 className="rbs-page-title">{t("admin_sidebar_users")}</h1>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="rbs-btn-action"
                >
                  <UserPlus size={18} /> {t("admin_btn_add_user")}
                </button>
              </header>
              <div className="rbs-admin-table-container overflow-x-auto">
                <table className="rbs-admin-table">
                  <thead>
                    <tr>
                      <th>{t("admin_label_name")}</th>
                      <th>{t("admin_label_email")}</th>
                      <th>{t("admin_label_admin")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => (
                      <tr key={p.id}>
                        <td className="font-bold text-slate-700">
                          {p.first_name} {p.last_name}
                        </td>
                        <td className="text-slate-400 font-medium">
                          {p.email}
                        </td>
                        <td>
                          <span
                            className={`px-4 py-1 rounded-full text-[10px] font-black italic ${p.is_admin ? "bg-[var(--rbs-blue)] text-white" : "bg-slate-100 text-slate-400"}`}
                          >
                            {p.is_admin ? "ADMIN" : "USER"}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => {
                              setEditUser(p);
                              setShowUserEditModal(true);
                            }}
                            className="text-slate-300 hover:text-[var(--rbs-blue)] p-2 transition"
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
          )}
        </div>
      </main>

      {/* MODALE (Heilige Regel: Lückenlos erhalten) */}
      <RoomModal
        show={showRoomModal}
        room={currentRoom}
        isCombi={isCombi}
        combiParts={combiParts}
        buildings={buildings}
        rooms={rooms}
        equipmentList={equipmentList}
        SEATING_OPTIONS={SEATING_OPTIONS}
        onClose={() => setShowRoomModal(false)}
        onSave={handleSaveRoom}
        onChange={setCurrentRoom}
        onCombiChange={setIsCombi}
        onCombiPartsChange={setCombiParts}
        t={t}
        getTrans={getTrans}
        getEquipmentIcon={getEquipmentIcon}
        lang={lang}
        modalTitle={t("admin_sidebar_rooms")}
        modalSubtitle={
          currentRoom?.id ? t("label_edit_booking") : t("admin_btn_add_room")
        }
      />
      <BuildingModal
        show={showBuildingModal}
        building={currentBuilding}
        onClose={() => setShowBuildingModal(false)}
        onSave={handleSaveBuilding}
        onChange={setCurrentBuilding}
        t={t}
      />
      <UserModals
        showEdit={showUserEditModal}
        showAdd={showAddUserModal}
        editUser={editUser}
        newUser={newUser}
        onCloseEdit={() => setShowUserEditModal(false)}
        onCloseAdd={() => setShowAddUserModal(false)}
        onUpdateUser={handleUpdateUser}
        onCreateUser={handleCreateUser}
        onEditChange={setEditUser}
        onNewChange={setNewUser}
        t={t}
      />
    </div>
  );
}
