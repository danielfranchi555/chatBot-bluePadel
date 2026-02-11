# Creación de un partido — Paso a paso

Flujo completo desde el trigger diario hasta el envío del primer mensaje de WhatsApp.

---

## Punto de entrada — `ejecutarTriggerDiario()` (`dailyMatchTrigger.ts`)

El cron lo dispara todos los días a las 20:00:

```
"0 20 * * *" → ejecutarTriggerDiario()
```

---

## Paso 1 — Limpieza previa: cancelar partidos expirados

```typescript
const expirados = getMatchesExpirados(48, ahora);
// → Busca en MATCHES donde estado="waiting" Y (ahora - creadoEn) >= 48hs

for (const partido of expirados) {
  simularCancelarPartidoAutomatico(partido.id, "partido_expirado");
}
```

Antes de crear partidos nuevos, cancela los que llevan demasiado tiempo sin cerrarse.
El partido `m8` de los mocks entraría aquí.

---

## Paso 2 — Identificar jugadores elegibles

Función: `obtenerJugadoresElegibles()`

Filtra `PLAYERS` con dos condiciones simultáneas:

| Condición | Qué hace |
|---|---|
| `p.disponible === true` | Jugador habilitado en su perfil |
| `!jugadoresOcupados.has(p.id)` | No está ya en un partido `waiting / notified / confirmed` |

```typescript
// Construye el set de ocupados primero:
const jugadoresOcupados = new Set(
  MATCHES
    .filter(m => m.estado === "waiting" || m.estado === "notified" || m.estado === "confirmed")
    .flatMap(m => m.jugadores)  // aplana todos los IDs
);

// Luego filtra:
return PLAYERS.filter(p => p.disponible && !jugadoresOcupados.has(p.id));
```

> Si quedan menos de 4 elegibles → el trigger termina sin crear nada.

---

## Paso 3 — Algoritmo de agrupamiento por nivel

Función: `agruparJugadoresPorNivel()`

### 3a. Ordenar por nivel numérico (ascendente)

```
Input:  [p18(8.0), p17(8.3), p16(7.1), p14(7.8), p13(6.0), ...]
Output: [p2(3.5), p1(3.9), p5(4.1), p3(4.8), p8(5.3), p7(5.4), p6(5.9), p10(6.7), ...]
```

### 3b. Ventana deslizante greedy

Por cada jugador "ancla" (el primero sin usar):

1. Busca candidatos donde `|nivel_candidato - nivel_ancla| <= 1.0` (**toleranciaDefault**)
2. Si hay menos de 3 candidatos → reintenta con tolerancia `1.5` (**toleranciaExtendida**)
3. Si con tolerancia extendida tampoco hay 3 → ese jugador va a `sinGrupo`
4. Si hay suficientes → toma los **3 más cercanos en nivel** y forma el grupo

```typescript
const tresmas = candidatos
  .sort((a, b) =>
    Math.abs(a.nivelNumerico - ancla.nivelNumerico) -
    Math.abs(b.nivelNumerico - ancla.nivelNumerico)
  )
  .slice(0, 3);  // los 3 con menor diferencia de nivel
```

### 3c. Balanceo de parejas

Si `MATCHING_RULES.balancearParejas = true`, el grupo se reordena para que
la suma de nivel de cada pareja sea lo más similar posible:

```
Antes:   [4.1, 4.8, 5.3, 5.4]
Después: [4.1, 5.3, 4.8, 5.4]

Pareja 1 (índices 0 + 3): 4.1 + 5.4 = 9.5
Pareja 2 (índices 1 + 2): 5.3 + 4.8 = 10.1  ✓ equilibrado
```

---

## Paso 4 — Obtener canchas disponibles para el día objetivo

```typescript
const diaSemana = calcularDiaSemana(fechaObjetivo);
// "2025-02-13" → new Date().getDay() → "jueves"

const canchasDisponibles = getAvailableCourtsByDay("jueves");
// → Filtra COURTS donde activa=true Y diasDisponibles.includes("jueves")
// → Devuelve c1, c2, c3... (no c5 porque activa=false)
```

> Si no hay canchas disponibles ese día → el trigger termina sin crear nada.

---

## Paso 5 — Generar pool de slots (cancha × horario)

Función: `generarPoolDeSlots()`

Combina cada slot de `HORARIOS_CLUB.slots` con cada cancha que tenga ese slot disponible.
La distribución es en **round-robin** por cancha:

```
slots: ["07:00", "08:30", "10:00", ...]
canchas activas ese día: [c1, c2, c3, c4]

Pool resultante:
  { canchaId: "c1", horario: "2025-02-13T07:00:00" }
  { canchaId: "c3", horario: "2025-02-13T07:00:00" }  // c2 y c4 no abren a las 7
  { canchaId: "c1", horario: "2025-02-13T08:30:00" }
  { canchaId: "c3", horario: "2025-02-13T08:30:00" }
  ...
```

Cada grupo recibe el siguiente slot del pool (`slotIndex++`).
Si los grupos superan los slots disponibles → error registrado en `TriggerResult.errores`.

---

## Paso 6 — Crear el partido en memoria

Función: `crearPartidoNotificado()`

### 6a. Crear las notificaciones individuales (una por jugador)

```typescript
const notificaciones = proposal.jugadores.map(p =>
  crearNotificacionPendiente(p.id, 60, ahora)
);

// Resultado para cada jugador:
// PlayerNotification {
//   playerId: "p7",
//   estado: "pending",
//   enviadoEn: "2025-02-12T20:00:00",
//   tiempoLimite: "2025-02-12T21:00:00",  // enviadoEn + 60 min
// }
```

### 6b. Construir y persistir el Match

```typescript
const nuevoPartido: Match = {
  id: "m10",
  jugadores: ["p7", "p8", "p6", "p10"],
  confirmados: [],           // vacío — nadie confirmó aún
  horario: "2025-02-13T10:00:00",
  canchaId: "c1",
  estado: "notified",        // ← diferente a "waiting" del flujo orgánico
  categoria: 6,
  nivelPromedio: 5.83,
  creadoEn: "2025-02-12T20:00:00",
  notificaciones,            // ← 4 entradas, todas en estado "pending"
};

MATCHES.push(nuevoPartido);
// En producción: INSERT INTO matches + INSERT INTO player_notifications
```

---

## Paso 7 — Enviar el primer mensaje WhatsApp × 4 jugadores

Función: `simularEnviarPrimerMensajeGrupo()`

Por cada uno de los 4 jugadores del grupo se construye un mensaje personalizado:

```typescript
for (const jugador of proposal.jugadores) {

  // Nombres de los otros 3 (los rivales/compañeros)
  const otros = ["Facundo López", "Romina Castro", "Florencia Ruiz"];

  const mensaje = construirMensajeInicial(horario, canchaId, otros, 60);
}
```

**Mensaje resultante (ejemplo para Carolina Méndez):**

```
¡Tu partido está listo! 🎉
*Horario:* jueves, 13 de febrero 10:00
*Cancha:* Cancha 1 - Cristal
*Rivales:* Facundo López, Romina Castro, Florencia Ruiz

Confirmá con *SI* o cancelá con *NO*.

_Tenés *60 minutos* para responder._
```

En el mock el mensaje se imprime por consola. En producción:

```typescript
await adapterProvider.sendMessage(jugador.telefono, mensaje, {})
```

---

## Estado final después del trigger

```
MATCHES luego de ejecutarTriggerDiario("2025-02-13"):

  m10: {
    estado: "notified",
    jugadores: ["p7", "p8", "p6", "p10"],
    confirmados: [],
    notificaciones: [
      { playerId:"p7",  estado:"pending", tiempoLimite:"21:00" },
      { playerId:"p8",  estado:"pending", tiempoLimite:"21:00" },
      { playerId:"p6",  estado:"pending", tiempoLimite:"21:00" },
      { playerId:"p10", estado:"pending", tiempoLimite:"21:00" },
    ]
  }

Los 4 jugadores recibieron el mensaje en WhatsApp.
Nadie respondió aún.
```

A las **20:05** el CRON 2 (`confirmationTimeoutTrigger`) corre por primera vez.
Como nadie llegó al `tiempoLimite` (21:00), no hace nada.
A las **21:05**, detecta los `pending` vencidos y dispara el flujo de timeouts y reemplazos.

---

## Diagrama compacto

```
20:00 CRON ──► ejecutarTriggerDiario()
                │
                ├─ 1 ─► cancelar partidos expirados (waiting > 48hs)
                │
                ├─ 2 ─► PLAYERS.filter(disponible + sin partido activo)
                │            └─► [p5, p7, p8, p6, p10, p11, p12, p13, p16, p17, p18]
                │
                ├─ 3 ─► sort por nivel → ventana greedy → grupos de 4
                │            └─► [[p5,p7,p8,p6], [p10,p11,p12,p13], ...]
                │
                ├─ 4 ─► getAvailableCourtsByDay("jueves") → [c1, c2, c3]
                │
                ├─ 5 ─► pool de slots → asignar 1 slot por grupo
                │            └─► grupo0 → c1/10:00  |  grupo1 → c2/10:00
                │
                ├─ 6 ─► MATCHES.push({ estado:"notified", notificaciones:[x4 pending] })
                │
                └─ 7 ─► sendMessage × 4 jugadores
                             └─► [fecha, cancha, rivales, instrucciones SI/NO]
```

---

## Archivos involucrados

| Archivo | Rol |
|---|---|
| `src/triggers/dailyMatchTrigger.ts` | Orquesta todos los pasos |
| `src/data/players.ts` | Fuente de jugadores (`PLAYERS`, `getPlayersByLevel`) |
| `src/data/matches.ts` | Persistencia mock de partidos (`MATCHES`, `getMatchesExpirados`) |
| `src/data/courts.ts` | Canchas y slots disponibles (`getAvailableCourtsByDay`) |
| `src/data/settings.ts` | Configuración: tolerancias, tiempos, plantillas de mensajes |
| `src/data/playerMatchStatus.ts` | Tipos y helpers para el estado por jugador (`PlayerNotification`) |
| `src/flows/cancellationFlow.ts` | Cancela partidos expirados en el Paso 1 |
| `src/app.ts` | Registra el cron `"0 20 * * *"` que dispara todo |
