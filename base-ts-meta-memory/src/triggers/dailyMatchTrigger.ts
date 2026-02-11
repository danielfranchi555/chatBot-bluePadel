// ============================================================
// triggers/dailyMatchTrigger.ts
// Trigger diario para creación automática de partidos
// BluePadel — Solo mock/pseudocódigo, sin ejecución real
//
// CUÁNDO SE EJECUTA:
//   Todos los días a las 20:00 (cron: "0 20 * * *")
//   Crea partidos para el día SIGUIENTE basándose en jugadores disponibles
//
// NO ejecuta procesos reales. Solo contiene lógica simulada.
// ============================================================

import { PLAYERS, getPlayersByLevel, Player } from "../data/players";
import { MATCHES, Match, getMatchesByPlayer, getMatchesExpirados } from "../data/matches";
import { COURTS, Court, DayOfWeek, getAvailableCourtsByDay } from "../data/courts";
import { SETTINGS } from "../data/settings";
import {
  PlayerNotification,
  crearNotificacionPendiente,
} from "../data/playerMatchStatus";
import { simularCancelarPartidoAutomatico } from "../flows/cancellationFlow";

// ============================================================
// TIPOS DEL TRIGGER
// ============================================================

/**
 * Propuesta de partido generada por el algoritmo de agrupamiento.
 * Todavía no es un Match — es el resultado del agrupamiento antes
 * de persistirlo y enviar notificaciones.
 */
export interface MatchProposal {
  jugadores: Player[];
  horario: string;
  canchaId: string;
  nivelPromedio: number;
  categoria: number;        // Categoría mayoritaria del grupo
}

/**
 * Resultado completo de una ejecución del trigger diario.
 * Útil para logging, debugging y auditoría.
 */
export interface TriggerResult {
  fechaObjetivo: string;    // Día para el que se crean partidos (ISO date "YYYY-MM-DD")
  ejecutadoEn: string;      // Timestamp de la ejecución (ISO)
  partidosCreados: number;
  jugadoresAgrupados: number;
  jugadoresSinPartido: string[];  // IDs de jugadores que no entraron en ningún grupo
  partidosExpiradosCancelados: number;
  errores: string[];
  proposals: MatchProposal[];
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

/**
 * Punto de entrada del trigger diario.
 * Orquesta todo el proceso: limpieza, agrupamiento, asignación y notificación.
 *
 * FLUJO COMPLETO:
 * 1. Determinar la fecha objetivo (mañana por defecto)
 * 2. Cancelar partidos expirados (waiting > 48hs)
 * 3. Obtener jugadores elegibles para hoy
 * 4. Agrupar por nivel numérico con tolerancia configurable
 * 5. Asignar cancha y horario a cada grupo
 * 6. Crear los Match con estado "notified"
 * 7. Generar PlayerNotification[] por jugador
 * 8. Enviar primer mensaje WhatsApp a cada jugador
 *
 * @param fechaObjetivoMock - Fecha ISO para la que crear partidos.
 *   Por defecto: mañana. Parametrizable para pruebas.
 * @param ahoraMock - Timestamp "actual" para el mock.
 *   En producción: new Date().toISOString()
 */
export function ejecutarTriggerDiario(
  fechaObjetivoMock?: string,
  ahoraMock?: string
): TriggerResult {
  const ahora = ahoraMock ?? new Date().toISOString();
  const fechaObjetivo = fechaObjetivoMock ?? calcularManana(ahora);

  console.log(`\n[TRIGGER DIARIO] Ejecutando para fecha: ${fechaObjetivo}`);
  console.log(`[TRIGGER DIARIO] Timestamp de ejecución: ${ahora}\n`);

  const errores: string[] = [];
  const proposals: MatchProposal[] = [];

  // ──────────────────────────────────────────────
  // PASO 1: Cancelar partidos expirados (limpieza)
  // ──────────────────────────────────────────────

  const { horasMaximaEsperaPartido } = SETTINGS.tiempos;
  const expirados = getMatchesExpirados(horasMaximaEsperaPartido, ahora);
  let partidosExpiradosCancelados = 0;

  for (const partido of expirados) {
    console.log(`[TRIGGER DIARIO] Cancelando partido expirado: ${partido.id}`);
    // MOCK: En producción → UPDATE match.estado = "canceled"
    simularCancelarPartidoAutomatico(partido.id, "partido_expirado");
    partidosExpiradosCancelados++;
  }

  // ──────────────────────────────────────────────
  // PASO 2: Obtener jugadores elegibles
  // ──────────────────────────────────────────────

  const jugadoresElegibles = obtenerJugadoresElegibles(ahora);
  console.log(`[TRIGGER DIARIO] Jugadores elegibles: ${jugadoresElegibles.length}`);

  if (jugadoresElegibles.length < 4) {
    const msg = `Solo hay ${jugadoresElegibles.length} jugadores elegibles. Se necesitan al menos 4 para crear un partido.`;
    console.warn(`[TRIGGER DIARIO] ${msg}`);
    return {
      fechaObjetivo,
      ejecutadoEn: ahora,
      partidosCreados: 0,
      jugadoresAgrupados: 0,
      jugadoresSinPartido: jugadoresElegibles.map((p) => p.id),
      partidosExpiradosCancelados,
      errores: [msg],
      proposals: [],
    };
  }

  // ──────────────────────────────────────────────
  // PASO 3: Agrupar jugadores por nivel
  // ──────────────────────────────────────────────

  const { grupos, sinGrupo } = agruparJugadoresPorNivel(jugadoresElegibles);

  console.log(`[TRIGGER DIARIO] Grupos formados: ${grupos.length}`);
  console.log(`[TRIGGER DIARIO] Jugadores sin grupo: ${sinGrupo.length} (${sinGrupo.map((p) => p.nombre).join(", ")})`);

  // ──────────────────────────────────────────────
  // PASO 4: Obtener canchas disponibles para la fecha objetivo
  // ──────────────────────────────────────────────

  const diaSemana = calcularDiaSemana(fechaObjetivo);
  const canchasDisponibles = getAvailableCourtsByDay(diaSemana);

  if (canchasDisponibles.length === 0) {
    const msg = `No hay canchas disponibles el ${diaSemana}.`;
    console.warn(`[TRIGGER DIARIO] ${msg}`);
    return {
      fechaObjetivo,
      ejecutadoEn: ahora,
      partidosCreados: 0,
      jugadoresAgrupados: 0,
      jugadoresSinPartido: jugadoresElegibles.map((p) => p.id),
      partidosExpiradosCancelados,
      errores: [msg],
      proposals: [],
    };
  }

  // ──────────────────────────────────────────────
  // PASO 5: Asignar cancha y horario a cada grupo
  // ──────────────────────────────────────────────

  // Pool de slots disponibles (cancha × slot), distribuido en round-robin
  const slotsDisponibles = generarPoolDeSlots(canchasDisponibles, fechaObjetivo);
  let slotIndex = 0;

  for (const grupo of grupos) {
    if (slotIndex >= slotsDisponibles.length) {
      const msg = `No hay suficientes slots disponibles. ${grupos.length - proposals.length} grupos sin asignar.`;
      console.warn(`[TRIGGER DIARIO] ${msg}`);
      errores.push(msg);
      break;
    }

    const slot = slotsDisponibles[slotIndex++];
    const nivelPromedio =
      grupo.reduce((sum, p) => sum + p.nivelNumerico, 0) / grupo.length;
    const categoriaGrupo = Math.round(nivelPromedio);

    const proposal: MatchProposal = {
      jugadores: grupo,
      horario: slot.horario,
      canchaId: slot.canchaId,
      nivelPromedio: Math.round(nivelPromedio * 100) / 100,
      categoria: categoriaGrupo,
    };

    proposals.push(proposal);
  }

  // ──────────────────────────────────────────────
  // PASO 6: Crear partidos y enviar primer mensaje
  // ──────────────────────────────────────────────

  let partidosCreados = 0;

  for (const proposal of proposals) {
    try {
      const matchId = crearPartidoNotificado(proposal, ahora);
      simularEnviarPrimerMensajeGrupo(proposal, matchId, ahora);
      partidosCreados++;
    } catch (e) {
      const msg = `Error al crear partido para grupo de ${proposal.jugadores.map((p) => p.nombre).join(", ")}: ${e}`;
      console.error(`[TRIGGER DIARIO] ${msg}`);
      errores.push(msg);
    }
  }

  console.log(`\n[TRIGGER DIARIO] Resumen:`);
  console.log(`  Partidos creados:     ${partidosCreados}`);
  console.log(`  Jugadores agrupados:  ${jugadoresElegibles.length - sinGrupo.length}`);
  console.log(`  Sin partido hoy:      ${sinGrupo.length}`);
  console.log(`  Expirados cancelados: ${partidosExpiradosCancelados}`);
  if (errores.length > 0) {
    console.log(`  Errores:              ${errores.length}`);
  }

  return {
    fechaObjetivo,
    ejecutadoEn: ahora,
    partidosCreados,
    jugadoresAgrupados: jugadoresElegibles.length - sinGrupo.length,
    jugadoresSinPartido: sinGrupo.map((p) => p.id),
    partidosExpiradosCancelados,
    errores,
    proposals,
  };
}

// ============================================================
// PASO 2: Elegibilidad de jugadores
// ============================================================

/**
 * Devuelve el subconjunto de jugadores que pueden ser asignados a un partido hoy.
 *
 * Criterios de elegibilidad:
 * 1. `disponible: true` en el perfil del jugador
 * 2. No tener un partido activo (waiting, notified o confirmed) en la fecha objetivo
 *
 * NOTA: En producción este filtro consultaría la BD.
 * En el mock lee directamente el array MATCHES.
 */
function obtenerJugadoresElegibles(ahoraMock: string): Player[] {
  // IDs de jugadores ya en partidos activos
  const jugadoresOcupados = new Set<string>(
    MATCHES.filter((m) =>
      m.estado === "waiting" ||
      m.estado === "notified" ||
      m.estado === "confirmed"
    ).flatMap((m) => m.jugadores)
  );

  return PLAYERS.filter(
    (p) => p.disponible && !jugadoresOcupados.has(p.id)
  );
}

// ============================================================
// PASO 3: Algoritmo de agrupamiento por nivel
// ============================================================

/**
 * Agrupa jugadores en grupos de exactamente 4, minimizando la diferencia
 * de nivel dentro de cada grupo.
 *
 * ALGORITMO (ventana deslizante greedy):
 * 1. Ordenar jugadores por nivelNumerico ascendente
 * 2. Intentar formar grupos de 4 con toleranciaDefault (±1.0):
 *    - Tomar el primer jugador disponible
 *    - Buscar los 3 más cercanos en nivel dentro de la tolerancia
 *    - Si se encontraron 4 → crear grupo, remover del pool
 *    - Si no → intentar con toleranciaExtendida (±1.5)
 *    - Si tampoco → dejar al jugador en sinGrupo
 * 3. Continuar hasta que no queden jugadores o no se puedan formar más grupos
 *
 * BALANCEO DE PAREJAS (si MATCHING_RULES.balancearParejas = true):
 * - Dentro del grupo de 4, los índices [0,3] son pareja vs [1,2]
 *   (el mejor y el peor juntos, para equilibrar el partido)
 *
 * @param jugadores - Lista de jugadores elegibles (ya filtrados)
 */
export function agruparJugadoresPorNivel(jugadores: Player[]): {
  grupos: Player[][];
  sinGrupo: Player[];
} {
  const { toleranciaDefault, toleranciaExtendida } = SETTINGS.nivel;
  const { balancearParejas } = SETTINGS.matching;

  // 1. Ordenar por nivel
  const pool = [...jugadores].sort((a, b) => a.nivelNumerico - b.nivelNumerico);

  const grupos: Player[][] = [];
  const usados = new Set<string>();

  for (let i = 0; i < pool.length; i++) {
    const ancla = pool[i];
    if (usados.has(ancla.id)) continue;

    // Buscar los 3 candidatos más cercanos dentro de la tolerancia default
    let candidatos = pool.filter(
      (p) =>
        !usados.has(p.id) &&
        p.id !== ancla.id &&
        Math.abs(p.nivelNumerico - ancla.nivelNumerico) <= toleranciaDefault
    );

    // Si no hay suficientes con tolerancia default → probar tolerancia extendida
    if (candidatos.length < 3) {
      candidatos = pool.filter(
        (p) =>
          !usados.has(p.id) &&
          p.id !== ancla.id &&
          Math.abs(p.nivelNumerico - ancla.nivelNumerico) <= toleranciaExtendida
      );
    }

    // No hay suficientes jugadores compatibles
    if (candidatos.length < 3) continue;

    // Tomar los 3 más cercanos al ancla en nivel
    const tresmas = candidatos
      .sort((a, b) =>
        Math.abs(a.nivelNumerico - ancla.nivelNumerico) -
        Math.abs(b.nivelNumerico - ancla.nivelNumerico)
      )
      .slice(0, 3);

    const grupo = [ancla, ...tresmas];

    // Balanceo de parejas: mejor + peor vs los 2 del medio
    const grupoFinal = balancearParejas ? balancearGrupo(grupo) : grupo;

    grupoFinal.forEach((p) => usados.add(p.id));
    grupos.push(grupoFinal);
  }

  const sinGrupo = pool.filter((p) => !usados.has(p.id));

  return { grupos, sinGrupo };
}

/**
 * Reordena un grupo de 4 jugadores para balancear parejas.
 * Pareja 1: [mejor, peor] → índices [0, 3]
 * Pareja 2: [segundo, tercero] → índices [1, 2]
 *
 * Esto busca que cada pareja tenga niveles similares sumados.
 */
function balancearGrupo(grupo: Player[]): Player[] {
  const ordenado = [...grupo].sort((a, b) => a.nivelNumerico - b.nivelNumerico);
  // [0]=peor, [1]=2do, [2]=3ro, [3]=mejor
  // Pareja 1: 0 + 3 = peor + mejor (equivalentes en suma)
  // Pareja 2: 1 + 2 = niveles medios
  return [ordenado[0], ordenado[2], ordenado[1], ordenado[3]];
}

// ============================================================
// PASO 4: Pool de slots (cancha + horario)
// ============================================================

interface SlotDisponible {
  canchaId: string;
  horario: string;  // ISO 8601 completo (fecha + hora)
}

/**
 * Genera un pool lineal de combinaciones cancha × slot para el día objetivo.
 * Distribuye los slots en round-robin entre todas las canchas activas.
 *
 * Ej: [c1/10:00, c2/10:00, c3/10:00, c1/11:30, c2/11:30, ...]
 *
 * @param canchas - Canchas activas para el día
 * @param fechaObjetivo - "YYYY-MM-DD"
 */
function generarPoolDeSlots(canchas: Court[], fechaObjetivo: string): SlotDisponible[] {
  const slots = SETTINGS.horarios.slots;
  const pool: SlotDisponible[] = [];

  // Usar slot más popular (tarde-noche) primero: 18:00, 19:30, 20:00...
  // MOCK: Simplificado — usa el orden tal como viene en settings
  for (const slot of slots) {
    for (const cancha of canchas) {
      const slotEnCancha = cancha.horariosDisponibles.find(
        (h) => h.inicio === slot
      );
      if (slotEnCancha) {
        pool.push({
          canchaId: cancha.id,
          horario: `${fechaObjetivo}T${slot}:00`,
        });
      }
    }
  }

  return pool;
}

// ============================================================
// PASO 6a: Crear partido en estado "notified"
// ============================================================

/**
 * Crea un Match con estado "notified" a partir de una MatchProposal.
 * Genera el array de PlayerNotification[] con estado "pending" para cada jugador.
 *
 * MOCK: Pushea al array MATCHES en memoria.
 * En producción: INSERT INTO matches + INSERT INTO player_notifications
 *
 * @returns ID del nuevo partido
 */
function crearPartidoNotificado(proposal: MatchProposal, ahoraMock: string): string {
  const nuevoId = `m${MATCHES.length + 1}`;
  const { minutosParaConfirmar } = SETTINGS.tiempos;

  const notificaciones: PlayerNotification[] = proposal.jugadores.map((p) =>
    crearNotificacionPendiente(p.id, minutosParaConfirmar, ahoraMock)
  );

  const nuevoPartido: Match = {
    id: nuevoId,
    jugadores: proposal.jugadores.map((p) => p.id),
    confirmados: [],
    horario: proposal.horario,
    canchaId: proposal.canchaId,
    estado: "notified",
    categoria: proposal.categoria,
    nivelPromedio: proposal.nivelPromedio,
    creadoEn: ahoraMock,
    notificaciones,
  };

  // MOCK: En producción → await db.matches.create(nuevoPartido)
  MATCHES.push(nuevoPartido);

  console.log(`[TRIGGER DIARIO] Partido ${nuevoId} creado → ${proposal.jugadores.map((p) => p.nombre).join(", ")} | ${proposal.horario} | ${proposal.canchaId}`);

  return nuevoId;
}

// ============================================================
// PASO 6b: Enviar primer mensaje a cada jugador del grupo
// ============================================================

/**
 * Simula el envío del primer mensaje de WhatsApp a los 4 jugadores de un partido.
 *
 * Mensaje para cada jugador incluye:
 * - Fecha y horario del partido
 * - Nombre de la cancha
 * - Nombres de los otros 3 jugadores (sus rivales/compañeros)
 * - Estado inicial: "pendiente de confirmación"
 * - Instrucciones para responder SI o NO
 *
 * LÓGICA REAL FUTURA:
 * - Obtener adapterProvider desde el contexto de app.ts
 * - Llamar adapterProvider.sendMessage(jugador.telefono, mensaje, {})
 * - Registrar enviadoEn en la BD
 *
 * @param proposal - La propuesta del partido
 * @param matchId - ID del partido ya creado
 * @param ahoraMock - Timestamp del envío (para logging)
 */
export function simularEnviarPrimerMensajeGrupo(
  proposal: MatchProposal,
  matchId: string,
  ahoraMock: string
): void {
  const { minutosParaConfirmar } = SETTINGS.tiempos;

  for (const jugador of proposal.jugadores) {
    const otros = proposal.jugadores
      .filter((p) => p.id !== jugador.id)
      .map((p) => p.nombre);

    const mensaje = construirMensajeInicial(
      proposal.horario,
      proposal.canchaId,
      otros,
      minutosParaConfirmar
    );

    console.log(`[MOCK WhatsApp → ${jugador.telefono}] ${jugador.nombre}`);
    console.log(`  Mensaje: "${mensaje}"`);
    console.log(`  Partido: ${matchId} | Tiempo para confirmar: ${minutosParaConfirmar} min`);
    console.log();

    // En producción:
    // await adapterProvider.sendMessage(jugador.telefono, mensaje, {})
  }
}

/**
 * Construye el texto del primer mensaje para un jugador.
 * Usa la plantilla de SETTINGS.mensajes con sustitución de variables.
 *
 * Plantilla base: "¡Tu partido está listo! 🎉\n*Horario:* {{horario}}\n*Cancha:* {{cancha}}\n*Rivales:* {{rivales}}\n\nConfirmá con *SI* o cancelá con *NO*."
 */
function construirMensajeInicial(
  horario: string,
  canchaId: string,
  otros: string[],
  minutosParaConfirmar: number
): string {
  return SETTINGS.mensajes.partidoListo
    .replace("{{horario}}", formatearFechaLegible(horario))
    .replace("{{cancha}}", canchaId)
    .replace("{{rivales}}", otros.join(", ")) +
    `\n\n_Tenés *${minutosParaConfirmar} minutos* para responder._`;
}

// ============================================================
// HELPERS DE FECHA — sin dependencias externas
// ============================================================

/** Calcula la fecha de mañana a partir de una fecha ISO */
function calcularManana(isoString: string): string {
  try {
    const fecha = new Date(isoString);
    fecha.setDate(fecha.getDate() + 1);
    return fecha.toISOString().split("T")[0]; // "YYYY-MM-DD"
  } catch {
    return isoString.split("T")[0];
  }
}

/** Convierte "YYYY-MM-DD" al nombre del día de la semana en español */
function calcularDiaSemana(fechaISO: string): DayOfWeek {
  try {
    const fecha = new Date(fechaISO + "T12:00:00"); // mediodía para evitar offset DST
    const dias: DayOfWeek[] = [
      "domingo",
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
    ];
    return dias[fecha.getDay()];
  } catch {
    return "lunes"; // Fallback para mock
  }
}

/** Formatea una fecha ISO a string legible en español */
function formatearFechaLegible(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("es-AR", {
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
 * Para probar localmente, descomentá y ejecutá con:
 *   npx tsx src/triggers/dailyMatchTrigger.ts
 *
 * CASO 1: Ejecución normal — hay jugadores disponibles y canchas activas
 *   ejecutarTriggerDiario("2025-02-13", "2025-02-12T20:00:00")
 *   → Esperado: 2-3 grupos formados, partidos m10, m11... creados
 *   → Mensajes mock enviados a cada jugador
 *
 * CASO 2: Sin jugadores elegibles (todos en partidos activos)
 *   Poner todos los jugadores en MATCHES activos y ejecutar
 *   → Esperado: TriggerResult con jugadoresAgrupados: 0
 *
 * CASO 3: Sin canchas disponibles ese día
 *   fechaObjetivo = domingo, verificar que c2 y c4 no tienen domingo
 *   → Esperado: error "No hay canchas disponibles"
 *
 * CASO 4: Jugadores con niveles muy dispares (no se pueden agrupar)
 *   Solo dejar disponibles p1 (3.9) y p17 (8.3)
 *   → Esperado: ambos en jugadoresSinPartido
 *
 * CASO 5: Mezcla que requiere toleranciaExtendida
 *   Jugadores con niveles 4.8, 5.0, 5.5, 6.2 → diferencia max = 1.4
 *   Con toleranciaDefault (1.0): podría no agruparse
 *   Con toleranciaExtendida (1.5): sí se agrupa
 *   → Verificar que el algoritmo intenta la extensión
 *
 * CASO 6: Más grupos que slots disponibles
 *   Muchos jugadores elegibles pero pocas canchas/slots
 *   → Esperado: primeros grupos asignados, resto con error en TriggerResult
 *
 * CASO 7: Balanceo de parejas
 *   Grupo [p5(4.1), p7(5.4), p8(5.3), p3(4.8)]
 *   → Esperado después de balancear: [4.1, 5.3, 4.8, 5.4]
 *   → Pareja 1 (4.1 + 5.4 = 9.5) vs Pareja 2 (5.3 + 4.8 = 10.1) — equilibrado
 *
 * CASO 8: Cancelación de partidos expirados en la misma ejecución
 *   m8 lleva 48hs en waiting desde 2025-02-08
 *   ejecutarTriggerDiario("2025-02-14", "2025-02-12T20:00:00")
 *   → Esperado: m8 cancelado automáticamente antes de crear nuevos partidos
 */
