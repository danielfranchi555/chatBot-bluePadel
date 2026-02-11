// ============================================================
// data/courts.ts
// Canchas mockeadas para el chatbot de BluePadel
// Sin conexión a base de datos real — solo para testing local
// ============================================================

export type CourtType = "interna" | "externa";

export type DayOfWeek =
  | "lunes"
  | "martes"
  | "miércoles"
  | "jueves"
  | "viernes"
  | "sábado"
  | "domingo";

export interface TimeSlot {
  inicio: string;  // "HH:MM"
  fin: string;     // "HH:MM"
}

export interface Court {
  id: string;
  nombre: string;
  tipo: CourtType;
  activa: boolean;           // Si la cancha está habilitada en general
  diasDisponibles: DayOfWeek[];
  horariosDisponibles: TimeSlot[];
  capacidad: number;         // Siempre 4 para pádel, pero extensible
  descripcion?: string;
}

export const COURTS: Court[] = [
  {
    id: "c1",
    nombre: "Cancha 1 - Cristal",
    tipo: "interna",
    activa: true,
    diasDisponibles: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    horariosDisponibles: [
      { inicio: "08:00", fin: "10:00" },
      { inicio: "10:00", fin: "12:00" },
      { inicio: "16:00", fin: "18:00" },
      { inicio: "18:00", fin: "20:00" },
      { inicio: "20:00", fin: "22:00" },
    ],
    capacidad: 4,
    descripcion: "Cancha techada con paredes de cristal, iluminación LED",
  },
  {
    id: "c2",
    nombre: "Cancha 2 - Panorámica",
    tipo: "externa",
    activa: true,
    diasDisponibles: ["lunes", "miércoles", "viernes", "sábado", "domingo"],
    horariosDisponibles: [
      { inicio: "08:00", fin: "10:00" },
      { inicio: "10:00", fin: "12:00" },
      { inicio: "12:00", fin: "14:00" },
      { inicio: "16:00", fin: "18:00" },
      { inicio: "18:00", fin: "20:00" },
    ],
    capacidad: 4,
    descripcion: "Cancha al aire libre con vista al jardín",
  },
  {
    id: "c3",
    nombre: "Cancha 3 - Premium",
    tipo: "interna",
    activa: true,
    diasDisponibles: [
      "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo",
    ],
    horariosDisponibles: [
      { inicio: "07:00", fin: "09:00" },
      { inicio: "09:00", fin: "11:00" },
      { inicio: "11:00", fin: "13:00" },
      { inicio: "15:00", fin: "17:00" },
      { inicio: "17:00", fin: "19:00" },
      { inicio: "19:00", fin: "21:00" },
      { inicio: "21:00", fin: "23:00" },
    ],
    capacidad: 4,
    descripcion: "Cancha premium con césped de última generación",
  },
  {
    id: "c4",
    nombre: "Cancha 4 - Clásica",
    tipo: "externa",
    activa: true,
    diasDisponibles: ["martes", "jueves", "sábado", "domingo"],
    horariosDisponibles: [
      { inicio: "09:00", fin: "11:00" },
      { inicio: "11:00", fin: "13:00" },
      { inicio: "17:00", fin: "19:00" },
      { inicio: "19:00", fin: "21:00" },
    ],
    capacidad: 4,
    descripcion: "Cancha exterior tradicional, sin techo",
  },
  {
    id: "c5",
    nombre: "Cancha 5 - Indoor VIP",
    tipo: "interna",
    activa: false, // Temporalmente fuera de servicio (mantenimiento)
    diasDisponibles: [],
    horariosDisponibles: [],
    capacidad: 4,
    descripcion: "En mantenimiento hasta nuevo aviso",
  },
];

// --------------------------------------------------------
// Helpers de búsqueda (sin lógica de negocio real)
// --------------------------------------------------------

/** Devuelve una cancha por id */
export function getCourtById(id: string): Court | undefined {
  return COURTS.find((c) => c.id === id);
}

/** Devuelve canchas activas disponibles en un día determinado */
export function getAvailableCourtsByDay(dia: DayOfWeek): Court[] {
  return COURTS.filter(
    (c) => c.activa && c.diasDisponibles.includes(dia)
  );
}

/** Verifica si una cancha tiene un horario específico disponible */
export function isSlotAvailable(
  courtId: string,
  inicio: string
): boolean {
  const court = getCourtById(courtId);
  if (!court || !court.activa) return false;
  return court.horariosDisponibles.some((slot) => slot.inicio === inicio);
}
