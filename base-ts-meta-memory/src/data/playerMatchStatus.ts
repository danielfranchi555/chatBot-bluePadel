// ============================================================
// data/playerMatchStatus.ts
// Estado individual de cada jugador DENTRO de un partido.
// Desacoplado de Player.disponible (que es disponibilidad general).
// BluePadel — Solo mock/pseudocódigo, sin ejecución real
// ============================================================

// ============================================================
// TIPO PRINCIPAL: Estado de un jugador en un partido específico
// ============================================================

/**
 * Ciclo de vida del estado de un jugador dentro de un partido:
 *
 *  [trigger diario crea el partido]
 *         │
 *         ▼
 *      "pending"        ← mensaje de WhatsApp enviado, sin respuesta aún
 *       /     \
 *     [SI]   [NO / TIMEOUT]
 *      │          │
 *   "confirmed"   │
 *                 ▼
 *            "rejected" / "timeout"
 *                 │
 *        [buscarReemplazo()]
 *                 │
 *            "replaced"   ← el jugador fue sustituido, ya no participa
 */
export type PlayerMatchState =
  | "pending"     // Mensaje enviado, jugador aún no respondió
  | "confirmed"   // Jugador respondió SI
  | "rejected"    // Jugador respondió NO explícitamente
  | "timeout"     // No respondió antes del tiempoLimite
  | "replaced";   // Fue reemplazado por otro jugador (ya salió del partido)

// ============================================================
// INTERFAZ: Entrada de notificación por jugador dentro de un Match
// ============================================================

/**
 * Registra el estado asincrónico de confirmación de UN jugador
 * dentro de un partido creado por el trigger diario.
 *
 * Se almacena como array en Match.notificaciones[].
 * Cada partido tiene exactamente 4 entradas (una por jugador).
 */
export interface PlayerNotification {
  playerId: string;

  /** Estado actual de confirmación de este jugador */
  estado: PlayerMatchState;

  /** ISO 8601 — cuándo se envió el primer mensaje de WhatsApp */
  enviadoEn: string;

  /**
   * ISO 8601 — cuándo respondió el jugador (si respondió).
   * undefined si aún no respondió o hizo timeout.
   */
  respondioEn?: string;

  /**
   * ISO 8601 — deadline para confirmar.
   * Calculado como: enviadoEn + SETTINGS.tiempos.minutosParaConfirmar
   * Si el jugador no responde antes de esto → se trata como TIMEOUT.
   */
  tiempoLimite: string;
}

// ============================================================
// HELPERS PUROS — sin efectos ni estado
// ============================================================

/**
 * Crea una nueva entrada PlayerNotification en estado "pending"
 * para un jugador recién notificado.
 *
 * @param playerId - ID del jugador
 * @param minutosParaConfirmar - Minutos hasta el deadline (de SETTINGS.tiempos)
 * @param ahoraMock - Fecha base para el mock (en producción: new Date().toISOString())
 */
export function crearNotificacionPendiente(
  playerId: string,
  minutosParaConfirmar: number,
  ahoraMock: string
): PlayerNotification {
  const enviadoEn = ahoraMock;
  const tiempoLimite = sumarMinutos(ahoraMock, minutosParaConfirmar);

  return {
    playerId,
    estado: "pending",
    enviadoEn,
    tiempoLimite,
  };
}

/**
 * Devuelve true si el tiempoLimite de la notificación ya pasó.
 *
 * @param notificacion - Entrada a evaluar
 * @param ahoraMock - Fecha "actual" para comparar (en producción: new Date().toISOString())
 */
export function notificacionVencida(
  notificacion: PlayerNotification,
  ahoraMock: string
): boolean {
  return notificacion.tiempoLimite < ahoraMock && notificacion.estado === "pending";
}

/**
 * Devuelve todas las notificaciones pendientes vencidas de un partido.
 * Usada por el confirmationTimeoutTrigger para detectar jugadores que no respondieron.
 */
export function obtenerPendientesVencidos(
  notificaciones: PlayerNotification[],
  ahoraMock: string
): PlayerNotification[] {
  return notificaciones.filter((n) => notificacionVencida(n, ahoraMock));
}

/**
 * Devuelve true si TODOS los jugadores del partido confirmaron.
 */
export function todosConfirmaron(notificaciones: PlayerNotification[]): boolean {
  return (
    notificaciones.length === 4 &&
    notificaciones.every((n) => n.estado === "confirmed")
  );
}

/**
 * Devuelve cuántos jugadores están activos (confirmed o pending) en este momento.
 * Útil para determinar si el partido puede recuperarse con un reemplazo.
 */
export function contarJugadoresActivos(notificaciones: PlayerNotification[]): number {
  return notificaciones.filter(
    (n) => n.estado === "confirmed" || n.estado === "pending"
  ).length;
}

// ============================================================
// HELPER INTERNO — manipulación de fechas sin dependencias
// ============================================================

/**
 * Suma N minutos a una fecha ISO y devuelve el resultado como ISO string.
 * MOCK: implementación simple sin librería de fechas.
 */
function sumarMinutos(isoString: string, minutos: number): string {
  try {
    const fecha = new Date(isoString);
    fecha.setMinutes(fecha.getMinutes() + minutos);
    return fecha.toISOString();
  } catch {
    // Fallback: sumar en modo string (para entornos sin Date completo)
    return isoString;
  }
}
