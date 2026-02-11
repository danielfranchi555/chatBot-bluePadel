// ============================================================
// flows/questionFlow.ts
// Lógica simulada de consultas de jugadores
// BluePadel — Solo mock/pseudocódigo, sin ejecución real
// ============================================================

import { getPlayerByPhone, getPlayerById } from "../data/players";
import { getMatchById, getMatchesByPlayer } from "../data/matches";
import { getCourtById } from "../data/courts";

// ============================================================
// TIPOS AUXILIARES
// ============================================================

export type QuestionType =
  | "proximo_partido"    // ¿Cuándo es mi próximo partido?
  | "contra_quien"       // ¿Contra quién juego?
  | "en_que_cancha"      // ¿En qué cancha es?
  | "a_que_hora"         // ¿A qué hora es el partido?
  | "mis_partidos"       // ¿Cuáles son todos mis partidos?
  | "estado_partido";    // ¿Cuál es el estado de mi partido?

export interface QuestionResult {
  success: boolean;
  tipo: QuestionType | "error";
  respuesta: string;
  datos?: Record<string, unknown>;   // Datos estructurados para debug
}

// ============================================================
// FUNCIÓN PRINCIPAL — simulada, sin efectos reales
// ============================================================

/**
 * Simula la resolución de una consulta de un jugador.
 *
 * FLUJO REAL FUTURO:
 * 1. Identificar al jugador por WhatsApp
 * 2. Interpretar el tipo de consulta (NLP o keywords)
 * 3. Buscar datos relevantes
 * 4. Armar respuesta en lenguaje natural
 *
 * @param telefonoJugador - Número de WhatsApp del jugador
 * @param tipoPregunta - Qué tipo de consulta hace
 * @param matchId - Opcional: si el jugador pregunta por un partido específico
 */
export function simularResponderConsulta(
  telefonoJugador: string,
  tipoPregunta: QuestionType,
  matchId?: string
): QuestionResult {

  // ──────────────────────────────────────────────
  // PASO 1: Identificar jugador
  // ──────────────────────────────────────────────

  const jugador = getPlayerByPhone(telefonoJugador);
  if (!jugador) {
    return {
      success: false,
      tipo: "error",
      respuesta: "No encontré tu número en el sistema. Por favor contactá al club.",
    };
  }

  // ──────────────────────────────────────────────
  // PASO 2: Derivar a la consulta correspondiente
  // ──────────────────────────────────────────────

  switch (tipoPregunta) {
    case "proximo_partido":
      return consultarProximoPartido(jugador.id);

    case "contra_quien":
      return consultarContraQuien(jugador.id, matchId);

    case "en_que_cancha":
      return consultarCancha(jugador.id, matchId);

    case "a_que_hora":
      return consultarHorario(jugador.id, matchId);

    case "mis_partidos":
      return consultarTodosLosPartidos(jugador.id);

    case "estado_partido":
      return consultarEstadoPartido(jugador.id, matchId);

    default:
      return {
        success: false,
        tipo: "error",
        respuesta: "No entendí tu consulta. Podés preguntarme: 'próximo partido', '¿contra quién juego?', '¿en qué cancha?', '¿a qué hora?'",
      };
  }
}

// ============================================================
// HANDLERS DE CONSULTAS ESPECÍFICAS
// ============================================================

/**
 * Consulta: ¿Cuándo es mi próximo partido?
 * Devuelve el partido con horario futuro más cercano.
 */
function consultarProximoPartido(jugadorId: string): QuestionResult {
  const partidos = getMatchesByPlayer(jugadorId);

  // Filtrar partidos futuros y activos
  const activos = partidos
    .filter((m) => m.estado === "waiting" || m.estado === "confirmed")
    .sort((a, b) => a.horario.localeCompare(b.horario));

  // [CASO DE PRUEBA] Jugador sin partidos próximos
  if (activos.length === 0) {
    return {
      success: true,
      tipo: "proximo_partido",
      respuesta: "No tenés partidos próximos. ¿Querés que te anotemos a uno? Escribí 'quiero jugar'.",
    };
  }

  const proximo = activos[0];
  const cancha = getCourtById(proximo.canchaId);

  return {
    success: true,
    tipo: "proximo_partido",
    respuesta: `Tu próximo partido es el *${formatearFecha(proximo.horario)}*${cancha ? ` en ${cancha.nombre}` : ""}. Estado: *${proximo.estado}* ✅`,
    datos: { matchId: proximo.id, horario: proximo.horario, canchaId: proximo.canchaId },
  };
}

/**
 * Consulta: ¿Contra quién juego?
 * Devuelve los nombres de los rivales.
 */
function consultarContraQuien(jugadorId: string, matchId?: string): QuestionResult {
  const partido = resolverPartido(jugadorId, matchId);

  if (!partido) {
    return {
      success: false,
      tipo: "contra_quien",
      respuesta: "No encontré un partido activo para vos. ¿Querés anotarte? Escribí 'quiero jugar'.",
    };
  }

  // Los "rivales" son los otros jugadores del partido
  const otrosIds = partido.jugadores.filter((id) => id !== jugadorId);
  const otros = otrosIds.map((id) => getPlayerById(id)?.nombre ?? id);

  if (otros.length === 0) {
    return {
      success: true,
      tipo: "contra_quien",
      respuesta: "Aún no hay otros jugadores confirmados en tu partido. Estamos buscando rivales 🔍",
    };
  }

  // [CASO DE PRUEBA] Partido incompleto — solo 1 o 2 rivales conocidos
  if (otros.length < 3) {
    return {
      success: true,
      tipo: "contra_quien",
      respuesta: `Por ahora están anotados: *${otros.join(", ")}*. Faltan ${3 - otros.length} jugador(es) más para completar el partido.`,
      datos: { matchId: partido.id, jugadores: otros },
    };
  }

  // [CASO DE PRUEBA] Partido completo — 3 rivales conocidos
  return {
    success: true,
    tipo: "contra_quien",
    respuesta: `Vas a jugar con/contra: *${otros.join(", ")}* 🎾\nPartido el ${formatearFecha(partido.horario)}.`,
    datos: { matchId: partido.id, jugadores: otros },
  };
}

/**
 * Consulta: ¿En qué cancha es?
 */
function consultarCancha(jugadorId: string, matchId?: string): QuestionResult {
  const partido = resolverPartido(jugadorId, matchId);

  if (!partido) {
    return {
      success: false,
      tipo: "en_que_cancha",
      respuesta: "No encontré un partido activo para vos.",
    };
  }

  const cancha = getCourtById(partido.canchaId);

  if (!cancha) {
    return {
      success: true,
      tipo: "en_que_cancha",
      respuesta: `La cancha asignada es: *${partido.canchaId}* (información detallada no disponible).`,
    };
  }

  return {
    success: true,
    tipo: "en_que_cancha",
    respuesta: `Tu partido es en *${cancha.nombre}* (${cancha.tipo}) 📍`,
    datos: { canchaId: cancha.id, nombre: cancha.nombre, tipo: cancha.tipo },
  };
}

/**
 * Consulta: ¿A qué hora es?
 */
function consultarHorario(jugadorId: string, matchId?: string): QuestionResult {
  const partido = resolverPartido(jugadorId, matchId);

  if (!partido) {
    return {
      success: false,
      tipo: "a_que_hora",
      respuesta: "No encontré un partido activo para vos.",
    };
  }

  return {
    success: true,
    tipo: "a_que_hora",
    respuesta: `Tu partido es el *${formatearFecha(partido.horario)}* ⏰`,
    datos: { matchId: partido.id, horario: partido.horario },
  };
}

/**
 * Consulta: Dame todos mis partidos
 */
function consultarTodosLosPartidos(jugadorId: string): QuestionResult {
  const partidos = getMatchesByPlayer(jugadorId);

  if (partidos.length === 0) {
    return {
      success: true,
      tipo: "mis_partidos",
      respuesta: "No tenés partidos registrados. ¿Querés anotarte? Escribí 'quiero jugar'.",
    };
  }

  const resumen = partidos
    .map((m) => `• ${formatearFecha(m.horario)} — ${m.estado.toUpperCase()} (${m.canchaId})`)
    .join("\n");

  return {
    success: true,
    tipo: "mis_partidos",
    respuesta: `Tus partidos:\n${resumen}`,
    datos: { total: partidos.length },
  };
}

/**
 * Consulta: ¿Cuál es el estado de mi partido?
 */
function consultarEstadoPartido(jugadorId: string, matchId?: string): QuestionResult {
  const partido = resolverPartido(jugadorId, matchId);

  if (!partido) {
    return {
      success: false,
      tipo: "estado_partido",
      respuesta: "No encontré el partido.",
    };
  }

  const estadoMensaje: Record<string, string> = {
    waiting: `🟡 Esperando jugadores (${partido.jugadores.length}/4 anotados, ${partido.confirmados.length} confirmados)`,
    confirmed: `🟢 Confirmado — todos los jugadores aceptaron ✅`,
    canceled: `🔴 Cancelado${partido.motivoCancelacion ? `: ${partido.motivoCancelacion}` : ""}`,
    completed: `⚫ Completado — este partido ya se jugó`,
  };

  return {
    success: true,
    tipo: "estado_partido",
    respuesta: `Partido del ${formatearFecha(partido.horario)}: ${estadoMensaje[partido.estado]}`,
    datos: { matchId: partido.id, estado: partido.estado },
  };
}

// ============================================================
// HELPERS INTERNOS
// ============================================================

/**
 * Resuelve el partido: usa matchId si se provee, sino busca el próximo activo del jugador.
 */
function resolverPartido(jugadorId: string, matchId?: string) {
  if (matchId) return getMatchById(matchId);

  const activos = getMatchesByPlayer(jugadorId)
    .filter((m) => m.estado === "waiting" || m.estado === "confirmed")
    .sort((a, b) => a.horario.localeCompare(b.horario));

  return activos[0] ?? null;
}

/**
 * Formatea una fecha ISO a formato legible en español.
 * MOCK: Simplificado sin librería de fechas.
 */
function formatearFecha(isoString: string): string {
  try {
    const fecha = new Date(isoString);
    return fecha.toLocaleString("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

// ============================================================
// CASOS DE PRUEBA — ejecutar manualmente para testear
// ============================================================

/**
 * Para probar localmente, descomentá y ejecutá con: npx tsx src/flows/questionFlow.ts
 *
 * CASO 1: Consultar próximo partido (jugador con partido confirmado)
 *   simularResponderConsulta("5491177889900", "proximo_partido")
 *   → Esperado: partido m1 del 2025-02-12 10:00
 *
 * CASO 2: ¿Contra quién juego? — partido completo
 *   simularResponderConsulta("5491177889900", "contra_quien", "m1")
 *   → Esperado: nombres de p7, p8, p10
 *
 * CASO 3: ¿Contra quién juego? — partido incompleto (m2 solo tiene 2 jugadores)
 *   simularResponderConsulta("5491144556677", "contra_quien", "m2")
 *   → Esperado: "Faltan 2 jugadores más"
 *
 * CASO 4: ¿En qué cancha? — cancha con datos completos
 *   simularResponderConsulta("5491177889900", "en_que_cancha", "m1")
 *   → Esperado: "Cancha 1 - Cristal (interna)"
 *
 * CASO 5: Jugador sin partidos activos
 *   simularResponderConsulta("5491199001122", "proximo_partido")
 *   → Esperado: mensaje de sin partidos próximos
 *
 * CASO 6: Estado de partido cancelado
 *   simularResponderConsulta("5491122334455", "estado_partido", "m4")
 *   → Esperado: mensaje rojo con motivo de cancelación
 *
 * CASO 7: Todos mis partidos (jugador con múltiples)
 *   simularResponderConsulta("5491177889900", "mis_partidos")
 *   → Esperado: lista de partidos con estado
 */
