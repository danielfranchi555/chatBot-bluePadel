// ============================================================
// flows/replacementFlow.ts
// Lógica simulada de búsqueda de reemplazos automáticos
// BluePadel — Solo mock/pseudocódigo, sin ejecución real
// ============================================================

import { PLAYERS, getPlayerById, getPlayersByLevel, Player } from "../data/players";
import { MATCHES, Match, getMatchById } from "../data/matches";
import { SETTINGS } from "../data/settings";

// ============================================================
// TIPOS AUXILIARES
// ============================================================

export interface ReplacementResult {
  success: boolean;
  matchId: string;
  reemplazadoId?: string;    // Jugador que sale
  reemplazanteId?: string;   // Jugador que entra
  mensaje: string;
  intento: number;           // Qué intento de búsqueda es este
  accion: "encontrado" | "no_encontrado" | "partido_cancelado" | "error";
}

// ============================================================
// FUNCIÓN PRINCIPAL — simulada, sin efectos reales
// ============================================================

/**
 * Simula la búsqueda automática de un reemplazo para un jugador que canceló.
 *
 * FLUJO REAL FUTURO:
 * 1. Identificar el partido y el jugador a reemplazar
 * 2. Calcular el nivel necesario (basado en el promedio del partido)
 * 3. Buscar jugadores disponibles dentro de la tolerancia de nivel
 * 4. Excluir a los jugadores ya en el partido
 * 5. Notificar al primer candidato disponible
 * 6. Si no acepta o no responde → pasar al siguiente candidato
 * 7. Tras N intentos fallidos → cancelar el partido
 *
 * @param matchId - ID del partido que necesita reemplazo
 * @param jugadorReemplazadoId - ID del jugador que sale
 * @param intento - Número de intento actual (empieza en 1)
 */
export function simularBuscarReemplazo(
  matchId: string,
  jugadorReemplazadoId: string,
  intento: number = 1
): ReplacementResult {

  // ──────────────────────────────────────────────
  // PASO 1: Validar partido
  // ──────────────────────────────────────────────

  const partido = getMatchById(matchId);
  if (!partido) {
    return {
      success: false,
      matchId,
      mensaje: "El partido no existe.",
      intento,
      accion: "error",
    };
  }

  if (partido.estado === "canceled" || partido.estado === "completed") {
    return {
      success: false,
      matchId,
      mensaje: `El partido ya está en estado "${partido.estado}". No se requiere reemplazo.`,
      intento,
      accion: "error",
    };
  }

  // ──────────────────────────────────────────────
  // PASO 2: Verificar si superó el máximo de intentos
  // ──────────────────────────────────────────────

  const maxIntentos = SETTINGS.matching.maxIntentosReemplazo;

  // [CASO DE PRUEBA] Partido que no puede recuperarse — se cancela
  if (intento > maxIntentos) {
    console.log(`[MOCK] Partido ${matchId}: se agotaron los ${maxIntentos} intentos de reemplazo.`);
    // MOCK: En producción → UPDATE match.estado = "canceled"
    return {
      success: false,
      matchId,
      reemplazadoId: jugadorReemplazadoId,
      mensaje: `No se encontró reemplazo después de ${maxIntentos} intentos. El partido del ${partido.horario} fue cancelado. Lo sentimos 😔`,
      intento,
      accion: "partido_cancelado",
    };
  }

  // ──────────────────────────────────────────────
  // PASO 3: Buscar candidatos a reemplazo
  // ──────────────────────────────────────────────

  const candidatos = buscarCandidatos(partido, jugadorReemplazadoId);

  // [CASO DE PRUEBA] No hay candidatos disponibles en este intento
  if (candidatos.length === 0) {
    console.log(`[MOCK] Intento ${intento}/${maxIntentos} — sin candidatos disponibles para nivel ${partido.nivelPromedio}`);

    // Intentar con tolerancia extendida si es el 2do intento
    if (intento === 2) {
      const candidatosExtendidos = buscarCandidatos(partido, jugadorReemplazadoId, true);
      if (candidatosExtendidos.length === 0) {
        return {
          success: false,
          matchId,
          reemplazadoId: jugadorReemplazadoId,
          mensaje: `Intento ${intento}: No hay jugadores de nivel compatible disponibles (tolerancia extendida).`,
          intento,
          accion: "no_encontrado",
        };
      }
      return notificarCandidato(partido, candidatosExtendidos[0], jugadorReemplazadoId, intento);
    }

    return {
      success: false,
      matchId,
      reemplazadoId: jugadorReemplazadoId,
      mensaje: `Intento ${intento}/${maxIntentos}: No encontramos reemplazo disponible. Reintentando...`,
      intento,
      accion: "no_encontrado",
    };
  }

  // ──────────────────────────────────────────────
  // PASO 4: Notificar al primer candidato
  // ──────────────────────────────────────────────

  // [CASO DE PRUEBA] Reemplazo encontrado exitosamente
  return notificarCandidato(partido, candidatos[0], jugadorReemplazadoId, intento);
}

// ============================================================
// FUNCIÓN: Simular respuesta de un candidato a reemplazo
// ============================================================

/**
 * Simula la respuesta de un jugador candidato a ser reemplazo.
 *
 * En el flujo real, esto sucede cuando el candidato responde
 * "SI" o "NO" al mensaje de WhatsApp enviado por el bot.
 *
 * @param matchId - ID del partido
 * @param candidatoId - ID del jugador candidato
 * @param jugadorReemplazadoId - ID del jugador que salió
 * @param acepto - Si el candidato aceptó o rechazó
 * @param intentoActual - Número de intento actual
 */
export function simularRespuestaCandidato(
  matchId: string,
  candidatoId: string,
  jugadorReemplazadoId: string,
  acepto: boolean,
  intentoActual: number
): ReplacementResult {

  const partido = getMatchById(matchId);
  const candidato = getPlayerById(candidatoId);

  if (!partido || !candidato) {
    return {
      success: false,
      matchId,
      mensaje: "Datos inválidos para procesar la respuesta.",
      intento: intentoActual,
      accion: "error",
    };
  }

  // [CASO DE PRUEBA] Candidato acepta ser reemplazo
  if (acepto) {
    // MOCK: En producción → UPDATE match.jugadores: reemplazar reemplazadoId por candidatoId
    return {
      success: true,
      matchId,
      reemplazadoId: jugadorReemplazadoId,
      reemplazanteId: candidatoId,
      mensaje: `¡${candidato.nombre} aceptó sumarse al partido del ${partido.horario}! El partido sigue en pie 🎾`,
      intento: intentoActual,
      accion: "encontrado",
    };
  }

  // [CASO DE PRUEBA] Candidato rechaza — buscar siguiente
  console.log(`[MOCK] ${candidato.nombre} rechazó. Buscando siguiente candidato (intento ${intentoActual + 1})`);
  return simularBuscarReemplazo(matchId, jugadorReemplazadoId, intentoActual + 1);
}

// ============================================================
// HELPERS INTERNOS
// ============================================================

/**
 * Busca candidatos a reemplazo compatibles en nivel.
 * Excluye a los jugadores ya en el partido y a los no disponibles.
 *
 * @param toleranciaExtendida - Si es true, usa toleranciaExtendida en vez de default
 */
function buscarCandidatos(
  partido: Match,
  jugadorReemplazadoId: string,
  toleranciaExtendida: boolean = false
): Player[] {
  const { toleranciaDefault, toleranciaExtendida: tolExt } = SETTINGS.nivel;
  const tolerancia = toleranciaExtendida ? tolExt : toleranciaDefault;

  return PLAYERS.filter((p) => {
    // Excluir jugadores ya en el partido
    const yaEnPartido = partido.jugadores.includes(p.id);
    // Excluir al jugador que salió (ya no está pero por seguridad)
    const esReemplazado = p.id === jugadorReemplazadoId;
    // Verificar disponibilidad
    const disponible = p.disponible;
    // Verificar tolerancia de nivel
    const nivelCompatible =
      Math.abs(p.nivelNumerico - partido.nivelPromedio) <= tolerancia;

    return !yaEnPartido && !esReemplazado && disponible && nivelCompatible;
  });
}

/**
 * Genera el resultado de notificación a un candidato.
 * MOCK: Simula el mensaje que se enviaría por WhatsApp.
 */
function notificarCandidato(
  partido: Match,
  candidato: Player,
  jugadorReemplazadoId: string,
  intento: number
): ReplacementResult {

  const mensaje = SETTINGS.mensajes.reemplazoEncontrado.replace(
    "{{nombre}}",
    candidato.nombre
  );

  console.log(`[MOCK] Intento ${intento}: Notificando a ${candidato.nombre} (${candidato.telefono})`);
  console.log(`[MOCK] Mensaje: "¿Podés jugar el ${partido.horario} en ${partido.canchaId}? Responde SI o NO"`);
  // En producción: await provider.sendMessage(candidato.telefono, mensajeDeInvitacion)

  return {
    success: true,
    matchId: partido.id,
    reemplazadoId: jugadorReemplazadoId,
    reemplazanteId: candidato.id,
    mensaje: `${mensaje} — notificando a ${candidato.nombre} (intento ${intento}/${SETTINGS.matching.maxIntentosReemplazo})`,
    intento,
    accion: "encontrado",
  };
}

// ============================================================
// CASOS DE PRUEBA — ejecutar manualmente para testear
// ============================================================

/**
 * Para probar localmente, descomentá y ejecutá con: npx tsx src/flows/replacementFlow.ts
 *
 * CASO 1: Reemplazo encontrado en primer intento
 *   simularBuscarReemplazo("m3", "p12", 1)
 *   → m3 tiene nivelPromedio 6.53, busca jugadores disponibles de nivel ~6.53
 *   → Esperado: candidato encontrado (ej: p13 nivel 6.0 ✓)
 *
 * CASO 2: Sin candidatos — intento 2 con tolerancia extendida
 *   Poner todos los jugadores de nivel ~6 como disponible: false
 *   simularBuscarReemplazo("m3", "p12", 2)
 *   → Esperado: búsqueda con toleranciaExtendida (1.5), puede encontrar más
 *
 * CASO 3: Se agotaron los intentos — partido cancelado
 *   simularBuscarReemplazo("m3", "p12", 4)  // maxIntentos = 3
 *   → Esperado: accion "partido_cancelado", mensaje de cancelación
 *
 * CASO 4: Candidato acepta el reemplazo
 *   simularRespuestaCandidato("m3", "p13", "p12", true, 1)
 *   → Esperado: accion "encontrado", partido recuperado ✅
 *
 * CASO 5: Candidato rechaza → se pasa al siguiente
 *   simularRespuestaCandidato("m3", "p13", "p12", false, 1)
 *   → Esperado: llamada recursiva con intento 2
 *
 * CASO 6: Partido ya cancelado — no se puede reemplazar
 *   simularBuscarReemplazo("m4", "p2", 1)
 *   → Esperado: accion "error", partido en estado "canceled"
 *
 * CASO 7: Mezcla de niveles extremos — sin candidatos compatibles
 *   Crear partido con nivel 3.9 y buscar reemplazo
 *   → Si no hay jugadores disponibles de nivel 3-4 → accion "no_encontrado"
 */
