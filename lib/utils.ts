/**
 * Findet ein Objekt in einem Array anhand einer ID, 
 * egal ob diese als String oder Number vorliegt.
 */
export const findById = (array: any[], id: any) => {
  if (!array || !id) return null;
  return array.find((item) => String(item.id) === String(id)) || null;
};

/**
 * Wandelt "HH:mm" in Minuten um
 */
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Wandelt Minuten zurück in "HH:mm"
 */
export const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

/**
 * Berechnet die Endzeit-Teile
 */
export const getEndTimeParts = (startTime: string, duration: number) => {
  const totalMinutes = timeToMinutes(startTime) + duration * 60;
  return {
    hh: Math.floor(totalMinutes / 60).toString().padStart(2, "0"),
    mm: (totalMinutes % 60).toString().padStart(2, "0"),
  };
};

/**
 * Haversine Formel für Distanzberechnung
 * $d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$
 */
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3; // Erde in Metern
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};