// Mismo enfoque que en turnos-bot (ver su guía de estudio, sección 6):
// sin offset explícito, el servidor interpreta cualquier hora "de pared"
// según su propia zona horaria (UTC), no la de Montevideo — por eso
// fechaMontevideo() agrega siempre el offset -03:00 a mano. Uruguay no
// tiene horario de verano desde 2015, así que el offset es siempre fijo.
export const ZONA_HORARIA = "America/Montevideo";

export function fechaMontevideo(dia: string, horaHHMM: string): Date {
  // Acepta "09:00" o "09:00:00" (Postgres devuelve columnas `time` con
  // segundos) — se recorta a HH:MM antes de armar la fecha.
  const hora = horaHHMM.slice(0, 5);
  return new Date(`${dia}T${hora}:00-03:00`);
}

export function formatearFecha(iso: string): string {
  const fecha = fechaMontevideo(iso, "00:00");
  return fecha.toLocaleDateString("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA_HORARIA,
  });
}