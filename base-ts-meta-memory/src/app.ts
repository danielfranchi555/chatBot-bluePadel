import { join } from "path";
import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  utils,
} from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import cron from "node-cron";
import { ejecutarTriggerDiario } from "./triggers/dailyMatchTrigger";
import {
  ejecutarCheckConfirmaciones,
  procesarRespuestaJugador,
} from "./triggers/confirmationTimeoutTrigger";

const PORT = process.env.PORT ?? 3008;

const welcomeFlow = addKeyword<Provider, Database>([
  "hi",
  "hello",
  "hola",
]).addAnswer(
  "Bienvenido al chatbot de BluePadel. ¿Querés jugar un partido hoy?",
  {
    buttons: [
      { body: "Acepto el turno" },
      { body: "No puedo en ese horario" },
      { body: "No puedo hoy" },
    ],
    capture: true,
  },
  async (ctx, { flowDynamic }) => {
    const response = ctx.body;

    if (response === "Acepto el turno") {
      await flowDynamic(
        "¡Genial! Tu turno está confirmado. Te esperamos en la cancha! 🎾",
      );
    } else if (response === "No puedo en ese horario") {
      await flowDynamic(
        "No hay problema. ¿Qué horario te vendría mejor? Escribí tu preferencia.",
      );
    } else if (response === "No puedo hoy") {
      await flowDynamic(
        "Entendido. ¡Nos vemos en otra oportunidad! Escribí 'hola' cuando quieras coordinar otro día.",
      );
    }
  },
);

// ============================================================
// Flow de confirmación: responde a "SI" / "NO" del jugador
// cuando el bot le envió la propuesta de partido.
// Conecta la respuesta de WhatsApp con el estado asincrónico del partido.
// ============================================================
const confirmacionPartidoFlow = addKeyword<Provider, Database>(["SI", "NO", "si", "no"])
  .addAction(async (ctx, { flowDynamic }) => {
    const respuesta = ctx.body.toUpperCase().trim() as "SI" | "NO";
    if (respuesta !== "SI" && respuesta !== "NO") return;

    // MOCK: procesarRespuestaJugador es síncrono en el mock
    // En producción: esta función sería async y llamaría a la BD
    const resultado = procesarRespuestaJugador(ctx.from, respuesta);
    await flowDynamic(resultado.mensaje);
  });

const main = async () => {
  const adapterFlow = createFlow([welcomeFlow, confirmacionPartidoFlow]);
  const adapterProvider = createProvider(Provider, {
    jwtToken:
      "EAAoGL1t0dtwBQvUQnLW2puVVhgbHb9W8YZCqyJHtBiBjO9KTKCZCt2Uq56HKIgZB95jkIfM26ZAYMaovxLzSzRROZC3C7rZCzWr2KXjHRfEp0BWZBoAXy6nwbTBteY1DRm3vozgJstOyVueG9wZClFItSiuuZCePObZCwjkZBD8hopZAxnMQbBTn0EO7knZASMxDi3ro1eD5eRLCJU1vEoPRwZCIc1jSISroZBCtqVANAm7vWAR3e1xIL9vvZBTNSsq5mdVHuhlboTxZCIa9XCiZAetmoWc04v64KaZAgZDZD",
    numberId: "1015643358289570",
    verifyToken: "perro",
    version: "v22.0",
  });
  const adapterDB = new Database();

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  // ============================================================
  // CRON 1: Trigger diario — crea partidos para el día siguiente
  // Se ejecuta todos los días a las 20:00 (hora Argentina)
  //
  // En cada ejecución:
  // 1. Cancela partidos expirados (waiting > 48hs)
  // 2. Agrupa jugadores disponibles por nivel (tolerancia ±1.0 / ±1.5)
  // 3. Asigna cancha y horario a cada grupo
  // 4. Crea los Match en estado "notified"
  // 5. Envía el primer mensaje WhatsApp a los 4 jugadores
  //
  // Para testear manualmente: ejecutarTriggerDiario("2025-02-13")
  // ============================================================
  cron.schedule(
    "0 20 * * *",
    () => {
      try {
        const result = ejecutarTriggerDiario();
        console.log(
          `[CRON DIARIO] Partidos creados: ${result.partidosCreados} | Jugadores agrupados: ${result.jugadoresAgrupados}`,
        );
      } catch (error) {
        console.error("[CRON DIARIO] Error en trigger diario:", error);
      }
    },
    { timezone: "America/Argentina/Buenos_Aires" },
  );

  // ============================================================
  // CRON 2: Chequeador de confirmaciones — cada 5 minutos
  // Detecta y procesa jugadores que no confirmaron en tiempo.
  //
  // En cada ejecución:
  // 1. Revisa partidos en estado "notified"
  // 2. Por cada PlayerNotification vencida (tiempoLimite < ahora):
  //    → Registra TIMEOUT
  //    → Inicia búsqueda de reemplazo
  // 3. Si todos confirmaron → marca partido como "confirmed"
  // 4. Si no hay reemplazos posibles → cancela el partido
  //
  // Para testear manualmente: ejecutarCheckConfirmaciones()
  // ============================================================
  cron.schedule(
    "*/5 * * * *",
    () => {
      try {
        const result = ejecutarCheckConfirmaciones();
        if (result.partidosRevisados > 0) {
          console.log(
            `[CRON CHECK] Revisados: ${result.partidosRevisados} | Confirmados: ${result.partidosConfirmados} | Cancelados: ${result.partidosCancelados} | Timeouts: ${result.timeoutsDetectados}`,
          );
        }
      } catch (error) {
        console.error("[CRON CHECK] Error en chequeador de confirmaciones:", error);
      }
    },
    { timezone: "America/Argentina/Buenos_Aires" },
  );

  adapterProvider.server.post(
    "/v1/messages",
    handleCtx(async (bot, req, res) => {
      const { number, message, urlMedia } = req.body;
      await bot.sendMessage(number, message, { media: urlMedia ?? null });
      return res.end("sended");
    }),
  );

  adapterProvider.server.post(
    "/v1/register",
    handleCtx(async (bot, req, res) => {
      const { number, name } = req.body;
      await bot.dispatch("REGISTER_FLOW", { from: number, name });
      return res.end("trigger");
    }),
  );

  adapterProvider.server.post(
    "/v1/samples",
    handleCtx(async (bot, req, res) => {
      const { number, name } = req.body;
      await bot.dispatch("SAMPLES", { from: number, name });
      return res.end("trigger");
    }),
  );

  adapterProvider.server.post(
    "/v1/blacklist",
    handleCtx(async (bot, req, res) => {
      const { number, intent } = req.body;
      if (intent === "remove") bot.blacklist.remove(number);
      if (intent === "add") bot.blacklist.add(number);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", number, intent }));
    }),
  );

  adapterProvider.server.get(
    "/v1/blacklist/list",
    handleCtx(async (bot, req, res) => {
      const blacklist = bot.blacklist.getList();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", blacklist }));
    }),
  );

  httpServer(+PORT);
};

main();
