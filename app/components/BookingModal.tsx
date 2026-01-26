"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Save,
  Users,
  Layers,
  Accessibility,
  XCircle,
  PlusCircle,
  Repeat,
  Info,
  CheckCircle,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import "./BookingModal.css";

// import der zentralen architektur für konstanten, icons und helfer-logik
import { APP_CONFIG, BOOKING_STATUS, Language } from "@/lib/constants";
import { getEquipmentIcon } from "@/lib/icons";
import { timeToMinutes, getEndTimeParts, getTrans } from "@/lib/utils";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  booking?: any;
  room?: any;
  rooms: any[];
  bookings: any[];
  equipmentList: any[];
  buildings: any[];
  selectedEquipment: string[];
  minCapacity: string;
  lang: Language;
  t: (key: string) => string;
  onSuccess: () => void;
  userId: string;
  userEmail: string;
  initialDate?: string;
  initialTime?: string;
}

export default function BookingModal({
  isOpen,
  onClose,
  mode,
  booking,
  room,
  rooms,
  bookings,
  equipmentList,
  lang,
  t,
  onSuccess,
  userId,
  buildings,
  selectedEquipment,
  minCapacity,
  userEmail,
  initialDate,
  initialTime,
}: BookingModalProps) {
  // lokale zustandsverwaltung für formularfelder und serien-logik
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("08:00");
  const [duration, setDuration] = useState(1);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(1);
  const [isExtending, setIsExtending] = useState(false);
  const [weeksToAdd, setWeeksToAdd] = useState(1);
  const [loading, setLoading] = useState(false);

  // zustand für visuelles feedback (erfolg/fehler) nach datenbank-aktionen
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // initialisierung und synchronisation der felder beim öffnen des modals
  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      if (mode === "edit" && booking) {
        setSelectedDate(booking.booking_date);
        setSelectedTime(booking.start_time);
        setDuration(booking.duration);
      } else {
        setSelectedDate(initialDate || new Date().toISOString().split("T")[0]);
        setSelectedTime(initialTime || "08:00");
        setDuration(1);
      }
      setIsRecurring(false);
      setIsExtending(false);
    }
  }, [isOpen, mode, booking, initialDate, initialTime]);

  // ermittlung aller zugehörigen buchungen einer serie via booking_code
  const relatedBookings = useMemo(() => {
    if (!booking?.booking_code) return [];
    return bookings
      .filter(
        (b) =>
          b.booking_code === booking.booking_code &&
          b.status === BOOKING_STATUS.ACTIVE,
      )
      .sort((a, b) => a.booking_date.localeCompare(b.booking_date));
  }, [booking, bookings]);

  // stornierung einer einzelnen instanz innerhalb einer serie
  const handleCancelInstanceInModal = async (id: string) => {
    if (!confirm(t("btn_cancel_single") + "?")) return;
    setLoading(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: BOOKING_STATUS.CANCELLED })
      .eq("id", id);

    if (!error) {
      onSuccess();
    } else {
      setFeedback({ type: "error", text: t("label_booking_error") });
    }
    setLoading(false);
  };

  // logik für kombiräume: liefert alle ids, die zeitgleich blockiert werden müssen
  const getConflictRoomIds = (r: any): string[] => {
    if (!r) return [];
    if (!r.room_combi) return [r.id];
    const c = r.room_combi;
    return r.id === c.room_id_0
      ? Array.from(
          new Set(
            [c.room_id_0, c.room_id_1, c.room_id_2, c.room_id_3].filter(
              Boolean,
            ),
          ),
        )
      : [r.id, c.room_id_0];
  };

  // prüfung auf zeitliche überschneidungen unter berücksichtigung von kombiräumen
  const isAnyRoomOccupied = (
    roomIds: string[],
    date: string,
    startTime: string,
    dur: number,
  ) => {
    const reqStart = timeToMinutes(startTime);
    const reqEnd = reqStart + dur * 60;
    return bookings.some((b) => {
      if (
        b.status !== BOOKING_STATUS.ACTIVE ||
        b.booking_date !== date ||
        !roomIds.includes(b.room_id)
      )
        return false;
      if (mode === "edit" && b.id === booking?.id) return false;
      const bStart = timeToMinutes(b.start_time);
      const bEnd = bStart + b.duration * 60;
      return reqStart < bEnd && bStart < reqEnd;
    });
  };

  // berechnet den plan für serien inklusive automatischer alternativ-suche (Best Match)
  const getSeriesPlan = () => {
    if (!selectedDate || selectedDate === "") return [];
    const plan = [];
    const currentRoom = room || rooms.find((r) => r.id === booking?.room_id);
    if (!currentRoom) return [];

    const reqCap = parseInt(minCapacity) || 0;

    let iterations = 0;
    let startDateAnchor = selectedDate;

    if (mode === "create") {
      iterations = isRecurring ? recurringWeeks : 1;
    } else {
      iterations = isExtending ? weeksToAdd : 0;
      if (isExtending) {
        const lastBooking = relatedBookings[relatedBookings.length - 1];
        if (lastBooking) startDateAnchor = lastBooking.booking_date;
      }
    }

    const baseDate = new Date(startDateAnchor);
    if (isNaN(baseDate.getTime())) return [];

    const startIndex = mode === "edit" && isExtending ? 1 : 0;
    const maxIndex =
      mode === "edit" && isExtending ? iterations + 1 : iterations;

    for (let i = startIndex; i < maxIndex; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i * 7);
      const curDate = d.toISOString().split("T")[0];

      if (mode === "create" && !isRecurring && i > 0) break;

      const conflictIds = getConflictRoomIds(currentRoom);

      if (!isAnyRoomOccupied(conflictIds, curDate, selectedTime, duration)) {
        plan.push({ date: curDate, room: currentRoom, status: "ok" });
      } else {
        const alternatives = rooms
          .filter(
            (r) =>
              r.building_id === currentRoom.building_id &&
              r.id !== currentRoom.id &&
              r.is_active &&
              r.capacity >= reqCap &&
              selectedEquipment.every((eqId) => r.equipment?.includes(eqId)),
          )
          .sort((a, b) => a.capacity - b.capacity);

        const foundAlt = alternatives.find(
          (alt) =>
            !isAnyRoomOccupied(
              getConflictRoomIds(alt),
              curDate,
              selectedTime,
              duration,
            ),
        );

        plan.push({
          date: curDate,
          room: foundAlt || null,
          status: foundAlt ? "alternative" : "conflict",
        });
      }
    }
    return plan;
  };

  const handleSave = async () => {
    setLoading(true);
    setFeedback(null);
    const plan = getSeriesPlan();

    const now = new Date();
    if (
      selectedDate === now.toISOString().split("T")[0] &&
      timeToMinutes(selectedTime) < now.getHours() * 60 + now.getMinutes()
    ) {
      setFeedback({ type: "error", text: t("label_past_time_error") });
      setLoading(false);
      return;
    }

    if (plan.some((p) => p.status === "conflict")) {
      alert(t("alert_resolve_conflicts"));
      setLoading(false);
      return;
    }

    const code =
      booking?.booking_code ||
      Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      let error = null;
      if (mode === "edit") {
        const res = await supabase
          .from("bookings")
          .update({
            booking_date: selectedDate,
            start_time: selectedTime,
            duration,
          })
          .eq("id", booking.id);
        error = res.error;

        if (!error && isExtending) {
          const newEntries = plan.map((p) => ({
            room_id: p.room.id,
            user_id: userId,
            booking_date: p.date,
            start_time: selectedTime,
            duration,
            user_email: userEmail,
            booking_code: code,
            status: BOOKING_STATUS.ACTIVE,
          }));
          const resExt = await supabase.from("bookings").insert(newEntries);
          error = resExt.error;
        }
      } else {
        const newBookings = plan.map((p) => ({
          room_id: p.room.id,
          user_id: userId,
          booking_date: p.date,
          start_time: selectedTime,
          duration,
          user_email: userEmail,
          booking_code: code,
          status: BOOKING_STATUS.ACTIVE,
        }));
        const resCreate = await supabase.from("bookings").insert(newBookings);
        error = resCreate.error;
      }

      if (error) {
        setFeedback({ type: "error", text: t("label_booking_error") });
      } else {
        setFeedback({ type: "success", text: t("label_booking_success") });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err) {
      setFeedback({ type: "error", text: t("label_booking_error") });
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  const currentRoomContext =
    room || rooms.find((r) => r.id === booking?.room_id);
  const isOccupiedNow = isAnyRoomOccupied(
    getConflictRoomIds(currentRoomContext),
    selectedDate,
    selectedTime,
    duration,
  );
  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  return (
    <div className="mci-modal-overlay animate-in fade-in">
      <div className="mci-modal-card animate-in zoom-in-95 overflow-hidden">
        {feedback && (
          <div
            className={`absolute inset-0 z-[100] flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 ${feedback.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
          >
            {feedback.type === "success" ? (
              <CheckCircle size={80} className="mb-6 animate-bounce" />
            ) : (
              <XCircle size={80} className="mb-6" />
            )}
            <h2 className="text-3xl font-black uppercase italic tracking-tighter">
              {feedback.text}
            </h2>
            {feedback.type === "error" && (
              <button
                onClick={() => setFeedback(null)}
                className="mt-8 px-8 py-3 bg-white text-red-600 font-bold rounded-full uppercase text-xs"
              >
                zurück
              </button>
            )}
          </div>
        )}

        <div className="mci-modal-header text-white">
          <div className="flex flex-col text-left">
            <p className="text-xs font-black opacity-70 uppercase italic">
              {mode === "edit"
                ? t("label_edit_booking")
                : t("label_new_booking")}
            </p>
            <h3 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">
              {currentRoomContext?.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="bg-white/10 p-4 rounded-full hover:rotate-90 transition-all"
          >
            <X size={32} />
          </button>
        </div>

        <div className="mci-modal-body">
          <div className="ebene-wrapper">
            <label className="mci-label">{t("header_date")}</label>
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mci-input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="ebene-wrapper">
              <label className="mci-label">{t("modal_time")}</label>
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl shadow-inner text-[#004a87]">
                <Clock size={20} className="text-blue-500 ml-2" />
                <select
                  value={selectedTime.split(":")[0]}
                  onChange={(e) =>
                    setSelectedTime(
                      `${e.target.value}:${selectedTime.split(":")[1]}`,
                    )
                  }
                  className="bg-transparent font-black text-2xl outline-none cursor-pointer"
                >
                  {Array.from({ length: 17 }, (_, i) =>
                    (i + 7).toString().padStart(2, "0"),
                  ).map((h) => (
                    <option
                      key={h}
                      value={h}
                      disabled={isToday && parseInt(h) < new Date().getHours()}
                    >
                      {h}
                    </option>
                  ))}
                </select>
                <span className="font-black text-2xl">:</span>
                <select
                  value={selectedTime.split(":")[1]}
                  onChange={(e) =>
                    setSelectedTime(
                      `${selectedTime.split(":")[0]}:${e.target.value}`,
                    )
                  }
                  className="bg-transparent font-black text-2xl outline-none cursor-pointer"
                >
                  {["00", "15", "30", "45"].map((m) => (
                    <option
                      key={m}
                      value={m}
                      disabled={
                        isToday &&
                        parseInt(selectedTime.split(":")[0]) ===
                          new Date().getHours() &&
                        parseInt(m) <= new Date().getMinutes()
                      }
                    >
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="ebene-wrapper">
              <label className="mci-label">{t("label_ebene_end")}</label>
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl shadow-inner text-[#004a87]">
                <CheckCircle2 size={20} className="text-orange-500 ml-2" />
                <select
                  value={getEndTimeParts(selectedTime, duration).hh}
                  onChange={(e) => {
                    const newTotal =
                      parseInt(e.target.value) * 60 +
                      parseInt(getEndTimeParts(selectedTime, duration).mm);
                    setDuration((newTotal - timeToMinutes(selectedTime)) / 60);
                  }}
                  className="bg-transparent font-black text-2xl outline-none cursor-pointer"
                >
                  {Array.from({ length: 17 }, (_, i) =>
                    (i + 7).toString().padStart(2, "0"),
                  ).map((h) => (
                    <option
                      key={h}
                      value={h}
                      disabled={
                        parseInt(h) < parseInt(selectedTime.split(":")[0])
                      }
                    >
                      {h}
                    </option>
                  ))}
                </select>
                <span className="font-black text-2xl">:</span>
                <select
                  value={getEndTimeParts(selectedTime, duration).mm}
                  onChange={(e) => {
                    const newTotal =
                      parseInt(getEndTimeParts(selectedTime, duration).hh) *
                        60 +
                      parseInt(e.target.value);
                    setDuration((newTotal - timeToMinutes(selectedTime)) / 60);
                  }}
                  className="bg-transparent font-black text-2xl outline-none cursor-pointer"
                >
                  {["00", "15", "30", "45"].map((m) => (
                    <option
                      key={m}
                      value={m}
                      disabled={
                        parseInt(getEndTimeParts(selectedTime, duration).hh) *
                          60 +
                          parseInt(m) <=
                        timeToMinutes(selectedTime)
                      }
                    >
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div
            className={`p-5 rounded-2xl font-bold flex items-center gap-4 border ${isOccupiedNow ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-700 border-green-100"}`}
          >
            {isOccupiedNow ? (
              <AlertCircle size={24} />
            ) : (
              <CheckCircle2 size={24} />
            )}
            <span className="uppercase text-xs font-black tracking-widest italic">
              {isOccupiedNow
                ? t("label_status_conflict")
                : t("label_status_free")}
            </span>
          </div>

          <div className="res-extension-wrapper mt-8 pt-8 border-t border-dashed">
            <label className="flex items-center gap-4 cursor-pointer mb-6 group">
              <input
                type="checkbox"
                checked={mode === "create" ? isRecurring : isExtending}
                onChange={(e) =>
                  mode === "create"
                    ? setIsRecurring(e.target.checked)
                    : setIsExtending(e.target.checked)
                }
                className="w-6 h-6 accent-[var(--mci-blue)] rounded"
              />
              <span className="text-sm font-black uppercase text-[var(--mci-blue)] italic group-hover:text-[var(--mci-orange)] transition-colors">
                {mode === "create"
                  ? t("label_recurring")
                  : t("label_extend_series")}
              </span>
            </label>

            {((mode === "create" && isRecurring) ||
              (mode === "edit" && isExtending)) && (
              <div className="res-extension-box animate-in slide-in-from-top-2">
                <div className="flex flex-col gap-2 shrink-0">
                  <label className="mci-label !ml-0 !mb-0 text-orange-400">
                    {t("label_weeks")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={APP_CONFIG.MAX_RECURRING_WEEKS}
                    value={mode === "create" ? recurringWeeks : weeksToAdd}
                    onChange={(e) =>
                      mode === "create"
                        ? setRecurringWeeks(parseInt(e.target.value))
                        : setWeeksToAdd(parseInt(e.target.value))
                    }
                    className="mci-number-input-lg"
                  />
                </div>
                <div className="flex flex-col gap-1 border-l-2 border-orange-100 pl-8 py-2 text-left">
                  <p className="text-xl font-black text-[var(--mci-blue)] uppercase italic">
                    {t("label_series_preview")}
                  </p>
                  <p className="text-[11px] font-bold text-orange-400 uppercase tracking-tight">
                    {t("hint_extension_preview")}
                  </p>
                </div>
              </div>
            )}

            {((mode === "create" && isRecurring) || mode === "edit") && (
              <div className="series-list-container mt-6">
                <div className="series-grid series-header-row hidden md:grid">
                  <div>{t("header_date")}</div>
                  <div>{t("header_room")}</div>
                  <div>{t("header_floor")}</div>
                  <div>{t("header_seats")}</div>
                  <div>{t("header_features")}</div>
                </div>
                <div className="max-h-60 overflow-y-auto hide-scrollbar space-y-2">
                  {mode === "edit" &&
                    relatedBookings.map((b) => {
                      const isCurrent = b.id === booking.id;
                      const r = rooms.find((rm) => rm.id === b.room_id);
                      return (
                        <div
                          key={b.id}
                          className={`series-grid series-data-row border-l-4 ${isCurrent ? "bg-orange-50 border-l-[var(--mci-orange)] shadow-sm" : "opacity-40 grayscale border-l-slate-300"}`}
                        >
                          <div
                            data-label={t("header_date")}
                            className={isCurrent ? "font-black" : ""}
                          >
                            {new Date(b.booking_date).toLocaleDateString(lang)}
                          </div>
                          <div
                            data-label={t("header_room")}
                            className="font-bold"
                          >
                            {r?.name}
                          </div>
                          <div data-label={t("header_floor")}>
                            {r?.floor}. OG
                          </div>
                          <div data-label={t("header_seats")}>
                            <Users size={12} className="inline mr-1" />
                            {r?.capacity}
                          </div>
                          <div
                            data-label={t("header_features")}
                            className="flex items-center justify-between gap-2"
                          >
                            {isCurrent ? (
                              <span className="text-[var(--mci-orange)] font-black uppercase text-[8px]">
                                {t("label_editing")}
                              </span>
                            ) : (
                              <span className="text-[8px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded">
                                {t("label_existing")}
                              </span>
                            )}
                            {!isCurrent && (
                              <button
                                onClick={() =>
                                  handleCancelInstanceInModal(b.id)
                                }
                                className="p-1 hover:text-red-600 transition"
                                title={t("btn_cancel_single")}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {getSeriesPlan().map((p, i) => {
                    // DIFF-LOGIK FÜR EQUIPMENT (V14 Punkt 4.C Erweiterung)
                    const originalFeatures = [
                      ...(currentRoomContext?.equipment || []),
                    ];
                    if (currentRoomContext?.accessible)
                      originalFeatures.push("accessible");

                    const currentFeatures = [...(p.room?.equipment || [])];
                    if (p.room?.accessible) currentFeatures.push("accessible");

                    const extra = currentFeatures.filter(
                      (id) => !originalFeatures.includes(id),
                    );
                    const missing = originalFeatures.filter(
                      (id) => !currentFeatures.includes(id),
                    );

                    const isFirstInCreate = mode === "create" && i === 0;

                    return (
                      <div
                        key={`preview-${i}`}
                        className={`series-grid series-data-row border-l-4 ${p.status === "conflict" ? "bg-red-50 border-l-red-500" : isFirstInCreate ? "bg-orange-50 border-l-[var(--mci-orange)]" : "bg-orange-50/20 border-l-orange-400"}`}
                      >
                        <div
                          data-label={t("header_date")}
                          className="font-bold"
                        >
                          {new Date(p.date).toLocaleDateString(lang, {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          })}
                        </div>
                        <div
                          data-label={t("header_room")}
                          className="flex items-center gap-2"
                        >
                          {p.status === "conflict" ? (
                            <XCircle size={14} className="text-red-500" />
                          ) : (
                            <PlusCircle size={14} className="text-orange-500" />
                          )}
                          <span
                            className={`font-bold ${p.status === "conflict" ? "text-red-600" : "text-slate-700"}`}
                          >
                            {p.room?.name || t("no_room_available")}
                          </span>
                        </div>
                        <div data-label={t("header_floor")}>
                          {p.room ? `${p.room.floor}. OG` : "-"}
                        </div>
                        <div
                          data-label={t("header_seats")}
                          className="flex items-center gap-1"
                        >
                          <Users size={12} />
                          {p.room?.capacity || 0}
                        </div>
                        <div
                          data-label={t("header_features")}
                          className="flex flex-wrap gap-1"
                        >
                          {p.status === "conflict" ? (
                            <span className="text-red-600 font-black uppercase text-[8px]">
                              CONFLICT
                            </span>
                          ) : (
                            <>
                              {p.status === "alternative" && (
                                <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase">
                                  Best Match
                                </span>
                              )}
                              {/* Anzeige zusätzlicher Features (GRÜN) */}
                              {extra.map((id) => (
                                <span
                                  key={id}
                                  className="bg-green-100 text-green-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1"
                                >
                                  +{getEquipmentIcon(id)}
                                  {id === "accessible"
                                    ? t("label_accessible")
                                    : t("equip_" + id)}
                                </span>
                              ))}
                              {/* Anzeige fehlender Features (ROT + DURCHGESTRICHEN) */}
                              {missing.map((id) => (
                                <span
                                  key={id}
                                  className="bg-red-100 text-red-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase line-through flex items-center gap-1"
                                >
                                  -{getEquipmentIcon(id)}
                                  {id === "accessible"
                                    ? t("label_accessible")
                                    : t("equip_" + id)}
                                </span>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            disabled={loading}
            onClick={handleSave}
            className="btn-mci-main mt-8 w-full py-6 text-xl"
          >
            <Save size={28} />{" "}
            {loading
              ? "..."
              : mode === "edit"
                ? t("save_btn")
                : t("modal_btn_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
