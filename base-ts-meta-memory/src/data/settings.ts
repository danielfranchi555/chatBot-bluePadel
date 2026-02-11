// ============================================================
// data/settings.ts
// Configuraciones generales mockeadas para BluePadel
// Sin conexión a base de datos real — solo para testing local
// ============================================================

// --------------------------------------------------------
// Configuración de matching de nivel
// --------------------------------------------------------
export const NIVEL_CONFIG = {
  /** Diferencia máxima de nivel numérico permitida entre jugadores */
  toleranciaDefault: 1.0,

  /** Tolerancia extendida si no se encuentran jugadores en la default */
  toleranciaExtendida: 1.5,

  /**
   * Máxima diferencia de categoría entera permitida entre compañeros/rivales
   * Ej: un jugador cat 5 puede jugar con cat 4 o cat 6, pero no con cat 3 o cat 7
   */
  maxDiferenciaCategoriaEntera: 1,

  /**
   * Si es true, se permite mezcla entre distintas categorías enteras
   * siempre que el nivelNumerico esté dentro de la tolerancia
   */
  permitirMezclaCategorias: true,
};

// --------------------------------------------------------
// Configuración de tiempos de confirmación
// --------------------------------------------------------
export const TIEMPOS_CONFIG = {
  /**
   * Horas de anticipación mínima para que el partido se forme
   * (si no hay 4 jugadores antes de este plazo, se cancela)
   */
  horasAnticipacionMinima: 2,

  /**
   * Minutos que tiene un jugador para confirmar asistencia
   * una vez notificado del partido
   */
  minutosParaConfirmar: 60,

  /**
   * Horas antes del partido en las que se considera "cancelación de último momento"
   * (puede aplicar penalización futura)
   */
  horasUltimoMomento: 2,

  /**
   * Horas máximas que un partido puede estar en estado "waiting"
   * antes de cancelarse automáticamente
   */
  horasMaximaEsperaPartido: 48,

  /**
   * Minutos antes del partido para enviar el recordatorio final
   */
  minutosRecordatorioPrevio: 30,
};

// --------------------------------------------------------
// Horarios de operación del club
// --------------------------------------------------------
export const HORARIOS_CLUB = {
  apertura: "07:00",
  cierre: "23:00",

  /**
   * Slots de turno disponibles (duración: 90 minutos por convención de pádel)
   * Representados como hora de inicio de cada turno
   */
  slots: [
    "07:00",
    "08:30",
    "10:00",
    "11:30",
    "13:00",
    "15:00",
    "16:30",
    "18:00",
    "19:30",
    "21:00",
  ],

  duracionTurnoMinutos: 90,
};

// --------------------------------------------------------
// Reglas de matching automático
// --------------------------------------------------------
export const MATCHING_RULES = {
  /**
   * Cantidad mínima de jugadores para crear un partido
   * (al anotarse 1 jugador se crea el partido en "waiting")
   */
  jugadoresMinimosParaCrear: 1,

  /** Cantidad exacta de jugadores para cerrar el partido */
  jugadoresParaCerrar: 4,

  /**
   * Si es true, el sistema intenta balancear parejas por nivel
   * (los 2 mejores vs los 2 peores del grupo)
   */
  balancearParejas: true,

  /**
   * Prioridad de asignación al armar un partido:
   * "nivel" = primero busca jugadores del mismo nivel
   * "disponibilidad" = primero busca jugadores disponibles sin importar nivel
   */
  prioridadAsignacion: "nivel" as "nivel" | "disponibilidad",

  /**
   * Cantidad de intentos de búsqueda de reemplazo antes de cancelar el partido
   */
  maxIntentosReemplazo: 3,

  /**
   * Si es true, al cancelarse un partido se notifica a todos los jugadores
   */
  notificarCancelacion: true,
};

// --------------------------------------------------------
// Mensajes del sistema (plantillas de WhatsApp simuladas)
// --------------------------------------------------------
export const MENSAJES = {
  bienvenida:
    "¡Hola! Soy el bot de BluePadel 🎾. Puedo anotarte a un partido, consultar tu próximo turno o ayudarte con cancelaciones. ¿Qué querés hacer?",

  partidoListo:
    "¡Tu partido está listo! 🎉\n*Horario:* {{horario}}\n*Cancha:* {{cancha}}\n*Rivales:* {{rivales}}\n\nConfirmá con *SI* o cancelá con *NO*.",

  esperandoJugadores:
    "Ya te anotamos para el {{horario}}. Estamos buscando rivales de tu nivel. Te avisamos cuando esté completo 🔍",

  recordatorio:
    "Recordatorio: Tu partido es en 30 minutos ⏰\n*Cancha:* {{cancha}}\n¡Mucha suerte!",

  cancelacionConfirmada:
    "Entendido, cancelamos tu participación en el partido del {{horario}}. Si cambiás de opinión, escribí 'quiero jugar'.",

  reemplazoEncontrado:
    "¡Encontramos un reemplazo para tu partido! {{nombre}} se sumará al equipo 👍",

  sinReemplazo:
    "No encontramos reemplazo disponible. El partido del {{horario}} fue cancelado. Lo sentimos 😔",
};

// --------------------------------------------------------
// Exportación agrupada para fácil importación
// --------------------------------------------------------
export const SETTINGS = {
  nivel: NIVEL_CONFIG,
  tiempos: TIEMPOS_CONFIG,
  horarios: HORARIOS_CLUB,
  matching: MATCHING_RULES,
  mensajes: MENSAJES,
};
