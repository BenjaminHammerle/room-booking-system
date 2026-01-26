import { Language } from "./constants";

/**
 * Findet ein Objekt in einem Array anhand einer ID, 
 * egal ob diese als String oder Number vorliegt.
 */
export const findById = (array: any[], id: any) => {
  if (!array || !id) return null;
  return array.find((item) => String(item.id) === String(id)) || null;
};

/** Rechnet "HH:MM" in absolute Minuten um */
export const timeToMinutes = (timeStr: string | undefined): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

/** Rechnet Minuten in "HH:MM" String um */
export const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

/** Berechnet Endzeit-Teile für Display-Zwecke */
export const getEndTimeParts = (startTime: string, durationHours: number) => {
  const totalMinutes = timeToMinutes(startTime) + durationHours * 60;
  return {
    hh: Math.floor(totalMinutes / 60).toString().padStart(2, "0"),
    mm: (totalMinutes % 60).toString().padStart(2, "0"),
    full: `${Math.floor(totalMinutes / 60).toString().padStart(2, "0")}:${(totalMinutes % 60).toString().padStart(2, "0")}`
  };
};

/** Haversine-Formel für Distanzberechnung zwischen zwei GPS-Punkten */
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Erde Radius in Metern
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

/** * Holt den übersetzten Wert aus einem DB-Objekt 
 * Beispiel: getTrans(equipment, "name", "it") -> gibt equipment.name_it zurück
 */
export const getTrans = (obj: any, field: string, lang: string): string => {
  if (!obj) return "";
  const key = `${field}_${lang}`;
  return obj[key] || obj[`${field}_de`] || "Value missing"; 
};