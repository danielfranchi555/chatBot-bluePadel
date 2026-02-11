// ============================================================
// data/matches.ts
// Partidos mockeados para el chatbot de BluePadel
// Sin conexión a base de datos real — solo para testing local
// ============================================================

import type { PlayerNotification } from "./playerMatchStatus";

export type MatchStatus =
  | "waiting"    // Partido abierto, esperando jugadores (flujo manual/orgánico)
  | "notified"   // 4 jugadores asignados por el trigger, mensajes enviados, esperando confirmaciones asincrónicas
  | "confirmed"  // Todos los jugadores confirmaron
  | "canceled"   // El partido fue cancelado
  | "completed"; // El partido ya se jugó

/**
 * Ciclo de vida de un partido creado por el trigger diario:
 *
 *   [trigger 20:00]
 *        │
 *        ▼
 *    "notified"   ← 4 jugadores asignados + mensajes enviados
 *       /   \
 *  [todos   [alguno no confirma]
 *  confirman]      │
 *      │     buscarReemplazo()
 *      │           │
 *      │     ┌─────┴──────┐
 *      │  [encontrado] [agotado]
 *      │     │              │
 *      └─────┘          "canceled"
 *      │
 *  "confirmed"
 *      │
 *  "completed"
 */
export interface Match {
  id: string;
  jugadores: string[];          // Array de player ids (máx 4)
  confirmados: string[];        // Player ids que confirmaron asistencia (legacy — compatible con flujos existentes)
  horario: string;              // ISO 8601
  canchaId: string;             // Referencia a courts.ts
  estado: MatchStatus;
  categoria: number;            // Categoría del partido (3-8)
  nivelPromedio: number;        // Promedio de nivel de los jugadores
  creadoEn: string;             // Timestamp de creación (ISO 8601)
  motivoCancelacion?: string;   // Solo si estado === "canceled"

  /**
   * Tracking asincrónico por jugador — solo presente en partidos creados
   * por el trigger diario (estado inicial "notified").
   * Cada entrada corresponde a un jugador del array `jugadores`.
   */
  notificaciones?: PlayerNotification[];
}

export const MATCHES: Match[] = [
  // ----------------------------------------------------------
  // CASO 1: Partido completo y confirmado (estado ideal)
  // ----------------------------------------------------------
  {
    id: "m1",
    jugadores: ["p6", "p7", "p8", "p10"],
    confirmados: ["p6", "p7", "p8", "p10"],
    horario: "2025-02-12T10:00:00",
    canchaId: "c1",
    estado: "confirmed",
    categoria: 5,
    nivelPromedio: 5.7,
    creadoEn: "2025-02-10T09:00:00",
  },

  // ----------------------------------------------------------
  // CASO 2: Partido esperando jugadores (incompleto — solo 2)
  // ----------------------------------------------------------
  {
    id: "m2",
    jugadores: ["p3", "p5"],
    confirmados: [],
    horario: "2025-02-12T12:00:00",
    canchaId: "c2",
    estado: "waiting",
    categoria: 4,
    nivelPromedio: 4.45,
    creadoEn: "2025-02-10T10:00:00",
  },

  // ----------------------------------------------------------
  // CASO 3: Partido con 3 jugadores, falta 1
  // ----------------------------------------------------------
  {
    id: "m3",
    jugadores: ["p10", "p11", "p12"],
    confirmados: ["p10", "p11"],
    horario: "2025-02-12T14:00:00",
    canchaId: "c3",
    estado: "waiting",
    categoria: 6,
    nivelPromedio: 6.53,
    creadoEn: "2025-02-10T11:00:00",
  },

  // ----------------------------------------------------------
  // CASO 4: Partido cancelado por falta de confirmación
  // ----------------------------------------------------------
  {
    id: "m4",
    jugadores: ["p1", "p2", "p3", "p4"],
    confirmados: ["p1"],
    horario: "2025-02-11T09:00:00",
    canchaId: "c1",
    estado: "canceled",
    categoria: 3,
    nivelPromedio: 4.2,
    creadoEn: "2025-02-09T08:00:00",
    motivoCancelacion: "No se alcanzó el mínimo de confirmaciones en tiempo",
  },

  // ----------------------------------------------------------
  // CASO 5: Partido cancelado de último momento por un jugador
  // ----------------------------------------------------------
  {
    id: "m5",
    jugadores: ["p6", "p8", "p13", "p14"],
    confirmados: ["p6", "p8", "p13"],
    horario: "2025-02-11T18:00:00",
    canchaId: "c4",
    estado: "canceled",
    categoria: 6,
    nivelPromedio: 6.35,
    creadoEn: "2025-02-09T15:00:00",
    motivoCancelacion: "Jugador p14 canceló con menos de 2 horas de anticipación",
  },

  // ----------------------------------------------------------
  // CASO 6: Partido completado (ya jugado)
  // ----------------------------------------------------------
  {
    id: "m6",
    jugadores: ["p17", "p18", "p15", "p16"],
    confirmados: ["p17", "p18", "p15", "p16"],
    horario: "2025-02-10T08:00:00",
    canchaId: "c5",
    estado: "completed",
    categoria: 7,
    nivelPromedio: 7.65,
    creadoEn: "2025-02-08T12:00:00",
  },

  // ----------------------------------------------------------
  // CASO 7: Partido con mezcla de niveles (tolerancia al límite)
  // Un jugador tiene nivelNumerico 5.9 y otro 4.8 — tolerancia = 1.0
  // ----------------------------------------------------------
  {
    id: "m7",
    jugadores: ["p3", "p6"],
    confirmados: [],
    horario: "2025-02-13T16:00:00",
    canchaId: "c2",
    estado: "waiting",
    categoria: 5,
    nivelPromedio: 5.35,
    creadoEn: "2025-02-10T14:00:00",
  },

  // ----------------------------------------------------------
  // CASO 8: Partido que no se pudo cerrar (lleva 48hs en waiting)
  // ----------------------------------------------------------
  {
    id: "m8",
    jugadores: ["p13"],
    confirmados: [],
    horario: "2025-02-14T10:00:00",
    canchaId: "c3",
    estado: "waiting",
    categoria: 6,
    nivelPromedio: 6.0,
    creadoEn: "2025-02-08T10:00:00",
  },

  // ----------------------------------------------------------
  // CASO 9: Partido creado por el trigger diario
  // Estado "notified" — mensajes enviados, confirmaciones asincrónicas pendientes
  // p7 (5.4), p8 (5.3), p6 (5.9), p2 (3.5) ← p2 fuera de tolerancia, caso límite
  // ----------------------------------------------------------
  {
    id: "m9",
    jugadores: ["p7", "p8", "p6", "p10"],
    confirmados: [],
    horario: "2025-02-13T10:00:00",
    canchaId: "c1",
    estado: "notified",
    categoria: 5,
    nivelPromedio: 5.825,
    creadoEn: "2025-02-12T20:00:00",
    notificaciones: [
      {
        playerId: "p7",
        estado: "pending",
        enviadoEn: "2025-02-12T20:00:00",
        tiempoLimite: "2025-02-12T21:00:00",
      },
      {
        playerId: "p8",
        estado: "confirmed",
        enviadoEn: "2025-02-12T20:00:00",
        respondioEn: "2025-02-12T20:15:00",
        tiempoLimite: "2025-02-12T21:00:00",
      },
      {
        playerId: "p6",
        estado: "pending",
        enviadoEn: "2025-02-12T20:00:00",
        tiempoLimite: "2025-02-12T21:00:00",
      },
      {
        playerId: "p10",
        estado: "timeout",
        enviadoEn: "2025-02-12T20:00:00",
        tiempoLimite: "2025-02-12T21:00:00",
      },
    ],
  },
];

// --------------------------------------------------------
// Helpers de búsqueda (sin lógica de negocio real)
// --------------------------------------------------------

/** Devuelve un partido por id */
export function getMatchById(id: string): Match | undefined {
  return MATCHES.find((m) => m.id === id);
}

/** Devuelve partidos en los que participa un jugador */
export function getMatchesByPlayer(playerId: string): Match[] {
  return MATCHES.filter((m) => m.jugadores.includes(playerId));
}

/** Devuelve partidos en estado waiting que aún pueden recibir jugadores */
export function getOpenMatches(): Match[] {
  return MATCHES.filter(
    (m) => m.estado === "waiting" && m.jugadores.length < 4
  );
}

/** Devuelve partidos confirmados próximos (horario futuro) */
export function getUpcomingConfirmedMatches(): Match[] {
  const now = new Date().toISOString();
  return MATCHES.filter(
    (m) => m.estado === "confirmed" && m.horario > now
  );
}

/**
 * Devuelve partidos en estado "notified" — creados por el trigger diario,
 * mensajes enviados, esperando confirmaciones asincrónicas.
 * Usados por el confirmationTimeoutTrigger para chequear vencimientos.
 */
export function getNotifiedMatches(): Match[] {
  return MATCHES.filter((m) => m.estado === "notified");
}

/**
 * Devuelve partidos en estado "waiting" que superaron el tiempo máximo de espera.
 * Usados por el trigger diario para limpiar partidos obsoletos.
 *
 * @param horasMaxima - Horas máximas permitidas en estado waiting (ej: 48)
 * @param ahoraMock - Fecha "actual" para comparar (en producción: new Date().toISOString())
 */
export function getMatchesExpirados(horasMaxima: number, ahoraMock: string): Match[] {
  return MATCHES.filter((m) => {
    if (m.estado !== "waiting") return false;
    try {
      const creadoEn = new Date(m.creadoEn).getTime();
      const ahora = new Date(ahoraMock).getTime();
      const horasTranscurridas = (ahora - creadoEn) / (1000 * 60 * 60);
      return horasTranscurridas >= horasMaxima;
    } catch {
      return false;
    }
  });
}
