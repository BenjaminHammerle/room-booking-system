export const APP_CONFIG = {
  CHECKIN_RADIUS_METERS: 250,
  AUTO_RELEASE_MINUTES: 15,
  MAX_RECURRING_WEEKS: 12,
  SMART_TIME_THRESHOLD_HOUR: 23, // Ab 23 Uhr wird der Folgetag vorgeschlagen
  DEFAULT_START_TIME: "07:00",
  DEFAULT_LANG: "de" as Language,
};

export const SEATING_OPTIONS = [
  "school with a central corridor",
  "edv room",
  "wow room",
  "exam room",
  "parliament",
  "meeting room",
  "conference room"
];

export const BOOKING_STATUS = {
  ACTIVE: "active",
  CANCELLED: "cancelled",
  RELEASED: "released",
};

export const SUPPORTED_LANGS = ["de", "en", "it"] as const;
export type Language = typeof SUPPORTED_LANGS[number];
