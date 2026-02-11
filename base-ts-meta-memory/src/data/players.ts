// ============================================================
// data/players.ts
// Base de jugadores mockeada para el chatbot de BluePadel
// Sin conexión a base de datos real — solo para testing local
// ============================================================

export type Subnivel = "base" | "intermedio" | "avanzado";

export interface Player {
  id: string;
  nombre: string;
  categoria: number;       // Categoría de pádel: 3 a 8
  subnivel: Subnivel;      // Dentro de la categoría
  nivelNumerico: number;   // Nivel decimal para matching fino (ej: 4.2)
  telefono: string;        // Número de WhatsApp (con código de país)
  disponible: boolean;     // Si actualmente acepta ser convocado
}

export const PLAYERS: Player[] = [
  // --- Categoría 3 (Elite) ---
  {
    id: "p1",
    nombre: "Martín Rodríguez",
    categoria: 3,
    subnivel: "avanzado",
    nivelNumerico: 3.9,
    telefono: "5491122334455",
    disponible: true,
  },
  {
    id: "p2",
    nombre: "Lucía Fernández",
    categoria: 3,
    subnivel: "intermedio",
    nivelNumerico: 3.5,
    telefono: "5491133445566",
    disponible: true,
  },

  // --- Categoría 4 ---
  {
    id: "p3",
    nombre: "Santiago Gómez",
    categoria: 4,
    subnivel: "avanzado",
    nivelNumerico: 4.8,
    telefono: "5491144556677",
    disponible: true,
  },
  {
    id: "p4",
    nombre: "Valeria Torres",
    categoria: 4,
    subnivel: "intermedio",
    nivelNumerico: 4.5,
    telefono: "5491155667788",
    disponible: false,
  },
  {
    id: "p5",
    nombre: "Diego Herrera",
    categoria: 4,
    subnivel: "base",
    nivelNumerico: 4.1,
    telefono: "5491166778899",
    disponible: true,
  },

  // --- Categoría 5 ---
  {
    id: "p6",
    nombre: "Carolina Méndez",
    categoria: 5,
    subnivel: "avanzado",
    nivelNumerico: 5.9,
    telefono: "5491177889900",
    disponible: true,
  },
  {
    id: "p7",
    nombre: "Facundo López",
    categoria: 5,
    subnivel: "intermedio",
    nivelNumerico: 5.4,
    telefono: "5491188990011",
    disponible: true,
  },
  {
    id: "p8",
    nombre: "Romina Castro",
    categoria: 5,
    subnivel: "intermedio",
    nivelNumerico: 5.3,
    telefono: "5491199001122",
    disponible: true,
  },
  {
    id: "p9",
    nombre: "Ezequiel Mora",
    categoria: 5,
    subnivel: "base",
    nivelNumerico: 5.0,
    telefono: "5491100112233",
    disponible: false,
  },

  // --- Categoría 6 ---
  {
    id: "p10",
    nombre: "Florencia Ruiz",
    categoria: 6,
    subnivel: "avanzado",
    nivelNumerico: 6.7,
    telefono: "5491111223344",
    disponible: true,
  },
  {
    id: "p11",
    nombre: "Tomás Álvarez",
    categoria: 6,
    subnivel: "avanzado",
    nivelNumerico: 6.6,
    telefono: "5491122334455",
    disponible: true,
  },
  {
    id: "p12",
    nombre: "Natalia Pereyra",
    categoria: 6,
    subnivel: "intermedio",
    nivelNumerico: 6.3,
    telefono: "5491133445566",
    disponible: true,
  },
  {
    id: "p13",
    nombre: "Ignacio Suárez",
    categoria: 6,
    subnivel: "base",
    nivelNumerico: 6.0,
    telefono: "5491144556677",
    disponible: true,
  },

  // --- Categoría 7 ---
  {
    id: "p14",
    nombre: "Agustina Reyes",
    categoria: 7,
    subnivel: "avanzado",
    nivelNumerico: 7.8,
    telefono: "5491155667788",
    disponible: true,
  },
  {
    id: "p15",
    nombre: "Nicolás Vargas",
    categoria: 7,
    subnivel: "intermedio",
    nivelNumerico: 7.4,
    telefono: "5491166778899",
    disponible: false,
  },
  {
    id: "p16",
    nombre: "Jimena Ortiz",
    categoria: 7,
    subnivel: "base",
    nivelNumerico: 7.1,
    telefono: "5491177889900",
    disponible: true,
  },

  // --- Categoría 8 (Principiante) ---
  {
    id: "p17",
    nombre: "Rodrigo Blanco",
    categoria: 8,
    subnivel: "intermedio",
    nivelNumerico: 8.3,
    telefono: "5491188990011",
    disponible: true,
  },
  {
    id: "p18",
    nombre: "Camila Sosa",
    categoria: 8,
    subnivel: "base",
    nivelNumerico: 8.0,
    telefono: "5491199001122",
    disponible: true,
  },
];

// --------------------------------------------------------
// Helpers de búsqueda (sin lógica de negocio real)
// --------------------------------------------------------

/** Devuelve un jugador por id, o undefined si no existe */
export function getPlayerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}

/** Devuelve un jugador por teléfono */
export function getPlayerByPhone(telefono: string): Player | undefined {
  return PLAYERS.find((p) => p.telefono === telefono);
}

/** Devuelve jugadores disponibles dentro de un rango de nivel numérico */
export function getPlayersByLevel(
  nivelBase: number,
  tolerancia: number
): Player[] {
  return PLAYERS.filter(
    (p) =>
      p.disponible &&
      p.nivelNumerico >= nivelBase - tolerancia &&
      p.nivelNumerico <= nivelBase + tolerancia
  );
}
