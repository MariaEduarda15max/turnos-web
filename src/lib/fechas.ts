// Mismo enfoque que en turnos-bot (ver su guía de estudio, sección 6):
// sin offset explícito, el servidor interpreta cualquier hora "de pared"
// según su propia zona horaria (UTC), no la de Montevideo — por eso
// fechaMontevideo() agrega siempre el offset -03:00 a mano. Uruguay no
// tiene horario de verano desde 2015, así que el offset es siempre fijo.
export const ZONA_HORARIA = "America/Montevideo";

// "HH:MM" o "HH:MM:SS" en 24 h. Las Server Actions lo usan para devolver
// un error prolijo antes de llamar a fechaMontevideo().
export function esHoraValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora);
}

export function fechaMontevideo(dia: string, horaHHMM: string): Date {
  // Acepta "09:00" o "09:00:00" (Postgres devuelve columnas `time` con
  // segundos) — se recorta a HH:MM antes de armar la fecha.
  const hora = horaHHMM.slice(0, 5);
  // Rechaza cualquier cosa que no sea "HH:MM" en 24 h (p. ej. "03:30 p. m.")
  // en vez de convertirla silenciosamente en una hora equivocada.
  if (!esHoraValida(horaHHMM)) {
    throw new Error(`Hora inválida: ${horaHHMM}`);
  }
  return new Date(`${dia}T${hora}:00-03:00`);
}

export function formatearFecha(iso: string): string {
  const fecha = fechaMontevideo(iso, "00:00");
  const texto = fecha.toLocaleDateString("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA_HORARIA,
  });
  // Solo la primera letra en mayúscula. La clase CSS `capitalize` ponía
  // mayúscula en CADA palabra ("Martes, 20 De Octubre").
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "HH:MM" en 24 h, hora de Montevideo, sin depender del locale (con
// toLocaleTimeString("es-UY") el formato cambia según la versión de ICU y
// puede salir "03:30 p. m." — ver el bug de las 12 h).
export function horaMontevideo(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ZONA_HORARIA,
  }).formatToParts(fecha);
  const hh = partes.find((p) => p.type === "hour")?.value ?? "00";
  const mm = partes.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

// "YYYY-MM-DD" del día en Montevideo ("sv-SE" formatea así).
export function diaMontevideo(fecha: Date): string {
  return fecha.toLocaleDateString("sv-SE", { timeZone: ZONA_HORARIA });
}

