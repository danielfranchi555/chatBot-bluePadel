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

const PORT = process.env.PORT ?? 3008;

const discordFlow = addKeyword<Provider, Database>("doc").addAnswer(
  [
    "You can see the documentation here",
    "📄 https://builderbot.app/docs \n",
    "Do you want to continue? *yes*",
  ].join("\n"),
  { capture: true },
  async (ctx, { gotoFlow, flowDynamic }) => {
    if (ctx.body.toLocaleLowerCase().includes("yes")) {
      return gotoFlow(registerFlow);
    }
    await flowDynamic("Thanks!");
    return;
  },
);

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

const registerFlow = addKeyword<Provider, Database>(
  utils.setEvent("REGISTER_FLOW"),
)
  .addAnswer(
    `What is your name?`,
    { capture: true },
    async (ctx, { state }) => {
      await state.update({ name: ctx.body });
    },
  )
  .addAnswer("What is your age?", { capture: true }, async (ctx, { state }) => {
    await state.update({ age: ctx.body });
  })
  .addAction(async (_, { flowDynamic, state }) => {
    await flowDynamic(
      `${state.get("name")}, thanks for your information!: Your age: ${state.get("age")}`,
    );
  });

const fullSamplesFlow = addKeyword<Provider, Database>([
  "samples",
  utils.setEvent("SAMPLES"),
])
  .addAnswer(`💪 I'll send you a lot files...`)
  .addAnswer(`Send image from Local`, {
    media: join(process.cwd(), "assets", "sample.png"),
  })
  .addAnswer(`Send video from URL`, {
    media:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTJ0ZGdjd2syeXAwMjQ4aWdkcW04OWlqcXI3Ynh1ODkwZ25zZWZ1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LCohAb657pSdHv0Q5h/giphy.mp4",
  })
  .addAnswer(`Send audio from URL`, {
    media: "https://cdn.freesound.org/previews/728/728142_11861866-lq.mp3",
  })
  .addAnswer(`Send file from URL`, {
    media:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  });

const main = async () => {
  const adapterFlow = createFlow([welcomeFlow, registerFlow, fullSamplesFlow]);
  const adapterProvider = createProvider(Provider, {
    jwtToken:
      "EAAoGL1t0dtwBQkq5g3oomJaNvXb1IxgNldI2Pp5t5PzZCTrwQeYYX2zrCT25csT2Oa6cTK1nNPAv9f2VNALh1QeskH0RIgTuB8d6MbjVIomH9uIztE7bgOkbziHJ5CPp4ZBum5BcyiZCrrqvITSZBFTF5ZA4SwJflQ9thwPZCGtLwdWShWUFIJJSLhW4GdSEiWnwGaybMnpBQenLCmEh4tGYCcppmkftzBfnxkfpcoKD7RlFdagagABhaztxoPEsjpggCqfvAFKGJZA7gN5qupoOTTp",
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

  // Configurar mensaje automático cada 5 minutos
  // cron.schedule(
  //   "*/5 * * * *", // Ejecutar cada 5 minutos
  //   async () => {
  //     const targetNumber = "543512002606";
  //     const message = "hola queres jugar un partido hoy?";

  //     try {
  //       await adapterProvider.sendMessage(targetNumber, message, {});
  //       console.log(
  //         `[${new Date().toLocaleString()}] Mensaje automático enviado a ${targetNumber}`,
  //       );
  //     } catch (error) {
  //       console.error(
  //         `[${new Date().toLocaleString()}] Error enviando mensaje automático:`,
  //         error,
  //       );
  //     }
  //   },
  //   {
  //     timezone: "America/Argentina/Buenos_Aires", // Zona horaria de Argentina
  //   },
  // );

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
