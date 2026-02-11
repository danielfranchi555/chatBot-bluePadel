# BluePadel Bot — Documentación de Mocks

Chatbot de WhatsApp para gestión automática de partidos de pádel, construido con [BuilderBot](https://builderbot.app) y la API oficial de WhatsApp (Meta Cloud API).

Este proyecto usa **datos mockeados** para desarrollo y testing local. No requiere base de datos real ni APIs externas.

---

## Estructura del proyecto

```
base-ts-meta-memory/
└── src/
    ├── app.ts                    # Entry point del bot (BuilderBot)
    ├── data/
    │   ├── players.ts            # Mock de jugadores (18 jugadores)
    │   ├── matches.ts            # Mock de partidos (8 partidos en distintos estados)
    │   ├── courts.ts             # Mock de canchas (5 canchas)
    │   └── settings.ts           # Configuraciones generales
    └── flows/
        ├── createMatchFlow.ts    # Creación automática de partidos
        ├── confirmationFlow.ts   # Confirmación de jugadores
        ├── cancellationFlow.ts   # Cancelaciones (normales y último momento)
        ├── questionFlow.ts       # Consultas (rival, horario, cancha)
        └── replacementFlow.ts   # Búsqueda de reemplazos automáticos
```

---

## Cómo usar los mocks

### Importar datos

```typescript
import { PLAYERS, getPlayerByPhone } from "./data/players";
import { MATCHES, getOpenMatches } from "./data/matches";
import { COURTS, getCourtById } from "./data/courts";
import { SETTINGS } from "./data/settings";
```

### Importar y llamar un flow

```typescript
import { simularAnotarseAPartido } from "./flows/createMatchFlow";

const resultado = simularAnotarseAPartido("5491177889900", "2025-02-15T10:00:00");
console.log(resultado);
// { success: true, matchId: "m1", estado: "unido", mensaje: "..." }
```

---

## Cómo simular pruebas locales

### Prerrequisito

```bash
cd base-ts-meta-memory
npm install
```

### Ejecutar un flow de prueba directamente

Todos los flows tienen una sección `CASOS DE PRUEBA` al final del archivo con ejemplos listos para correr. Descomentá el caso que querés probar y ejecutá:

```bash
npx tsx src/flows/createMatchFlow.ts
npx tsx src/flows/confirmationFlow.ts
npx tsx src/flows/cancellationFlow.ts
npx tsx src/flows/questionFlow.ts
npx tsx src/flows/replacementFlow.ts
```

### Ejemplo completo: simular un partido de inicio a fin

```typescript
// 1. Jugador 1 se anota (crea partido)
import { simularAnotarseAPartido } from "./flows/createMatchFlow";
const r1 = simularAnotarseAPartido("5491177889900", null);
// → estado: "creado"

// 2. Jugadores 2, 3 y 4 se unen
const r2 = simularAnotarseAPartido("5491188990011", null);
const r3 = simularAnotarseAPartido("5491199001122", null);
const r4 = simularAnotarseAPartido("5491100112233", null);
// → estado: "unido" x2, luego "completo"

// 3. Todos confirman
import { simularConfirmarAsistencia } from "./flows/confirmationFlow";
simularConfirmarAsistencia("5491177889900", r1.matchId!, "SI");
simularConfirmarAsistencia("5491188990011", r1.matchId!, "SI");
simularConfirmarAsistencia("5491199001122", r1.matchId!, "SI");
simularConfirmarAsistencia("5491100112233", r1.matchId!, "SI");
// → El último devuelve partidoCompleto: true

// 4. Un jugador consulta el partido
import { simularResponderConsulta } from "./flows/questionFlow";
simularResponderConsulta("5491177889900", "contra_quien", r1.matchId!);

// 5. Un jugador cancela de último momento
import { simularCancelarJugador } from "./flows/cancellationFlow";
simularCancelarJugador("5491177889900", r1.matchId!);

// 6. El sistema busca reemplazo
import { simularBuscarReemplazo } from "./flows/replacementFlow";
simularBuscarReemplazo(r1.matchId!, "p6", 1);
```

---

## Datos mockeados disponibles

### Jugadores (`data/players.ts`)

| ID  | Nombre            | Categoría | Subnivel    | Nivel | Disponible |
|-----|-------------------|-----------|-------------|-------|------------|
| p1  | Martín Rodríguez  | 3         | avanzado    | 3.9   | ✅          |
| p2  | Lucía Fernández   | 3         | intermedio  | 3.5   | ✅          |
| p3  | Santiago Gómez    | 4         | avanzado    | 4.8   | ✅          |
| p4  | Valeria Torres    | 4         | intermedio  | 4.5   | ❌          |
| p5  | Diego Herrera     | 4         | base        | 4.1   | ✅          |
| p6  | Carolina Méndez   | 5         | avanzado    | 5.9   | ✅          |
| p7  | Facundo López     | 5         | intermedio  | 5.4   | ✅          |
| p8  | Romina Castro     | 5         | intermedio  | 5.3   | ✅          |
| p9  | Ezequiel Mora     | 5         | base        | 5.0   | ❌          |
| p10 | Florencia Ruiz    | 6         | avanzado    | 6.7   | ✅          |
| p11 | Tomás Álvarez     | 6         | avanzado    | 6.6   | ✅          |
| p12 | Natalia Pereyra   | 6         | intermedio  | 6.3   | ✅          |
| p13 | Ignacio Suárez    | 6         | base        | 6.0   | ✅          |
| p14 | Agustina Reyes    | 7         | avanzado    | 7.8   | ✅          |
| p15 | Nicolás Vargas    | 7         | intermedio  | 7.4   | ❌          |
| p16 | Jimena Ortiz      | 7         | base        | 7.1   | ✅          |
| p17 | Rodrigo Blanco    | 8         | intermedio  | 8.3   | ✅          |
| p18 | Camila Sosa       | 8         | base        | 8.0   | ✅          |

### Partidos (`data/matches.ts`)

| ID | Estado     | Jugadores       | Horario          | Cancha |
|----|------------|-----------------|------------------|--------|
| m1 | confirmed  | p6,p7,p8,p10    | 2025-02-12 10:00 | c1     |
| m2 | waiting    | p3,p5           | 2025-02-12 12:00 | c2     |
| m3 | waiting    | p10,p11,p12     | 2025-02-12 14:00 | c3     |
| m4 | canceled   | p1,p2,p3,p4     | 2025-02-11 09:00 | c1     |
| m5 | canceled   | p6,p8,p13,p14   | 2025-02-11 18:00 | c4     |
| m6 | completed  | p17,p18,p15,p16 | 2025-02-10 08:00 | c5     |
| m7 | waiting    | p3,p6           | 2025-02-13 16:00 | c2     |
| m8 | waiting    | p13             | 2025-02-14 10:00 | c3     |

### Configuraciones clave (`data/settings.ts`)

| Parámetro                  | Valor  |
|---------------------------|--------|
| Tolerancia de nivel       | ±1.0   |
| Tolerancia extendida      | ±1.5   |
| Tiempo para confirmar     | 60 min |
| Cancelación último momento| < 2hs  |
| Max espera partido        | 48hs   |
| Max intentos de reemplazo | 3      |

---

## Migrar a base de datos real

Cada función de los flows está marcada con comentarios `// MOCK:` o `// En producción:` que indican exactamente qué línea reemplazar.

### Pasos generales

**1. Elegir una base de datos**

Opciones recomendadas para este stack:
- **PostgreSQL** con [Prisma ORM](https://prisma.io) (tipado fuerte, ideal para TypeScript)
- **MongoDB** con Mongoose (más flexible para documentos variables)
- **Supabase** (PostgreSQL gestionado con API REST automática)
- **Firebase Firestore** (tiempo real, sin servidor)

**2. Reemplazar `PLAYERS`, `MATCHES`, `COURTS` por consultas reales**

```typescript
// ANTES (mock)
import { PLAYERS } from "../data/players";
const jugador = PLAYERS.find(p => p.telefono === telefono);

// DESPUÉS (Prisma ejemplo)
import { prisma } from "../lib/prisma";
const jugador = await prisma.player.findUnique({ where: { telefono } });
```

**3. Reemplazar helpers de lectura**

```typescript
// ANTES (mock)
import { getPlayerByPhone } from "../data/players";

// DESPUÉS
import { playerRepository } from "../repositories/playerRepository";
const jugador = await playerRepository.findByPhone(telefono);
```

**4. Reemplazar comentarios `// MOCK: UPDATE/INSERT`**

Buscar todos los comentarios con `// MOCK:` en los flows y reemplazarlos con las operaciones reales a la BD.

**5. Convertir funciones síncronas a `async/await`**

Todos los flows actuales son síncronos. Al integrar una BD, las funciones deben ser `async`:

```typescript
// ANTES
export function simularAnotarseAPartido(...): CreateMatchResult { ... }

// DESPUÉS
export async function anotarseAPartido(...): Promise<CreateMatchResult> { ... }
```

**6. Integrar con el provider de WhatsApp**

Los flows mockeados están desacoplados del bot. Para integrarlos con BuilderBot:

```typescript
// En app.ts
import { simularAnotarseAPartido } from "./flows/createMatchFlow";

const joinMatchFlow = addKeyword(["quiero jugar", "anotarme"])
  .addAnswer("¿Tenés algún horario preferido?", { capture: true }, async (ctx, { flowDynamic }) => {
    const resultado = simularAnotarseAPartido(ctx.from, ctx.body);
    await flowDynamic(resultado.mensaje);
  });
```

---

## Comandos útiles

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo (con hot reload)
npm run dev

# Ejecutar un flow de prueba directamente
npx tsx src/flows/createMatchFlow.ts

# Compilar para producción
npm run build

# Lint
npm run lint
```

---

## Notas importantes

- Los **números de teléfono** en los mocks usan formato `549XXXXXXXXXX` (Argentina, sin el `+`).
- La **"fecha actual" mockeada** en `cancellationFlow.ts` es `2025-02-11T16:30:00` — cambiala para probar distintos escenarios de último momento.
- El archivo `app.ts` **no fue modificado** y sigue funcionando de forma independiente al sistema de mocks.
- Para conectar los flows al bot de BuilderBot, leer la sección "Integrar con el provider de WhatsApp" de esta guía.
