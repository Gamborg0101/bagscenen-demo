import type { EventStatus, EventType, LightingPreset, ShiftKind } from "@prisma/client";

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  KONFERENCE: "Konference / seminar",
  OPLAEG_DEBAT: "Oplæg / debat",
  KONCERT: "Koncert",
  FREDAGSBAR: "Fredagsbar",
  FEST: "Fest",
  RECEPTION: "Reception",
  UNDERVISNING: "Undervisning",
  ANDET: "Andet",
};

export const LIGHTING_LABEL: Record<LightingPreset, string> = {
  INGEN: "Intet særligt",
  KONFERENCE: "Konference",
  UNDERVISNING: "Undervisning",
  KONCERT: "Koncert",
  FEST: "Fest",
  STEMNING: "Stemning",
};

export const SHIFT_KIND_LABEL: Record<ShiftKind, string> = {
  OPSAETNING: "Opsætning",
  AFVIKLING: "Arrangement",
  NEDTAGNING: "Nedtagning",
  ANDET: "Andet",
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Kladde",
  PUBLISHED: "Klar",
  CANCELLED: "Aflyst",
};
