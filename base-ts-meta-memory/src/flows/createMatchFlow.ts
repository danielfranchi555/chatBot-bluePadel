// ============================================================
// flows/createMatchFlow.ts
// Lógica simulada de creación automática de partidos
// BluePadel — Solo mock/pseudocódigo, sin ejecución real
// ============================================================

import { PLAYERS, getPlayerByPhone, getPlayersByLevel, Player } from "../data/players";
import { MATCHES, Match, getOpenMatches } from "../data/matches";
import { COURTS, getAvailableCourtsByDay, Court } from "../data/courts";
import { SETTINGS } from "../data/settings";

// ============================================================
// TIPOS AUXILIARES
// ============================================================

export interface CreateMatchResult {
  success: boolean;
  matchId?: string;
  mensaje: string;
  estado: "creado" | "unido" | "completo" | "error";
}

// ============================================================
// FUNCIÓN PRINCIPAL — simulada, sin efectos reales
// ============================================================

/**
 * Simula la lógica de cuando un jugador quiere anotarse a un partido.
 *
 * FLUJO REAL FUTURO:
 * 1. Identificar al jugador por su número de WhatsApp
 * 2. Buscar partidos abiertos compatibles con su nivel
 * 3. Si hay partido abierto → sumarlo
 * 4. Si no hay partido → crear uno nuevo en "waiting"
 * 5. Si se completan 4 jugadores → cambiar estado a "confirmed" y notificar
 *
 * @param telefonoJugador - Número de WhatsApp del jugador que se anota
 * @param horarioSolicitado - Horario preferido (puede ser null si acepta cualquiera)
 */
export function simularAnotarseAPartido(
  telefonoJugador: string,
  horarioSolicitado: string | null
): CreateMatchResult {
  // ──────────────────────────────────────────────
  // PASO 1: Identificar al jugador
  // ──────────────────────────────────────────────

  const jugador = getPlayerByPhone(telefonoJugador);

  // [CASO DE PRUEBA] Jugador no registrado
  if (!jugador) {
    return {
      success: false,
      mensaje: "No encontré tu número en el sistema. Por favor contactá al club.",
      estado: "error",
    };
  }

  // [CASO DE PRUEBA] Jugador no disponible
  if (!jugador.disponible) {
    return {
      success: false,
      mensaje: `${jugador.nombre}, tu cuenta está marcada como no disponible. Escribinos para activarla.`,
      estado: "error",
    };
  }

  // ──────────────────────────────────────────────
  // PASO 2: Buscar partidos abiertos compatibles
  // ──────────────────────────────────────────────

  const partidosAbiertos = getOpenMatches();

  const partidoCompatible = encontrarPartidoCompatible(jugador, partidosAbiertos, horarioSolicitado);

  // ──────────────────────────────────────────────
  // PASO 3a: Hay partido abierto — unirse
  // ──────────────────────────────────────────────

  if (partidoCompatible) {
    // MOCK: En producción aquí se haría UPDATE en la BD
    const lugaresRestantes = 4 - partidoCompatible.jugadores.length;

    // [CASO DE PRUEBA] Partido incompleto — se une pero falta más gente
    if (lugaresRestantes > 1) {
      return {
        success: true,
        matchId: partidoCompatible.id,
        mensaje: `Te anotamos al partido del ${partidoCompatible.horario} en ${partidoCompatible.canchaId}. Faltan ${lugaresRestantes - 1} jugador(es) más.`,
        estado: "unido",
      };
    }

    // [CASO DE PRUEBA] Era el último lugar — partido completo
    return {
      success: true,
      matchId: partidoCompatible.id,
      mensaje: `¡El partido está completo! ${partidoCompatible.horario} en ${partidoCompatible.canchaId}. Confirmá tu asistencia respondiendo SI.`,
      estado: "completo",
    };
  }

  // ──────────────────────────────────────────────
  // PASO 3b: No hay partido abierto — crear uno nuevo
  // ──────────────────────────────────────────────

  // [CASO DE PRUEBA] Primer jugador en anotarse — crea partido nuevo
  const nuevaCancha = buscarCanchaDisponible(horarioSolicitado);

  if (!nuevaCancha) {
    return {
      success: false,
      mensaje: "No hay canchas disponibles para el horario solicitado. Probá con otro horario.",
      estado: "error",
    };
  }

  const nuevoPartidoId = `m${MATCHES.length + 1}`;
  // MOCK: En producción aquí se haría INSERT en la BD
  // await db.matches.create({ jugadores: [jugador.id], horario: horarioSolicitado, ... })

  return {
    success: true,
    matchId: nuevoPartidoId,
    mensaje: `¡Perfecto, ${jugador.nombre}! Creamos un partido para vos el ${horarioSolicitado ?? "próximo turno disponible"} en ${nuevaCancha.nombre}. Estamos buscando rivales de tu nivel (${jugador.nivelNumerico}) 🔍`,
    estado: "creado",
  };
}

// ============================================================
// HELPERS INTERNOS — lógica simulada
// ============================================================

/**
 * Busca un partido abierto compatible con el nivel del jugador.
 *
 * LÓGICA REAL FUTURA:
 * - Filtrar por nivel dentro de la tolerancia
 * - Opcionalmente filtrar por horario si el jugador especificó uno
 * - Priorizar el partido más cercano a completarse (3 jugadores > 2 > 1)
 */
function encontrarPartidoCompatible(
  jugador: Player,
  partidosAbiertos: Match[],
  horarioSolicitado: string | null
): Match | null {
  const { toleranciaDefault } = SETTINGS.nivel;

  const compatibles = partidosAbiertos.filter((partido) => {
    // Verificar tolerancia de nivel
    const dentroDeNivel =
      Math.abs(partido.nivelPromedio - jugador.nivelNumerico) <= toleranciaDefault;

    // Verificar horario si fue especificado
    const horarioOk = horarioSolicitado
      ? partido.horario.startsWith(horarioSolicitado)
      : true;

    return dentroDeNivel && horarioOk;
  });

  if (compatibles.length === 0) return null;

  // Priorizar el que tiene más jugadores (más cerca de completarse)
  compatibles.sort((a, b) => b.jugadores.length - a.jugadores.length);
  return compatibles[0];
}

/**
 * Simula la búsqueda de una cancha disponible para un horario.
 * MOCK: Siempre devuelve la primera cancha activa disponible.
 */
function buscarCanchaDisponible(horario: string | null): Court | null {
  // MOCK simplificado: devuelve la primera cancha activa
  // En producción: verificar disponibilidad real por fecha y slot
  const canchasActivas = COURTS.filter((c) => c.activa);
  return canchasActivas.length > 0 ? canchasActivas[0] : null;
}

// ============================================================
// CASOS DE PRUEBA — ejecutar manualmente para testear
// ============================================================

/**
 * Para probar localmente, descomentá y ejecutá con: npx tsx src/flows/createMatchFlow.ts
 *
 * CASO 1: Primer jugador en anotarse (crea partido nuevo)
 *   simularAnotarseAPartido("5491177889900", "2025-02-15T10:00:00")
 *   → Esperado: estado "creado", partido nuevo m9
 *
 * CASO 2: Jugador que se une a un partido existente (party m2 tiene 2 jugadores)
 *   simularAnotarseAPartido("5491177889900", null)
 *   → Esperado: estado "unido" si su nivel es compatible (nivelNumerico ~4.45)
 *
 * CASO 3: Jugador no registrado
 *   simularAnotarseAPartido("5490000000000", null)
 *   → Esperado: estado "error", mensaje de jugador no encontrado
 *
 * CASO 4: Jugador no disponible (p4 o p9)
 *   simularAnotarseAPartido("5491155667788", null)
 *   → Esperado: estado "error", mensaje de cuenta no disponible
 *
 * CASO 5: Mezcla de niveles — jugador nivel 5.9 busca partido de nivel 4.8
 *   Diferencia = 1.1 > toleranciaDefault (1.0) → no debería encontrar partido m2
 *   → Esperado: estado "creado" (crea partido nuevo)
 *
 * CASO 6: Partido que se completa (cuarto jugador)
 *   Si m3 tiene 3 jugadores y se suma el 4to con nivel compatible
 *   → Esperado: estado "completo", mensaje de confirmación
 *
 * CASO 7: Sin canchas disponibles
 *   Poner todas las canchas como activa: false y ejecutar
 *   → Esperado: estado "error", mensaje de sin canchas
 */
