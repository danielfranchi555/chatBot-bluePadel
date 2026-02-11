// ============================================================
// flows/confirmationFlow.ts
// Lógica simulada de confirmación de jugadores
// BluePadel — Solo mock/pseudocódigo, sin ejecución real
// ============================================================

import { getPlayerByPhone } from "../data/players";
import { MATCHES, Match, getMatchById } from "../data/matches";
import { SETTINGS } from "../data/settings";

// ============================================================
// TIPOS AUXILIARES
// ============================================================

export type ConfirmationResponse = "SI" | "NO" | "TIMEOUT";

export interface ConfirmationResult {
  success: boolean;
  matchId: string;
  playerId?: string;
  mensaje: string;
  accion: "confirmado" | "rechazado" | "timeout" | "ya_confirmado" | "error";
  partidoCompleto?: boolean;   // true si todos los jugadores confirmaron
}

// ============================================================
// FUNCIÓN PRINCIPAL — simulada, sin efectos reales
// ============================================================

/**
 * Simula la confirmación de un jugador para un partido.
 *
 * FLUJO REAL FUTURO:
 * 1. Recibir respuesta del jugador vía WhatsApp ("SI" / "NO")
 * 2. Verificar que el partido sigue en estado "waiting" o "confirmed" parcial
 * 3. Verificar que el jugador pertenece al partido
 * 4. Registrar la confirmación
 * 5. Si todos confirmaron → notificar a todos que el partido está listo
 * 6. Si alguien rechaza → iniciar búsqueda de reemplazo
 *
 * @param telefonoJugador - Número de WhatsApp del jugador
 * @param matchId - ID del partido a confirmar
 * @param respuesta - Respuesta del jugador ("SI", "NO", o "TIMEOUT")
 */
export function simularConfirmarAsistencia(
  telefonoJugador: string,
  matchId: string,
  respuesta: ConfirmationResponse
): ConfirmationResult {

  // ──────────────────────────────────────────────
  // PASO 1: Validar jugador y partido
  // ──────────────────────────────────────────────

  const jugador = getPlayerByPhone(telefonoJugador);
  if (!jugador) {
    return {
      success: false,
      matchId,
      mensaje: "No encontré tu número en el sistema.",
      accion: "error",
    };
  }

  const partido = getMatchById(matchId);
  if (!partido) {
    return {
      success: false,
      matchId,
      mensaje: "El partido no existe.",
      accion: "error",
    };
  }

  // ──────────────────────────────────────────────
  // PASO 2: Verificar que el jugador pertenece al partido
  // ──────────────────────────────────────────────

  if (!partido.jugadores.includes(jugador.id)) {
    return {
      success: false,
      matchId,
      playerId: jugador.id,
      mensaje: "No estás en ese partido.",
      accion: "error",
    };
  }

  // ──────────────────────────────────────────────
  // PASO 3: Verificar que el partido acepta confirmaciones
  // ──────────────────────────────────────────────

  // [CASO DE PRUEBA] Partido ya cancelado o completado
  if (partido.estado === "canceled" || partido.estado === "completed") {
    return {
      success: false,
      matchId,
      playerId: jugador.id,
      mensaje: `Este partido ya está en estado "${partido.estado}". No podés confirmar.`,
      accion: "error",
    };
  }

  // [CASO DE PRUEBA] Jugador ya confirmó
  if (partido.confirmados.includes(jugador.id)) {
    return {
      success: true,
      matchId,
      playerId: jugador.id,
      mensaje: "Ya confirmaste tu asistencia anteriormente. ¡Te esperamos!",
      accion: "ya_confirmado",
    };
  }

  // ──────────────────────────────────────────────
  // PASO 4: Procesar la respuesta
  // ──────────────────────────────────────────────

  // [CASO DE PRUEBA] Falta de confirmación — timeout
  if (respuesta === "TIMEOUT") {
    return simularTimeout(partido, jugador.id);
  }

  // [CASO DE PRUEBA] Jugador rechaza
  if (respuesta === "NO") {
    return {
      success: true,
      matchId,
      playerId: jugador.id,
      mensaje: `Entendido, ${jugador.nombre}. Cancelamos tu lugar en el partido del ${partido.horario}. Iniciamos búsqueda de reemplazo.`,
      accion: "rechazado",
    };
    // MOCK: En producción → llamar a replacementFlow.simularBuscarReemplazo()
  }

  // [CASO DE PRUEBA] Jugador confirma (SI)
  // MOCK: En producción → UPDATE match.confirmados.push(jugador.id)
  const confirmadosDespues = [...partido.confirmados, jugador.id];
  const partidoCompleto = confirmadosDespues.length === partido.jugadores.length;

  if (partidoCompleto) {
    // [CASO DE PRUEBA] Último jugador en confirmar — partido listo
    return {
      success: true,
      matchId,
      playerId: jugador.id,
      mensaje: `¡Perfecto! Todos confirmaron. El partido del ${partido.horario} está CONFIRMADO 🎾 ¡Los esperamos en ${partido.canchaId}!`,
      accion: "confirmado",
      partidoCompleto: true,
    };
  }

  const faltanConfirmar = partido.jugadores.length - confirmadosDespues.length;
  return {
    success: true,
    matchId,
    playerId: jugador.id,
    mensaje: `Confirmado, ${jugador.nombre} ✅. Faltan ${faltanConfirmar} jugador(es) por confirmar.`,
    accion: "confirmado",
    partidoCompleto: false,
  };
}

// ============================================================
// HELPERS INTERNOS — lógica simulada
// ============================================================

/**
 * Simula qué pasa cuando un jugador no responde en el tiempo límite.
 *
 * LÓGICA REAL FUTURA:
 * - Un cron job verificaría al pasar minutosParaConfirmar
 * - Si el jugador no respondió → tratarlo como rechazo implícito
 * - Iniciar búsqueda de reemplazo
 * - Si no hay reemplazo y el partido no puede formarse → cancelar
 */
function simularTimeout(partido: Match, jugadorId: string): ConfirmationResult {
  const minutosEspera = SETTINGS.tiempos.minutosParaConfirmar;

  // [CASO DE PRUEBA] Falta de confirmación — el sistema cancela el lugar
  return {
    success: true,
    matchId: partido.id,
    playerId: jugadorId,
    mensaje: `El jugador ${jugadorId} no confirmó en ${minutosEspera} minutos. Se liberó su lugar y se inicia búsqueda de reemplazo.`,
    accion: "timeout",
    partidoCompleto: false,
  };
}

/**
 * Simula el envío masivo de notificaciones de confirmación a todos los jugadores.
 *
 * LÓGICA REAL FUTURA:
 * - Iterar sobre partido.jugadores
 * - Enviar mensaje de WhatsApp a cada uno via provider.sendMessage()
 * - Registrar timestamp de envío para controlar el timeout
 *
 * @param matchId - ID del partido recién completado con 4 jugadores
 */
export function simularNotificarConfirmacion(matchId: string): void {
  const partido = getMatchById(matchId);
  if (!partido) return;

  // MOCK: Simula el mensaje que recibiría cada jugador
  partido.jugadores.forEach((playerId) => {
    const mensajeSimulado = SETTINGS.mensajes.partidoListo
      .replace("{{horario}}", partido.horario)
      .replace("{{cancha}}", partido.canchaId)
      .replace("{{rivales}}", partido.jugadores.filter((id) => id !== playerId).join(", "));

    console.log(`[MOCK] Notificando a ${playerId}: "${mensajeSimulado}"`);
    // En producción: await provider.sendMessage(player.telefono, mensajeSimulado)
  });
}

// ============================================================
// CASOS DE PRUEBA — ejecutar manualmente para testear
// ============================================================

/**
 * Para probar localmente, descomentá y ejecutá con: npx tsx src/flows/confirmationFlow.ts
 *
 * CASO 1: Confirmación exitosa (primer jugador confirma de m1)
 *   simularConfirmarAsistencia("5491177889900", "m1", "SI")
 *   → Esperado: accion "ya_confirmado" (p6 ya está en confirmados de m1)
 *
 * CASO 2: Último jugador confirma y cierra el partido
 *   Crear escenario manual donde solo falta 1 confirmación
 *   → Esperado: accion "confirmado", partidoCompleto: true
 *
 * CASO 3: Jugador rechaza (responde "NO")
 *   simularConfirmarAsistencia("5491144556677", "m2", "NO")
 *   → Esperado: accion "rechazado", se activa búsqueda de reemplazo
 *
 * CASO 4: Falta de confirmación (timeout)
 *   simularConfirmarAsistencia("5491144556677", "m2", "TIMEOUT")
 *   → Esperado: accion "timeout", mensaje de tiempo vencido
 *
 * CASO 5: Partido ya cancelado
 *   simularConfirmarAsistencia("5491122334455", "m4", "SI")
 *   → Esperado: accion "error", partido en estado "canceled"
 *
 * CASO 6: Jugador no pertenece al partido
 *   simularConfirmarAsistencia("5491199001122", "m1", "SI")
 *   → Esperado: accion "error", "No estás en ese partido"
 */
