// ============================================================
// flows/cancellationFlow.ts
// Lógica simulada de cancelaciones de partidos
// BluePadel — Solo mock/pseudocódigo, sin ejecución real
// ============================================================

import { getPlayerByPhone } from "../data/players";
import { MATCHES, Match, getMatchById, getMatchesByPlayer } from "../data/matches";
import { SETTINGS } from "../data/settings";

// ============================================================
// TIPOS AUXILIARES
// ============================================================

export type CancellationReason =
  | "jugador_cancela"          // El jugador cancela voluntariamente
  | "sin_confirmaciones"       // No llegaron al mínimo de confirmaciones
  | "sin_jugadores_suficientes" // No se completaron los 4 lugares
  | "cancha_no_disponible"     // La cancha tuvo un problema
  | "partido_expirado";        // Superó el tiempo máximo en "waiting"

export interface CancellationResult {
  success: boolean;
  matchId: string;
  playerId?: string;
  mensaje: string;
  tipoMotivo: CancellationReason | "error";
  esUltimoMomento: boolean;   // true si cancela dentro de las 2hs previas
  requiereReemplazo: boolean; // true si el partido aún puede recuperarse
}

// ============================================================
// FUNCIÓN PRINCIPAL: Jugador cancela su participación
// ============================================================

/**
 * Simula la cancelación de un jugador en un partido.
 *
 * FLUJO REAL FUTURO:
 * 1. Identificar al jugador y el partido activo
 * 2. Determinar si es cancelación normal o de último momento
 * 3. Si el partido puede recuperarse (3 jugadores quedan), buscar reemplazo
 * 4. Si no puede recuperarse (quedan < 3), cancelar el partido completo
 * 5. Notificar a todos los jugadores del partido
 *
 * @param telefonoJugador - Número de WhatsApp del jugador que cancela
 * @param matchId - ID del partido (si el jugador lo sabe) o null para buscar automáticamente
 */
export function simularCancelarJugador(
  telefonoJugador: string,
  matchId: string | null
): CancellationResult {

  // ──────────────────────────────────────────────
  // PASO 1: Identificar jugador
  // ──────────────────────────────────────────────

  const jugador = getPlayerByPhone(telefonoJugador);
  if (!jugador) {
    return {
      success: false,
      matchId: matchId ?? "desconocido",
      mensaje: "No encontré tu número. Por favor contactá al club.",
      tipoMotivo: "error",
      esUltimoMomento: false,
      requiereReemplazo: false,
    };
  }

  // ──────────────────────────────────────────────
  // PASO 2: Encontrar el partido a cancelar
  // ──────────────────────────────────────────────

  let partido: Match | undefined;

  if (matchId) {
    partido = getMatchById(matchId);
  } else {
    // Buscar el partido más próximo del jugador que esté activo
    const partidos = getMatchesByPlayer(jugador.id).filter(
      (m) => m.estado === "waiting" || m.estado === "confirmed"
    );
    // Ordenar por horario y tomar el más próximo
    partido = partidos.sort((a, b) => a.horario.localeCompare(b.horario))[0];
  }

  // [CASO DE PRUEBA] Jugador sin partido activo
  if (!partido) {
    return {
      success: false,
      matchId: matchId ?? "ninguno",
      mensaje: `${jugador.nombre}, no tenés partidos activos para cancelar.`,
      tipoMotivo: "error",
      esUltimoMomento: false,
      requiereReemplazo: false,
    };
  }

  // [CASO DE PRUEBA] Partido ya cancelado
  if (partido.estado === "canceled" || partido.estado === "completed") {
    return {
      success: false,
      matchId: partido.id,
      playerId: jugador.id,
      mensaje: `El partido ya está en estado "${partido.estado}". No hay nada que cancelar.`,
      tipoMotivo: "error",
      esUltimoMomento: false,
      requiereReemplazo: false,
    };
  }

  // ──────────────────────────────────────────────
  // PASO 3: Determinar si es cancelación de último momento
  // ──────────────────────────────────────────────

  const esUltimoMomento = verificarUltimoMomento(partido.horario);

  // ──────────────────────────────────────────────
  // PASO 4: Determinar si el partido puede recuperarse
  // ──────────────────────────────────────────────

  const jugadoresRestantes = partido.jugadores.length - 1;
  const requiereReemplazo = jugadoresRestantes >= SETTINGS.matching.jugadoresMinimosParaCrear;

  // MOCK: En producción → UPDATE match.jugadores.remove(jugador.id)
  //       + UPDATE match.confirmados.remove(jugador.id) si había confirmado

  // ──────────────────────────────────────────────
  // PASO 5: Determinar respuesta según contexto
  // ──────────────────────────────────────────────

  // [CASO DE PRUEBA] Cancelación de último momento
  if (esUltimoMomento) {
    const horasUltMomento = SETTINGS.tiempos.horasUltimoMomento;
    return {
      success: true,
      matchId: partido.id,
      playerId: jugador.id,
      mensaje: `${jugador.nombre}, cancelaste con menos de ${horasUltMomento}hs de anticipación ⚠️. Tu lugar fue liberado. ${requiereReemplazo ? "Iniciamos búsqueda de reemplazo." : "El partido fue cancelado por falta de jugadores."}`,
      tipoMotivo: "jugador_cancela",
      esUltimoMomento: true,
      requiereReemplazo,
    };
  }

  // [CASO DE PRUEBA] Cancelación normal
  return {
    success: true,
    matchId: partido.id,
    playerId: jugador.id,
    mensaje: `Cancelación confirmada, ${jugador.nombre}. ${requiereReemplazo ? "Buscamos un reemplazo para tu lugar." : "No había suficientes jugadores, el partido fue cancelado."}`,
    tipoMotivo: "jugador_cancela",
    esUltimoMomento: false,
    requiereReemplazo,
  };
}

// ============================================================
// FUNCIÓN: Cancelación automática del partido completo
// ============================================================

/**
 * Simula la cancelación automática de un partido por causas del sistema
 * (tiempo expirado, sin confirmaciones, cancha no disponible).
 *
 * FLUJO REAL FUTURO:
 * - Llamado por un cron job o trigger de tiempo
 * - Actualiza estado a "canceled" con motivo
 * - Notifica a todos los jugadores
 *
 * @param matchId - ID del partido a cancelar
 * @param motivo - Razón de la cancelación automática
 */
export function simularCancelarPartidoAutomatico(
  matchId: string,
  motivo: CancellationReason
): CancellationResult {

  const partido = getMatchById(matchId);
  if (!partido) {
    return {
      success: false,
      matchId,
      mensaje: "Partido no encontrado.",
      tipoMotivo: "error",
      esUltimoMomento: false,
      requiereReemplazo: false,
    };
  }

  // MOCK: En producción → UPDATE match.estado = "canceled", match.motivoCancelacion = motivo

  const mensajesPorMotivo: Record<CancellationReason, string> = {
    jugador_cancela: "El partido fue cancelado porque un jugador abandonó.",
    sin_confirmaciones: `Nadie confirmó a tiempo. El partido del ${partido.horario} fue cancelado.`,
    sin_jugadores_suficientes: `No se completaron los 4 jugadores para el partido del ${partido.horario}.`,
    cancha_no_disponible: `La cancha ${partido.canchaId} no está disponible. El partido del ${partido.horario} fue cancelado.`,
    partido_expirado: `El partido del ${partido.horario} estuvo demasiado tiempo esperando jugadores y fue cancelado automáticamente.`,
  };

  // [CASO DE PRUEBA] Partido que no se cierra — expira automáticamente
  if (motivo === "partido_expirado") {
    const horasMax = SETTINGS.tiempos.horasMaximaEsperaPartido;
    console.log(`[MOCK] Partido ${matchId} expiró después de ${horasMax}hs en "waiting".`);
  }

  // Notificar a cada jugador del partido
  if (SETTINGS.matching.notificarCancelacion) {
    partido.jugadores.forEach((playerId) => {
      console.log(`[MOCK] Notificando cancelación a ${playerId}: "${mensajesPorMotivo[motivo]}"`);
      // En producción: await provider.sendMessage(player.telefono, mensajesPorMotivo[motivo])
    });
  }

  return {
    success: true,
    matchId,
    mensaje: mensajesPorMotivo[motivo],
    tipoMotivo: motivo,
    esUltimoMomento: verificarUltimoMomento(partido.horario),
    requiereReemplazo: false, // Cancelación total — no se busca reemplazo
  };
}

// ============================================================
// HELPERS INTERNOS
// ============================================================

/**
 * Determina si el horario del partido está dentro de la ventana de "último momento".
 * MOCK: Compara el horario del partido contra "ahora" (fecha fija en mock).
 *
 * En producción usaría: new Date() y Date.parse() reales.
 */
function verificarUltimoMomento(horarioPartido: string): boolean {
  // MOCK: Fecha fija para testing (representando "ahora")
  const ahoraMock = new Date("2025-02-11T16:30:00");
  const horasUltMomento = SETTINGS.tiempos.horasUltimoMomento;

  try {
    const fechaPartido = new Date(horarioPartido);
    const diferenciaMs = fechaPartido.getTime() - ahoraMock.getTime();
    const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
    return diferenciaHoras >= 0 && diferenciaHoras <= horasUltMomento;
  } catch {
    return false;
  }
}

// ============================================================
// CASOS DE PRUEBA — ejecutar manualmente para testear
// ============================================================

/**
 * Para probar localmente, descomentá y ejecutá con: npx tsx src/flows/cancellationFlow.ts
 *
 * CASO 1: Cancelación normal (con más de 2hs de anticipación)
 *   simularCancelarJugador("5491177889900", "m1")
 *   → Esperado: esUltimoMomento: false, requiereReemplazo: true (quedan 3)
 *
 * CASO 2: Cancelación de último momento (partido m5 — horario 18:00, mock "ahora" es 16:30)
 *   simularCancelarJugador("5491155667788", "m5")
 *   → Esperado: esUltimoMomento: true, mensaje con advertencia ⚠️
 *
 * CASO 3: Jugador sin partido activo
 *   simularCancelarJugador("5491188990011", null)
 *   → Esperado: tipoMotivo "error", sin partido activo
 *
 * CASO 4: Cancelación automática por tiempo expirado (m8 lleva 48hs en waiting)
 *   simularCancelarPartidoAutomatico("m8", "partido_expirado")
 *   → Esperado: success true, notificaciones a p13
 *
 * CASO 5: Cancelación por sin confirmaciones (m4 — solo p1 confirmó)
 *   simularCancelarPartidoAutomatico("m4", "sin_confirmaciones")
 *   → Esperado: mensaje explicativo a p1, p2, p3, p4
 *
 * CASO 6: Partido que colapsa — último jugador cancela (1 queda)
 *   Si quedan solo 2 jugadores y uno cancela:
 *   requiereReemplazo = true (quedan 1 pero >= jugadoresMinimosParaCrear = 1)
 *   → El partido no se cancela aún, se busca reemplazo
 */
