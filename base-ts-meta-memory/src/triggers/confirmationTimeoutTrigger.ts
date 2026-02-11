// ============================================================
// triggers/confirmationTimeoutTrigger.ts
// Chequeador asincrónico de confirmaciones vencidas
// BluePadel — Solo mock/pseudocódigo, sin ejecución real
//
// CUÁNDO SE EJECUTA:
//   Cada 5 minutos (cron: "*/5 * * * *")
//   Revisa partidos en estado "notified" para detectar:
//   1. Jugadores que no respondieron antes de su tiempoLimite (→ TIMEOUT)
//   2. Partidos donde todos confirmaron (→ cambiar a "confirmed")
//   3. Partidos sin posibilidad de recuperarse (→ cancelar)
//
// NO ejecuta procesos reales. Solo contiene lógica simulada.
// ============================================================

import { MATCHES, Match, getNotifiedMatches } from "../data/matches";
import { getPlayerById } from "../data/players";
import { SETTINGS } from "../data/settings";
import {
  PlayerNotification,
  obtenerPendientesVencidos,
  todosConfirmaron,
  contarJugadoresActivos,
} from "../data/playerMatchStatus";
import { simularConfirmarAsistencia } from "../flows/confirmationFlow";
import { simularBuscarReemplazo } from "../flows/replacementFlow";
import { simularCancelarPartidoAutomatico } from "../flows/cancellationFlow";

// ============================================================
// TIPOS DEL TRIGGER
// ============================================================

/** Resultado del procesamiento de UN partido en el check */
export interface PartidoCheckResult {
  matchId: string;
  accion:
    | "sin_cambios"         // Todos siguen en estado válido, sin vencimientos
    | "timeout_procesado"   // Al menos un jugador hizo timeout
    | "reemplazo_iniciado"  // Se inició búsqueda de reemplazo
    | "partido_confirmado"  // Todos los jugadores confirmaron ✅
    | "partido_cancelado"   // Sin reemplazos posibles → cancelado
    | "error";
  detalles: string[];       // Log de acciones tomadas
}

/** Resultado global de una ejecución del chequeador */
export interface CheckResult {
  ejecutadoEn: string;
  partidosRevisados: number;
  partidosConfirmados: number;
  partidosCancelados: number;
  timeoutsDetectados: number;
  reemplazosIniciados: number;
  resultados: PartidoCheckResult[];
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

/**
 * Punto de entrada del trigger de chequeo de confirmaciones.
 * Se ejecuta cada 5 minutos para manejar el flujo asincrónico.
 *
 * FLUJO POR PARTIDO EN ESTADO "notified":
 * 1. Revisar cada PlayerNotification con estado "pending"
 *    a. Si tiempoLimite >= ahora → aún está dentro del plazo (sin acción)
 *    b. Si tiempoLimite < ahora  → TIMEOUT → iniciar reemplazo
 * 2. Si todos confirmaron → marcar partido como "confirmed" + notificar
 * 3. Si quedaron jugadores inactivos pero no hay suficientes activos para reemplazar
 *    → cancelar el partido completo
 *
 * @param ahoraMock - Timestamp "actual" para el mock.
 *   En producción: new Date().toISOString()
 */
export function ejecutarCheckConfirmaciones(ahoraMock?: string): CheckResult {
  const ahora = ahoraMock ?? new Date().toISOString();

  console.log(`\n[CHECK CONFIRMACIONES] Ejecutando a las ${ahora}`);

  const partidosNotificados = getNotifiedMatches();

  if (partidosNotificados.length === 0) {
    console.log("[CHECK CONFIRMACIONES] No hay partidos en estado 'notified'. Nada que hacer.\n");
    return {
      ejecutadoEn: ahora,
      partidosRevisados: 0,
      partidosConfirmados: 0,
      partidosCancelados: 0,
      timeoutsDetectados: 0,
      reemplazosIniciados: 0,
      resultados: [],
    };
  }

  console.log(`[CHECK CONFIRMACIONES] Revisando ${partidosNotificados.length} partido(s)...\n`);

  const resultados: PartidoCheckResult[] = [];
  let partidosConfirmados = 0;
  let partidosCancelados = 0;
  let timeoutsDetectados = 0;
  let reemplazosIniciados = 0;

  for (const partido of partidosNotificados) {
    const result = procesarPartido(partido, ahora);
    resultados.push(result);

    // Contabilizar métricas
    if (result.accion === "partido_confirmado") partidosConfirmados++;
    if (result.accion === "partido_cancelado") partidosCancelados++;
    if (result.accion === "timeout_procesado" || result.accion === "reemplazo_iniciado") {
      timeoutsDetectados += result.detalles.filter((d) => d.includes("TIMEOUT")).length;
      if (result.accion === "reemplazo_iniciado") reemplazosIniciados++;
    }
  }

  console.log(`\n[CHECK CONFIRMACIONES] Resumen:`);
  console.log(`  Revisados:      ${partidosNotificados.length}`);
  console.log(`  Confirmados:    ${partidosConfirmados}`);
  console.log(`  Cancelados:     ${partidosCancelados}`);
  console.log(`  Timeouts:       ${timeoutsDetectados}`);
  console.log(`  Reemplazos:     ${reemplazosIniciados}\n`);

  return {
    ejecutadoEn: ahora,
    partidosRevisados: partidosNotificados.length,
    partidosConfirmados,
    partidosCancelados,
    timeoutsDetectados,
    reemplazosIniciados,
    resultados,
  };
}

// ============================================================
// PROCESAMIENTO POR PARTIDO
// ============================================================

/**
 * Evalúa y procesa el estado de confirmación de un único partido.
 *
 * Árbol de decisión:
 *
 *   ¿Tiene notificaciones?
 *   ├─ NO → error (partido mal formado)
 *   └─ SI → ¿Todos confirmaron?
 *           ├─ SI → accion "partido_confirmado"
 *           └─ NO → ¿Hay pending vencidos?
 *                   ├─ NO → accion "sin_cambios"
 *                   └─ SI → procesar cada vencido como TIMEOUT
 *                           → ¿Quedan suficientes jugadores activos?
 *                             ├─ SI (≥3) → buscar reemplazo por cada timeout
 *                             └─ NO (<3) → cancelar partido
 */
function procesarPartido(partido: Match, ahora: string): PartidoCheckResult {
  const detalles: string[] = [];

  // ── Validación: partido debe tener notificaciones
  if (!partido.notificaciones || partido.notificaciones.length === 0) {
    const msg = `Partido ${partido.id} en estado "notified" sin notificaciones. Estado inconsistente.`;
    console.error(`[CHECK CONFIRMACIONES] ${msg}`);
    return { matchId: partido.id, accion: "error", detalles: [msg] };
  }

  const notificaciones = partido.notificaciones;

  // ── CASO: Todos ya confirmaron
  if (todosConfirmaron(notificaciones)) {
    detalles.push("Todos los jugadores confirmaron. Partido listo.");
    marcarPartidoComoConfirmado(partido, ahora);
    notificarPartidoConfirmado(partido);
    return { matchId: partido.id, accion: "partido_confirmado", detalles };
  }

  // ── CASO: Buscar pendientes vencidos
  const vencidos = obtenerPendientesVencidos(notificaciones, ahora);

  if (vencidos.length === 0) {
    detalles.push("Sin vencimientos. Todos los jugadores aún están dentro del plazo.");
    return { matchId: partido.id, accion: "sin_cambios", detalles };
  }

  // ── CASO: Hay pendientes vencidos — procesar como TIMEOUT
  for (const notif of vencidos) {
    const jugador = getPlayerById(notif.playerId);
    const nombre = jugador?.nombre ?? notif.playerId;

    detalles.push(`TIMEOUT: ${nombre} (${notif.playerId}) no respondió antes de ${notif.tiempoLimite}`);
    console.log(`[CHECK CONFIRMACIONES] Partido ${partido.id} → TIMEOUT de ${nombre}`);

    // Registrar el timeout en la notificación
    // MOCK: En producción → UPDATE player_notifications SET estado="timeout" WHERE playerId=...
    notif.estado = "timeout";
    notif.respondioEn = ahora;

    // Llamar al flujo de confirmación con TIMEOUT
    // Esto actualiza el estado del partido en confirmationFlow
    if (jugador) {
      simularConfirmarAsistencia(jugador.telefono, partido.id, "TIMEOUT");
    }
  }

  // ── Evaluar si el partido puede recuperarse
  const activosRestantes = contarJugadoresActivos(notificaciones);
  const necesitanReemplazo = vencidos.length;

  // Si hay jugadores que hicieron timeout, necesitamos reemplazos
  // El partido puede recuperarse si quedan ≥ (4 - vencidos.length) jugadores activos
  // y hay candidatos en el pool global

  if (activosRestantes < SETTINGS.matching.jugadoresMinimosParaCrear) {
    // No hay suficientes jugadores para recuperar el partido
    detalles.push(`Solo quedan ${activosRestantes} jugadores activos. Cancelando partido.`);
    console.log(`[CHECK CONFIRMACIONES] Partido ${partido.id} → cancelando por insuficiencia de jugadores`);

    // MOCK: En producción → UPDATE matches SET estado="canceled"
    simularCancelarPartidoAutomatico(partido.id, "sin_confirmaciones");

    return { matchId: partido.id, accion: "partido_cancelado", detalles };
  }

  // Iniciar búsqueda de reemplazo para cada jugador que hizo timeout
  for (const notif of vencidos) {
    detalles.push(`Iniciando búsqueda de reemplazo para ${notif.playerId} (intento 1)`);
    console.log(`[CHECK CONFIRMACIONES] Partido ${partido.id} → buscando reemplazo para ${notif.playerId}`);

    const resultado = simularBuscarReemplazo(partido.id, notif.playerId, 1);

    detalles.push(`  Resultado: ${resultado.accion} — ${resultado.mensaje}`);

    if (resultado.accion === "partido_cancelado") {
      return { matchId: partido.id, accion: "partido_cancelado", detalles };
    }
  }

  return {
    matchId: partido.id,
    accion: necesitanReemplazo > 0 ? "reemplazo_iniciado" : "timeout_procesado",
    detalles,
  };
}

// ============================================================
// ACCIONES POST-CONFIRMACIÓN
// ============================================================

/**
 * Cambia el estado del partido a "confirmed" cuando todos confirmaron.
 * MOCK: Muta el objeto en memoria. En producción: UPDATE matches SET estado="confirmed".
 */
function marcarPartidoComoConfirmado(partido: Match, ahora: string): void {
  // MOCK: En producción → await db.matches.update({ id: partido.id, estado: "confirmed" })
  partido.estado = "confirmed";
  partido.confirmados = partido.jugadores; // Sincronizar campo legacy

  console.log(`[CHECK CONFIRMACIONES] ✅ Partido ${partido.id} marcado como CONFIRMED`);
}

/**
 * Notifica a todos los jugadores que el partido está confirmado.
 * Envía el mensaje de celebración con datos completos.
 *
 * LÓGICA REAL FUTURA:
 * - Por cada jugador → adapterProvider.sendMessage(telefono, mensaje)
 */
function notificarPartidoConfirmado(partido: Match): void {
  for (const playerId of partido.jugadores) {
    const jugador = getPlayerById(playerId);
    if (!jugador) continue;

    const otros = partido.jugadores
      .filter((id) => id !== playerId)
      .map((id) => getPlayerById(id)?.nombre ?? id)
      .join(", ");

    const mensaje = [
      `🎾 ¡Partido confirmado! Todos aceptaron.`,
      `*Fecha:* ${partido.horario}`,
      `*Cancha:* ${partido.canchaId}`,
      `*Tus rivales:* ${otros}`,
      ``,
      `Recordatorio ${SETTINGS.tiempos.minutosRecordatorioPrevio} minutos antes. ¡Buena suerte!`,
    ].join("\n");

    console.log(`[MOCK WhatsApp → ${jugador.telefono}] ✅ ${jugador.nombre}: "${mensaje}"`);
    // En producción: await adapterProvider.sendMessage(jugador.telefono, mensaje, {})
  }
}

// ============================================================
// GESTIÓN DE RESPUESTAS INDIVIDUALES (llamado desde app.ts)
// ============================================================

/**
 * Procesa la respuesta de UN jugador a la invitación de partido.
 * Se llama desde el flow de WhatsApp cuando el jugador responde "SI" o "NO".
 *
 * Esta función conecta el flujo de WhatsApp (reactivo, por mensaje)
 * con el estado asincrónico del partido (manejado por el cron).
 *
 * LÓGICA REAL FUTURA:
 * - Se llama desde addKeyword(["SI", "NO"]) en app.ts
 * - ctx.from = telefono del jugador
 * - ctx.body = "SI" o "NO"
 *
 * @param telefonoJugador - ctx.from del mensaje de WhatsApp
 * @param respuesta - "SI" o "NO"
 */
export function procesarRespuestaJugador(
  telefonoJugador: string,
  respuesta: "SI" | "NO"
): { mensaje: string; accion: string } {
  // 1. Encontrar el partido "notified" donde participa este jugador
  const partidoActivo = encontrarPartidoActivoDelJugador(telefonoJugador);

  if (!partidoActivo) {
    return {
      mensaje: "No encontré un partido pendiente de confirmación para vos. Si cometiste un error, contactá al club.",
      accion: "sin_partido",
    };
  }

  // 2. Delegar al flujo de confirmación existente
  const resultado = simularConfirmarAsistencia(
    telefonoJugador,
    partidoActivo.id,
    respuesta
  );

  // 3. Si respondió NO → iniciar búsqueda de reemplazo automáticamente
  if (respuesta === "NO" && resultado.accion === "rechazado" && resultado.playerId) {
    console.log(`[RESPUESTA JUGADOR] ${telefonoJugador} rechazó partido ${partidoActivo.id}. Buscando reemplazo...`);
    // En producción: esto podría ser async/defer
    // simularBuscarReemplazo(partidoActivo.id, resultado.playerId, 1)
  }

  // 4. Si fue el último en confirmar → partido listo
  if (resultado.partidoCompleto) {
    marcarPartidoComoConfirmado(partidoActivo, new Date().toISOString());
    notificarPartidoConfirmado(partidoActivo);
  }

  return {
    mensaje: resultado.mensaje,
    accion: resultado.accion,
  };
}

// ============================================================
// HELPER
// ============================================================

/**
 * Busca el primer partido "notified" al que pertenece el jugador con ese teléfono.
 * Usado para conectar la respuesta de WhatsApp con el partido correcto.
 */
function encontrarPartidoActivoDelJugador(telefono: string): Match | undefined {
  // MOCK: Buscar en MATCHES cargados en memoria
  // En producción: SELECT * FROM matches WHERE estado="notified" AND jugadores @> [playerId]

  return MATCHES.find((m) => {
    if (m.estado !== "notified") return false;
    // Verificar si alguno de los jugadores del partido tiene ese teléfono
    return m.jugadores.some((playerId) => {
      const player = getPlayerById(playerId);
      return player?.telefono === telefono;
    });
  });
}

// ============================================================
// CASOS DE PRUEBA — ejecutar manualmente para testear
// ============================================================

/**
 * Para probar localmente, descomentá y ejecutá con:
 *   npx tsx src/triggers/confirmationTimeoutTrigger.ts
 *
 * CASO 1: Sin partidos notificados — no hay nada que hacer
 *   Poner todos los MATCHES en estados distintos a "notified"
 *   ejecutarCheckConfirmaciones("2025-02-12T21:05:00")
 *   → Esperado: partidosRevisados: 0, mensaje "Nada que hacer"
 *
 * CASO 2: Partido m9 — p8 ya confirmó, p10 hizo timeout, p6 y p7 pending
 *   ejecutarCheckConfirmaciones("2025-02-12T21:05:00")
 *   → p10 timeout ya pasó (tiempoLimite 21:00) → buscar reemplazo
 *   → p6 y p7 aún están dentro del plazo (aún pending)
 *   → Esperado: accion "reemplazo_iniciado" para p10
 *
 * CASO 3: Todos confirmaron — partido listo
 *   Setear todos los notificaciones de m9 a estado "confirmed"
 *   ejecutarCheckConfirmaciones("2025-02-12T21:05:00")
 *   → Esperado: accion "partido_confirmado", mensajes a los 4 jugadores
 *
 * CASO 4: Nadie confirmó — todos hacen timeout
 *   Setear todos los notificaciones de m9 a tiempoLimite vencido y estado "pending"
 *   ejecutarCheckConfirmaciones("2025-02-12T22:00:00")
 *   → Esperado: 4 timeouts, búsqueda de reemplazo x4, posible cancelación
 *
 * CASO 5: No hay reemplazos disponibles (todos los jugadores en partidos activos)
 *   Poner todos los jugadores disponibles en MATCHES activos
 *   ejecutarCheckConfirmaciones(...)
 *   → Esperado: accion "partido_cancelado" tras maxIntentosReemplazo fallidos
 *
 * CASO 6: Respuesta directa por WhatsApp (SI)
 *   procesarRespuestaJugador("5491188990011", "SI")  ← p8 confirma
 *   → Esperado: accion "ya_confirmado" (p8 ya confirmó en m9)
 *
 * CASO 7: Respuesta directa por WhatsApp (NO) → reemplazo automático
 *   procesarRespuestaJugador("5491177889900", "NO")  ← p7 rechaza (pendiente en m9)
 *   → Esperado: accion "rechazado" + inicio de búsqueda de reemplazo
 */
