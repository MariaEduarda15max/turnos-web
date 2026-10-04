import type { SupabaseClient } from "@supabase/supabase-js";
import { fechaMontevideo, ZONA_HORARIA } from "./fechas";

const DIAS_A_MOSTRAR = 14; // mismo criterio que turnos-bot, SPEC.md 1.2

export async function diasConDisponibilidad(
  supabase: SupabaseClient,
  negocioId: string,
): Promise<string[]> {
  const { data: disponibilidad } = await supabase
    .from("disponibilidad")
    .select("dia_semana")
    .eq("negocio_id", negocioId);

  const diasConFranja = new Set((disponibilidad ?? []).map((d) => d.dia_semana));
  const dias: string[] = [];

  for (let i = 0; i < DIAS_A_MOSTRAR; i++) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + i);
    // "sv-SE" da formato YYYY-MM-DD; con timeZone Montevideo evita que
    // el servidor (en UTC) calcule "hoy" con la fecha equivocada.
    const iso = fecha.toLocaleDateString("sv-SE", { timeZone: ZONA_HORARIA });
    const diaSemana = new Date(`${iso}T12:00:00-03:00`).getDay();
    if (diasConFranja.has(diaSemana)) dias.push(iso);
  }

  return dias;
}

export async function calcularHorariosLibres(
  supabase: SupabaseClient,
  negocioId: string,
  servicioId: string,
  dia: string,
  excluirTurnoId?: string,
): Promise<string[]> {
  const [{ data: servicio }, { data: franjas }, { data: turnosDelDia }, { data: bloqueosDelDia }] =
    await Promise.all([
      supabase.from("servicios").select("duracion_min").eq("id", servicioId).single(),
      supabase
        .from("disponibilidad")
        .select("hora_desde, hora_hasta")
        .eq("negocio_id", negocioId)
        // se evalúa al mediodía para no caer del lado equivocado del
        // corte UTC↔Montevideo al pedir el día de la semana.
        .eq("dia_semana", new Date(`${dia}T12:00:00-03:00`).getDay()),
      (() => {
        let query = supabase
          .from("turnos")
          .select("id, inicio, duracion_min")
          .eq("negocio_id", negocioId)
          .eq("estado", "confirmado")
          .gte("inicio", fechaMontevideo(dia, "00:00").toISOString())
          .lt("inicio", fechaMontevideo(dia, "23:59").toISOString());
        // Al reprogramar, el turno propio no debe bloquearse a sí mismo.
        if (excluirTurnoId) query = query.neq("id", excluirTurnoId);
        return query;
      })(),
      supabase
        .from("bloqueos")
        .select("hora_desde, hora_hasta")
        .eq("negocio_id", negocioId)
        .eq("fecha", dia),
    ]);

  if (!servicio || !franjas) return [];
  const duracion = servicio.duracion_min;

  const ocupados = [
    ...(turnosDelDia ?? []).map((t) => ({
      desde: new Date(t.inicio),
      hasta: new Date(new Date(t.inicio).getTime() + t.duracion_min * 60_000),
    })),
    ...(bloqueosDelDia ?? []).map((b) => ({
      desde: fechaMontevideo(dia, b.hora_desde),
      hasta: fechaMontevideo(dia, b.hora_hasta),
    })),
  ];

  const libres: string[] = [];

  for (const franja of franjas) {
    let cursor = fechaMontevideo(dia, franja.hora_desde);
    const fin = fechaMontevideo(dia, franja.hora_hasta);

    while (cursor.getTime() + duracion * 60_000 <= fin.getTime()) {
      const cursorFin = new Date(cursor.getTime() + duracion * 60_000);
      const seSolapa = ocupados.some((o) => cursor < o.hasta && cursorFin > o.desde);

      if (!seSolapa && cursor.getTime() > Date.now()) {
        // SIEMPRE "HH:MM" en 24 h: este string viaja de vuelta al servidor
        // y se convierte en fecha. Con toLocaleTimeString("es-UY") el
        // formato depende de la versión de ICU/Node — en algunas sale
        // "03:30 p. m.", y al recortarlo quedaba "03:30" (¡de la mañana!).
        libres.push(horaHHMM(cursor));
      }
      cursor = cursorFin;
    }
  }

  return libres;
}

// "HH:MM" en 24 h, hora de Montevideo, sin depender del locale.
function horaHHMM(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Montevideo",
  }).formatToParts(fecha);
  const hh = partes.find((p) => p.type === "hour")?.value ?? "00";
  const mm = partes.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}
