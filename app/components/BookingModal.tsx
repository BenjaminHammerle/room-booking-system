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
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  lang: "de" | "en";
  t: (key: string) => string;
  onSuccess: () => void;
  userId: string;
  userEmail: string;
  initialDate?: string; // NEU: Damit der Filterwert übernommen wird
  initialTime?: string; // NEU: Damit der Filterwert übernommen wird
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
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("08:00");
  const [duration, setDuration] = useState(1);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(1);
  const [loading, setLoading] = useState(false);

  // Hilfsfunktion: Distanz zwischen zwei Koordinaten in Metern (Haversine)
  const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371e3; // Radius Erde in Metern
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Synchronisation beim Öffnen
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && booking) {
        setSelectedDate(booking.booking_date);
        setSelectedTime(booking.start_time);
        setDuration(booking.duration);
      } else {
        // Nutze Filterwerte oder Fallback auf "jetzt"
        setSelectedDate(initialDate || new Date().toISOString().split("T")[0]);
        setSelectedTime(initialTime || "08:00");
        setDuration(1);
      }
      setIsRecurring(false);
    }
  }, [isOpen, mode, booking, initialDate, initialTime]);

  // --- HELPERS ---

  const [isExtending, setIsExtending] = useState(false);
  const [extraWeeks, setExtraWeeks] = useState(1);
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = (timeStr || "00:00").split(":").map(Number);
    return h * 60 + m;
  };

  const getEndTimeParts = (startTime: string, dur: number) => {
    const totalMinutes = timeToMinutes(startTime) + dur * 60;
    return {
      hh: Math.floor(totalMinutes / 60)
        .toString()
        .padStart(2, "0"),
      mm: (totalMinutes % 60).toString().padStart(2, "0"),
    };
  };

  const getConflictRoomIds = (r: any): string[] => {
    if (!r?.room_combi) return [r.id];
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
        b.status !== "active" ||
        b.booking_date !== date ||
        !roomIds.includes(b.room_id)
      )
        return false;
      if (mode === "edit" && b.id === booking?.id) return false;
      const bStart = timeToMinutes(b.start_time);
      return reqStart < bStart + b.duration * 60 && bStart < reqEnd;
    });
  };

  const getSeriesPlan = () => {
    const plan = [];
    const currentRoom = room || rooms.find((r) => r.id === booking?.room_id);
    const startBuilding = currentRoom?.building;
    const minCapNum = parseInt(minCapacity) || 0;

    // Berechnung der Iterationen:
    // Im Create-Modus: recurringWeeks
    // Im Edit-Modus: Bestehende Termine + extraWeeks (wenn isExtending aktiv)
    let iterations = isRecurring ? recurringWeeks : 1;
    let startDateAnchor = selectedDate;

    if (mode === "edit" && isExtending) {
      iterations = extraWeeks;
      // Wir starten die Berechnung 7 Tage nach dem LETZTEN Termin der Serie
      const lastBooking = relatedBookings[relatedBookings.length - 1];
      startDateAnchor = lastBooking.booking_date;
    }

    // Wenn wir im Edit-Modus sind und NUR die Vorschau der Erweiterung wollen:
    // (Die bestehenden Termine rendern wir separat über relatedBookings)
    for (
      let i = mode === "edit" ? 1 : 0;
      i < (mode === "edit" ? iterations + 1 : iterations);
      i++
    ) {
      const d = new Date(startDateAnchor);
      d.setDate(d.getDate() + i * 7);
      const curDate = d.toISOString().split("T")[0];

      if (
        !isAnyRoomOccupied(
          getConflictRoomIds(currentRoom),
          curDate,
          selectedTime,
          duration,
        )
      ) {
        plan.push({ date: curDate, room: currentRoom, status: "ok" });
      } else {
        // Alternativ-Suche (dein bestehender Code für Best Match...)
        const potentialRooms = rooms
          .filter(
            (r) =>
              r.building_id === currentRoom.building_id &&
              r.id !== currentRoom.id &&
              r.is_active &&
              r.capacity >= minCapNum,
          )
          .sort((a, b) => a.capacity - b.capacity);

        const foundAlt = potentialRooms.find(
          (r) =>
            !isAnyRoomOccupied(
              getConflictRoomIds(r),
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
  const [weeksToAdd, setWeeksToAdd] = useState(1);

  // Die neue Logik zum Anhängen von X Wochen
  const handleAddMoreWeeks = async () => {
    if (weeksToAdd < 1) return;
    setLoading(true);

    // Wir nehmen den letzten Termin der Serie als Ankerpunkt
    const lastBooking = relatedBookings[relatedBookings.length - 1];
    const lastDate = new Date(lastBooking.booking_date);
    const currentRoom = rooms.find(
      (r) => r.id === (booking?.room_id || room?.id),
    );

    const newBookings = [];

    for (let i = 1; i <= weeksToAdd; i++) {
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + i * 7);
      const dateStr = nextDate.toISOString().split("T")[0];

      // Prüfung: Ist der Stammraum frei?
      const conflictIds = getConflictRoomIds(currentRoom);
      const occupied = isAnyRoomOccupied(
        conflictIds,
        dateStr,
        selectedTime,
        duration,
      );

      if (!occupied) {
        newBookings.push({
          room_id: currentRoom.id,
          user_id: userId,
          booking_date: dateStr,
          start_time: selectedTime,
          duration: duration,
          user_email: userEmail,
          booking_code: booking.booking_code,
          status: "active",
        });
      } else {
        // Best Match Suche, falls Stammraum belegt
        const alt = rooms
          .filter(
            (r) =>
              r.building_id === currentRoom.building_id &&
              r.id !== currentRoom.id &&
              r.is_active &&
              r.capacity >= currentRoom.capacity && // Mindestens gleiche Kapazität
              !isAnyRoomOccupied(
                getConflictRoomIds(r),
                dateStr,
                selectedTime,
                duration,
              ),
          )
          .sort((a, b) => a.capacity - b.capacity)[0];

        if (alt) {
          newBookings.push({
            room_id: alt.id,
            user_id: userId,
            booking_date: dateStr,
            start_time: selectedTime,
            duration: duration,
            user_email: userEmail,
            booking_code: booking.booking_code,
            status: "active",
          });
        } else {
          alert(
            `Konflikt am ${dateStr}: Kein freier Ersatzraum gefunden. Vorgang abgebrochen.`,
          );
          setLoading(false);
          return;
        }
      }
    }

    const { error } = await supabase.from("bookings").insert(newBookings);
    if (!error) {
      setWeeksToAdd(1);
      onSuccess();
    }
    setLoading(false);
  };

  // Einzelnen Termin stornieren
  const handleCancelSingle = async (id: string) => {
    if (
      !confirm(
        t("archiv_confirm_cancel") || "Diesen Termin wirklich stornieren?",
      )
    )
      return;

    setLoading(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (!error) {
      onSuccess(); // Lädt Daten im Hintergrund neu
    }
    setLoading(false);
  };

  // Die Serie um eine Woche verlängern
  const handleExtendSeries = async () => {
    const lastBooking = relatedBookings[relatedBookings.length - 1];
    const nextDate = new Date(lastBooking.booking_date);
    nextDate.setDate(nextDate.getDate() + 7);
    const dateStr = nextDate.toISOString().split("T")[0];

    // Check ob der Raum am neuen Termin frei ist
    const currentRoom = rooms.find((r) => r.id === booking.room_id);
    if (
      isAnyRoomOccupied(
        getConflictRoomIds(currentRoom),
        dateStr,
        selectedTime,
        duration,
      )
    ) {
      alert("Der Raum ist am Folgetermin leider belegt!");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("bookings").insert({
      room_id: currentRoom.id,
      user_id: userId,
      booking_date: dateStr,
      start_time: selectedTime,
      duration: duration,
      user_email: userEmail,
      booking_code: booking.booking_code,
      status: "active",
    });

    if (!error) onSuccess();
    setLoading(false);
  };

  // Findet alle Buchungen, die zur gleichen Serie gehören (gleicher Code)
  const relatedBookings = useMemo(() => {
    if (!booking?.booking_code) return [];
    return bookings
      .filter(
        (b) => b.booking_code === booking.booking_code && b.status === "active",
      )
      .sort((a, b) => a.booking_date.localeCompare(b.booking_date));
  }, [booking, bookings]);

  const isSeries = relatedBookings.length > 1;

  // Initialisierung anpassen
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && booking) {
        setSelectedDate(booking.booking_date);
        setSelectedTime(booking.start_time);
        setDuration(booking.duration);
        // Wenn mehr als eine Buchung diesen Code hat, ist es eine Serie
        setIsRecurring(relatedBookings.length > 1);
      } else {
        setSelectedDate(initialDate || new Date().toISOString().split("T")[0]);
        setSelectedTime(initialTime || "08:00");
        setDuration(1);
        setIsRecurring(false);
      }
    }
  }, [isOpen, mode, booking, initialDate, initialTime, relatedBookings]);

  if (!isOpen) return null;

  const currentRoomContext =
    room || rooms.find((r) => r.id === booking?.room_id);
  const occ = currentRoomContext
    ? {
        isOccupied: isAnyRoomOccupied(
          getConflictRoomIds(currentRoomContext),
          selectedDate,
          selectedTime,
          duration,
        ),
        until: "belegt",
      }
    : { isOccupied: false, until: null };

  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const isToday = selectedDate === now.toISOString().split("T")[0];

  return (
    <div className="mci-modal-overlay animate-in fade-in">
      <div className="mci-modal-card animate-in zoom-in-95">
        <div className="mci-modal-header text-white">
          <div className="flex flex-col">
            <p className="text-xs font-black opacity-70 uppercase italic">
              {mode === "edit" ? t("label_edit_booking") : "New Booking"}
            </p>
            <h3 className="text-5xl font-black uppercase italic tracking-tighter">
              {currentRoomContext?.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="bg-white/10 p-5 rounded-full hover:rotate-90 transition-all"
          >
            <X size={36} />
          </button>
        </div>

        <div className="mci-modal-body">
          {/* EBENE 1: DATUM */}
          <div className="ebene-wrapper">
            <label className="mci-label">{t("label_ebene_date")}</label>
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mci-input"
            />
          </div>

          {/* EBENE 2: STARTZEIT (VERGANGENHEITSSPERRE) */}
          <div className="ebene-wrapper">
            <label className="mci-label">{t("label_ebene_start")}</label>
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl shadow-inner">
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
                ).map((h) => {
                  const isDisabled = isToday && parseInt(h) < currentHour;
                  return (
                    <option key={h} value={h} disabled={isDisabled}>
                      {h}
                    </option>
                  );
                })}
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
                {["00", "15", "30", "45"].map((m) => {
                  const isNowHour =
                    parseInt(selectedTime.split(":")[0]) === currentHour;
                  const isDisabled =
                    isToday && isNowHour && parseInt(m) <= currentMin;
                  return (
                    <option key={m} value={m} disabled={isDisabled}>
                      {m}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* EBENE 3: ENDZEIT */}
          <div className="ebene-wrapper">
            <label className="mci-label">{t("label_ebene_end")}</label>
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl shadow-inner">
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
                    parseInt(getEndTimeParts(selectedTime, duration).hh) * 60 +
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

          {/* EBENE 4: STATUS */}
          <div
            className={`p-4 rounded-2xl font-bold flex items-center gap-3 border ${occ.isOccupied ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-700 border-green-100"}`}
          >
            {occ.isOccupied ? (
              <AlertCircle size={20} />
            ) : (
              <CheckCircle2 size={20} />
            )}
            <span className="uppercase text-[10px] font-black tracking-widest italic">
              {occ.isOccupied
                ? t("label_status_conflict")
                : t("label_status_free")}
            </span>
          </div>

          {/* EBENE 5: RECURRING / EXTENSION (CONSOLIDATED) */}
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
                className="w-6 h-6 accent-[var(--mci-blue)] rounded cursor-pointer"
              />
              <span className="text-sm font-black uppercase text-[var(--mci-blue)] italic group-hover:text-[var(--mci-orange)] transition-colors">
                {mode === "create"
                  ? t("label_recurring")
                  : t("label_extend_series")}
              </span>
            </label>

            {((mode === "create" && isRecurring) ||
              (mode === "edit" && isExtending)) && (
              <div className="res-extension-box">
                <div className="flex flex-col gap-2 shrink-0">
                  <label className="mci-label !ml-0 !mb-0 text-orange-400">
                    {t("label_weeks")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={mode === "create" ? recurringWeeks : extraWeeks}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 0);
                      mode === "create"
                        ? setRecurringWeeks(val)
                        : setExtraWeeks(val);
                    }}
                    className="mci-number-input-lg"
                  />
                </div>
                <div className="flex flex-col gap-1 border-l-2 border-orange-100 pl-8 py-2">
                  <p className="text-xl font-black text-[var(--mci-blue)] uppercase italic">
                    {mode === "create"
                      ? t("label_recurring")
                      : t("label_extend_series")}
                  </p>
                  <p className="text-[11px] font-bold text-orange-400 uppercase tracking-tight">
                    {t("hint_extension_preview")}
                  </p>
                </div>
              </div>
            )}

            {/* LISTE */}
            {((mode === "create" && isRecurring) || mode === "edit") && (
              <div className="series-list-container">
                <div className="series-header-row">
                  <div className="col-date">{t("header_date")}</div>
                  <div className="col-status"></div>
                  <div className="col-room">{t("header_room")}</div>
                  <div className="col-floor">{t("header_floor")}</div>
                  <div className="col-seats">{t("header_seats")}</div>
                  <div className="col-extra">{t("header_features")}</div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {/* BESTAND (Nur Edit) */}
                  {mode === "edit" &&
                    relatedBookings.map((b) => (
                      <div
                        key={b.id}
                        className="series-data-row opacity-40 grayscale"
                      >
                        <div className="col-date">
                          {new Date(b.booking_date).toLocaleDateString()}
                        </div>
                        <div className="col-status">
                          <CheckCircle2 size={16} className="text-green-500" />
                        </div>
                        <div className="col-room">
                          {rooms.find((r) => r.id === b.room_id)?.name}
                        </div>
                        <div className="col-floor">
                          {rooms.find((r) => r.id === b.room_id)?.floor}.{" "}
                          {t("label_floor_short") || "FL"}
                        </div>
                        <div className="col-seats">
                          <Users size={12} />{" "}
                          {rooms.find((r) => r.id === b.room_id)?.capacity}
                        </div>
                        <div className="col-extra">
                          <span className="text-[8px] font-black uppercase">
                            {t("label_existing")}
                          </span>
                        </div>
                      </div>
                    ))}

                  {/* 2. NEUE VORSCHAU ANZEIGEN */}
                  {((mode === "create" && isRecurring) ||
                    (mode === "edit" && isExtending)) &&
                    getSeriesPlan().map((p, i) => {
                      // Equipment-Vergleich Logik
                      const originalFeatures = [
                        ...(currentRoomContext?.equipment || []),
                      ];
                      if (currentRoomContext?.accessible)
                        originalFeatures.push("accessible-feat");
                      const currentFeatures = [...(p.room?.equipment || [])];
                      if (p.room?.accessible)
                        currentFeatures.push("accessible-feat");

                      const extra = currentFeatures.filter(
                        (id) => !originalFeatures.includes(id),
                      );
                      const missing = originalFeatures.filter(
                        (id) => !currentFeatures.includes(id),
                      );

                      return (
                        <div
                          key={`preview-${i}`}
                          className={`series-data-row ${p.status === "conflict" ? "bg-red-50" : "bg-orange-50/20"} border-l-4 ${p.status === "conflict" ? "border-l-red-500" : "border-l-orange-400"}`}
                        >
                          <div className="col-date">
                            {new Date(p.date).toLocaleDateString(
                              lang === "de" ? "de-DE" : "en-US",
                              {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                              },
                            )}
                          </div>
                          <div className="col-status">
                            {p.status === "ok" ? (
                              <PlusCircle
                                size={18}
                                className="text-orange-500"
                              />
                            ) : (
                              <XCircle size={18} className="text-red-500" />
                            )}
                          </div>
                          <div className="col-room font-bold">
                            {p.room?.name || "KEIN RAUM FREI"}
                          </div>
                          <div className="col-floor">
                            {p.room ? `${p.room.floor}. OG` : "-"}
                          </div>
                          <div className="col-seats">
                            <Users size={12} /> {p.room?.capacity || 0}
                          </div>
                          <div className="col-extra">
                            {p.status === "conflict" ? (
                              <span className="badge-feature badge-missing !no-underline font-black text-red-600">
                                KONFLIKT
                              </span>
                            ) : (
                              <>
                                {p.status === "alternative" && (
                                  <span className="badge-best-match mr-1">
                                    Best Match
                                  </span>
                                )}
                                {extra.map((id) => (
                                  <span
                                    key={id}
                                    className="badge-feature badge-extra"
                                  >
                                    +{" "}
                                    {id === "accessible-feat"
                                      ? t("label_accessible")
                                      : equipmentList.find(
                                          (e) => e.id === id,
                                        )?.[
                                          lang === "de" ? "name_de" : "name_en"
                                        ] || id}
                                  </span>
                                ))}
                                {missing.map((id) => (
                                  <span
                                    key={id}
                                    className="badge-feature badge-missing"
                                  >
                                    -{" "}
                                    {id === "accessible-feat"
                                      ? t("label_accessible")
                                      : equipmentList.find(
                                          (e) => e.id === id,
                                        )?.[
                                          lang === "de" ? "name_de" : "name_en"
                                        ] || id}
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

          {/* DER EINZIGE SPEICHERN BUTTON AM ENDE */}
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              const plan = getSeriesPlan();
              if (
                ((mode === "create" && isRecurring) ||
                  (mode === "edit" && isExtending)) &&
                plan.some((p) => p.status === "conflict")
              ) {
                alert("Bitte behebe zuerst die Konflikte!");
                setLoading(false);
                return;
              }
              const code =
                booking?.booking_code ||
                Math.random().toString(36).substring(2, 8).toUpperCase();

              if (mode === "edit") {
                await supabase
                  .from("bookings")
                  .update({
                    booking_date: selectedDate,
                    start_time: selectedTime,
                    duration,
                  })
                  .eq("id", booking.id);
                if (isExtending) {
                  await supabase.from("bookings").insert(
                    plan.map((p) => ({
                      room_id: p.room.id,
                      user_id: userId,
                      booking_date: p.date,
                      start_time: selectedTime,
                      duration,
                      user_email: userEmail,
                      booking_code: code,
                      status: "active",
                    })),
                  );
                }
              } else {
                await supabase.from("bookings").insert(
                  plan.map((p) => ({
                    room_id: p.room.id,
                    user_id: userId,
                    booking_date: p.date,
                    start_time: selectedTime,
                    duration,
                    user_email: userEmail,
                    booking_code: code,
                    status: "active",
                  })),
                );
              }
              setLoading(false);
              onSuccess();
              onClose();
            }}
            className="btn-mci-main mt-8"
          >
            <Save size={28} />{" "}
            {loading
              ? "..."
              : mode === "edit"
                ? t("btn_save_changes")
                : t("modal_btn_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
