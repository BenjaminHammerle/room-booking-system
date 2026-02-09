"use client";

// react und hooks

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
  Armchair,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import "./BookingModal.css";

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

// booking modal komponente
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
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("08:00");
  const [duration, setDuration] = useState(1);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(1);
  const [isExtending, setIsExtending] = useState(false);
  const [weeksToAdd, setWeeksToAdd] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      if (mode === "edit" && booking) {
        setSelectedDate(booking.booking_date);
        setSelectedTime(booking.start_time);
        setDuration(booking.duration / 60);
      } else {
        setSelectedDate(initialDate || new Date().toLocaleDateString("en-CA"));
        setSelectedTime(initialTime || "08:00");
        setDuration(1);
      }
      setIsRecurring(false);
      setIsExtending(false);
    }
  }, [isOpen, mode, booking, initialDate, initialTime]);

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

  const getConflictRoomIds = (r: any): string[] => {
    if (!r) return [];
    if (!r.room_combi_id) return [r.id];
    const c = r.room_combi;
    if (!c) return [r.id];
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

  const findConflict = (
    checkBookings: any[],
    roomIds: string[],
    date: string,
    startTime: string,
    durHours: number,
  ) => {
    const reqStart = timeToMinutes(startTime);
    const reqEnd = reqStart + Math.round(durHours * 60);

    return checkBookings.find((b) => {
      if (
        b.status !== BOOKING_STATUS.ACTIVE ||
        b.booking_date !== date ||
        !roomIds.includes(b.room_id)
      )
        return false;
      if (mode === "edit" && b.id === booking?.id) return false;

      const bStart = timeToMinutes(b.start_time);
      const bEnd = bStart + b.duration;

      return reqStart < bEnd && bStart < reqEnd;
    });
  };

  const isAnyRoomOccupied = (
    roomIds: string[],
    date: string,
    startTime: string,
    dur: number,
  ) => {
    return !!findConflict(bookings, roomIds, date, startTime, dur);
  };

  const getSeriesPlan = () => {
    if (!selectedDate || selectedDate === "") return [];
    const plan = [];
    const currentRoom = room || rooms.find((r) => r.id === booking?.room_id);
    if (!currentRoom) return [];

    const reqCap = parseInt(minCapacity) || 0;
    const iterations =
      mode === "create"
        ? isRecurring
          ? recurringWeeks
          : 1
        : isExtending
          ? weeksToAdd
          : 0;
    const startIndex = mode === "edit" && isExtending ? 1 : 0;
    const maxIndex =
      mode === "edit" && isExtending
        ? iterations + 1
        : mode === "edit"
          ? 1
          : iterations;

    let startDateAnchor = selectedDate;
    if (mode === "edit" && isExtending) {
      const lastBooking = relatedBookings[relatedBookings.length - 1];
      if (lastBooking) startDateAnchor = lastBooking.booking_date;
    }
    const baseDate = new Date(startDateAnchor);

    for (let i = startIndex; i < maxIndex; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i * 7);
      const curDate = d.toISOString().split("T")[0];
      const conflictIds = getConflictRoomIds(currentRoom);

      const conflictObj = findConflict(
        bookings,
        conflictIds,
        curDate,
        selectedTime,
        duration,
      );

      if (!conflictObj) {
        plan.push({ date: curDate, room: currentRoom, status: "ok" });
      } else {
        const isPrimary = i === 0;
        if (!isPrimary) {
          const foundAlt = rooms
            .filter(
              (r) =>
                r.building_id === currentRoom.building_id && 
                r.id !== currentRoom.id &&
                r.is_active &&
                r.capacity >= currentRoom.capacity 
            )
            .sort((a, b) => a.capacity - b.capacity)
            .find(
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
            conflictTime: conflictObj.start_time,
          });
        } else {
          plan.push({
            date: curDate,
            room: currentRoom,
            status: "conflict",
            conflictTime: conflictObj.start_time,
          });
        }
      }
    }
    return plan;
  };

  const handleSave = async () => {
    setLoading(true);
    setFeedback(null);
    const plan = getSeriesPlan();
    if (!plan || plan.length === 0) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayStr = new Date().toLocaleDateString("en-CA");

    const selStartMin = timeToMinutes(selectedTime);
    const selEndMin = Math.round(selStartMin + duration * 60);

    if (mode === "create") {
      if (selectedDate === todayStr && selStartMin < nowMin) {
        setFeedback({ type: "error", text: t("label_past_time_error") });
        setLoading(false);
        return;
      }
    } else {
      const isStarted =
        booking.booking_date < todayStr ||
        (booking.booking_date === todayStr &&
          timeToMinutes(booking.start_time) <= nowMin);
      if (isStarted) {
        if (
          selectedTime !== booking.start_time ||
          selectedDate !== booking.booking_date
        ) {
          setFeedback({ type: "error", text: t("label_past_time_error") });
          setLoading(false);
          return;
        }
        if (selectedDate === todayStr && selEndMin < nowMin) {
          setFeedback({ type: "error", text: t("label_past_time_error") });
          setLoading(false);
          return;
        }
      } else if (selectedDate === todayStr && selStartMin < nowMin) {
        setFeedback({ type: "error", text: t("label_past_time_error") });
        setLoading(false);
        return;
      }
      if (selEndMin < selStartMin + 15) {
        setFeedback({ type: "error", text: t("label_past_time_error") });
        setLoading(false);
        return;
      }
    }

    if (plan[0].status !== "ok") {
      onSuccess();
      setFeedback({ type: "error", text: t("no_room_available") });
      setLoading(false);
      return;
    }

    try {
      const { data: freshBookings, error: fetchError } = await supabase
        .from("bookings")
        .select("*")
        .eq("status", BOOKING_STATUS.ACTIVE)
        .in(
          "booking_date",
          plan.map((p) => p.date),
        );
      if (fetchError) throw fetchError;

      if (
        plan.some((p) =>
          findConflict(
            freshBookings,
            getConflictRoomIds(p.room),
            p.date,
            selectedTime,
            duration,
          ),
        )
      ) {
        onSuccess();
        setFeedback({ type: "error", text: t("no_room_available") });
        setLoading(false);
        return;
      }

      const code =
        booking?.booking_code ||
        Math.random().toString(36).substring(2, 8).toUpperCase();
      const dbDuration = Math.round(duration * 60);
      let error = null;

      if (mode === "edit") {
        const { error: editError } = await supabase
          .from("bookings")
          .update({
            booking_date: selectedDate,
            start_time: selectedTime,
            duration: dbDuration,
          })
          .eq("id", booking.id);
        error = editError;
        if (!error && isExtending && plan.length > 1) {
          const newEntries = plan.slice(1).map((p) => ({
            room_id: p.room.id,
            user_id: userId,
            booking_date: p.date,
            start_time: selectedTime,
            duration: dbDuration,
            user_email: userEmail,
            booking_code: code,
            status: BOOKING_STATUS.ACTIVE,
          }));
          error = (await supabase.from("bookings").insert(newEntries)).error;
        }
      } else {
        const newBookings = plan.map((p) => ({
          room_id: p.room.id,
          user_id: userId,
          booking_date: p.date,
          start_time: selectedTime,
          duration: dbDuration,
          user_email: userEmail,
          booking_code: code,
          status: BOOKING_STATUS.ACTIVE,
        }));
        error = (await supabase.from("bookings").insert(newBookings)).error;
      }

      if (error) setFeedback({ type: "error", text: t("label_booking_error") });
      else {
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

  const handleCancelInstanceInModal = async (id: string) => {
    if (!confirm(t("btn_cancel_single") + "?")) return;
    setLoading(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: BOOKING_STATUS.CANCELLED })
      .eq("id", id);
    if (!error) onSuccess();
    else setFeedback({ type: "error", text: t("label_booking_error") });
    setLoading(false);
  };

  if (!isOpen) return null;
  const currentRoomContext =
    room || rooms.find((r) => r.id === booking?.room_id);

  const currentConflict = findConflict(
    bookings,
    getConflictRoomIds(currentRoomContext),
    selectedDate,
    selectedTime,
    duration,
  );
  const todayStrForDisable = new Date().toLocaleDateString("en-CA");
  const isStartedForDisable =
    mode === "edit" &&
    (booking.booking_date < todayStrForDisable ||
      (booking.booking_date === todayStrForDisable &&
        timeToMinutes(booking.start_time) <=
          new Date().getHours() * 60 + new Date().getMinutes()));


  // modal rendern
  return (
    <div className="rbs-modal-overlay animate-in fade-in">
      <div className="rbs-modal-card animate-in zoom-in-95 overflow-hidden">
        {feedback && (
          <div className="booking-feedback">
            <div
              className={`booking-feedback-card ${feedback.type === "success" ? "booking-feedback-success" : "booking-feedback-error"}`}
            >
              {feedback.type === "success" ? (
                <CheckCircle size={60} className="mb-2 animate-bounce" />
              ) : (
                <XCircle size={60} className="mb-2" />
              )}
              <h2 className="text-xl font-black uppercase italic tracking-tighter">
                {feedback.text}
              </h2>
              {feedback.type === "error" && (
                <button
                  onClick={() => {
                    onSuccess();
                    setFeedback(null);
                  }}
                  className="mt-8 px-8 py-3 bg-white text-red-600 font-bold rounded-full uppercase text-xs"
                >
                  {t("archiv_back")}
                </button>
              )}
            </div>
          </div>
        )}
        <div className="rbs-modal-header text-white">
          <div className="flex flex-col text-left gap-1">
            <p className="rbs-modal-subtitle">
              {mode === "edit"
                ? t("label_edit_booking")
                : t("label_new_booking")}
            </p>
            <h3 className="rbs-modal-title">{currentRoomContext?.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="bg-white/10 p-4 rounded-full hover:rotate-90 transition-all"
          >
            <X size={32} />
          </button>
        </div>
        <div className="rbs-modal-body">
          <div className="booking-form-group">
            <label className="rbs-label">{t("header_date")}</label>
            <div className='relatve'><input
              type="date"
              value={selectedDate}
              min={todayStrForDisable}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={isStartedForDisable}
              className="rbs-input !relative"
            /></div>
          </div>
          <div className="booking-form-grid">
            <div className="booking-form-group">
              <label className="rbs-label">{t("modal_time")}</label>
              <div className="rbs-time-picker">
                <Clock size={24} className="text-green-600" />
                <select
                  value={selectedTime.split(":")[0]}
                  onChange={(e) =>
                    setSelectedTime(
                      `${e.target.value}:${selectedTime.split(":")[1]}`,
                    )
                  }
                  disabled={isStartedForDisable}
                  className="rbs-time-select"
                >
                  {Array.from({ length: 17 }, (_, i) =>
                    (i + 7).toString().padStart(2, "0"),
                  ).map((h) => (
                    <option
                      key={h}
                      value={h}
                      disabled={
                        selectedDate === todayStrForDisable &&
                        parseInt(h) < new Date().getHours()
                      }
                    >
                      {h}
                    </option>
                  ))}
                </select>
                <span className="rbs-time-colon">:</span>
                <select
                  value={selectedTime.split(":")[1]}
                  onChange={(e) =>
                    setSelectedTime(
                      `${selectedTime.split(":")[0]}:${e.target.value}`,
                    )
                  }
                  disabled={isStartedForDisable}
                  className="rbs-time-select"
                >
                  {["00", "15", "30", "45"].map((m) => (
                    <option
                      key={m}
                      value={m}
                      disabled={
                        selectedDate === todayStrForDisable &&
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
            <div className="booking-form-group">
              <label className="rbs-label">{t("label_ebene_end")}</label>
              <div className="rbs-time-picker">
                <CheckCircle2 size={24} className="text-orange-500" />
                <select
                  value={getEndTimeParts(selectedTime, duration).hh}
                  onChange={(e) => {
                    const currentEndMin = parseInt(
                      getEndTimeParts(selectedTime, duration).mm,
                    );
                    const newEndTotal =
                      parseInt(e.target.value) * 60 + currentEndMin;
                    const startTotal = timeToMinutes(selectedTime);
                    setDuration(
                      parseFloat(((newEndTotal - startTotal) / 60).toFixed(4)),
                    );
                  }}
                  className="rbs-time-select"
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
                <span className="rbs-time-colon">:</span>
                <select
                  value={getEndTimeParts(selectedTime, duration).mm}
                  onChange={(e) => {
                    const currentEndHH = parseInt(
                      getEndTimeParts(selectedTime, duration).hh,
                    );
                    const newEndTotal =
                      currentEndHH * 60 + parseInt(e.target.value);
                    const startTotal = timeToMinutes(selectedTime);
                    setDuration(
                      parseFloat(((newEndTotal - startTotal) / 60).toFixed(4)),
                    );
                  }}
                  className="rbs-time-select"
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
            className={`rbs-status-badge ${currentConflict ? "rbs-status-conflict" : "rbs-status-available"}`}
          >
            {currentConflict ? (
              <AlertCircle size={24} />
            ) : (
              <CheckCircle2 size={24} />
            )}
            <span className="font-black uppercase text-sm tracking-wide">
              {currentConflict
                ? `${t("label_status_conflict")} - ${currentConflict.start_time}`
                : `${t("status_free")} ${getEndTimeParts(selectedTime, duration).hh}:${getEndTimeParts(selectedTime, duration).mm}`}
            </span>
          </div>

          <div className="mt-8 pt-8 border-t border-dashed">
            <label className="recurring-toggle">
              <input
                type="checkbox"
                checked={mode === "create" ? isRecurring : isExtending}
                onChange={(e) =>
                  mode === "create"
                    ? setIsRecurring(e.target.checked)
                    : setIsExtending(e.target.checked)
                }
              />
              <span className="font-bold text-sm">
                {mode === "create"
                  ? t("label_recurring")
                  : t("label_extend_series")}
              </span>
            </label>
            {((mode === "create" && isRecurring) ||
              (mode === "edit" &&
                (relatedBookings.length > 1 || isExtending))) && (
              <div className="res-extension-box">
                <div className="res-extension-input-wrapper">
                  <label className="rbs-label">{t("label_weeks")}</label>
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
                    className="rbs-number-input-lg"
                  />
                </div>
                <div className="res-extension-text-group">
                  <p className="font-bold text-sm text-[var(--rbs-blue)]">
                    {t("label_series_preview")}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500">
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

  // modal rendern
                      return (
                        <div
                          key={b.id}
                          className={`series-grid series-data-row border-l-4 ${isCurrent ? "bg-orange-50 border-l-[var(--rbs-orange)] shadow-sm" : "opacity-40 grayscale border-l-slate-300"}`}
                        >
                          <div
                            data-label={t("header_date")}
                            className={isCurrent ? "font-black" : ""}
                          >
                            {new Date(
                              isCurrent ? selectedDate : b.booking_date,
                            ).toLocaleDateString(lang, {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                            })}
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
                            <span
                              className={
                                isCurrent
                                  ? "text-[var(--rbs-orange)] font-black uppercase text-[8px]"
                                  : "text-[8px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded"
                              }
                            >
                              {isCurrent
                                ? t("label_editing")
                                : t("label_existing")}
                            </span>
                            {!isCurrent && (
                              <button
                                onClick={() =>
                                  handleCancelInstanceInModal(b.id)
                                }
                                className="p-1 hover:text-red-600 transition"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {getSeriesPlan().map((p, i) => {
                    if (mode === "edit" && i === 0) return null;
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

  // modal rendern
                    return (
                      <div
                        key={`preview-${i}`}
                        className={`series-grid series-data-row border-l-4 ${p.status === "conflict" ? "bg-red-50 border-l-red-500" : p.status === "alternative" ? "bg-red-50/50 border-l-red-400" : mode === "create" && i === 0 ? "bg-orange-50 border-l-[var(--rbs-orange)]" : "bg-green-50/30 border-l-green-400"}`}
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
                          ) : p.status === "alternative" ? (
                            <AlertCircle size={14} className="text-red-500" />
                          ) : (
                            <CheckCircle size={14} className="text-green-600" />
                          )}
                          <span
                            className={`font-bold ${p.status === "conflict" || p.status === "alternative" ? "text-red-600" : "text-slate-700"}`}
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
                            <span className="series-status-badge series-status-conflict">
                              CONFLICT @ {p.conflictTime}
                            </span>
                          ) : (
                            <>
                              {p.status === "alternative" && (
                                <span className="series-status-badge series-status-active">
                                  Best Match
                                </span>
                              )}
                              {p.room?.seating_arrangement && (
                                <span className="series-status-badge series-status-pending">
                                  <Armchair size={10} />
                                  <span>{t(p.room.seating_arrangement)}</span>
                                </span>
                              )}
                              {extra.map((id) => (
                                <span
                                  key={id}
                                  className="series-status-badge series-status-confirmed"
                                >
                                  {getEquipmentIcon(id)}
                                  <span>
                                    {id === "accessible"
                                      ? t("label_accessible")
                                      : t("equip_" + id)}
                                  </span>
                                </span>
                              ))}
                              {missing.map((id) => (
                                <span
                                  key={id}
                                  className="series-status-badge series-status-cancelled"
                                >
                                  {getEquipmentIcon(id)}
                                  <span>
                                    {id === "accessible"
                                      ? t("label_accessible")
                                      : t("equip_" + id)}
                                  </span>
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
          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="rbs-modal-btn-secondary"
            >
              <X size={20} />
              {t("archiv_back")}
            </button>
            <button
              disabled={loading}
              onClick={handleSave}
              className="rbs-btn-main py-4 text-base shadow-xl"
            >
              <Save size={28} />{" "}
              {loading
                ? "..."
                : mode === "edit"
                  ? t("save_btn")
                  : t("btn_reserve")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}