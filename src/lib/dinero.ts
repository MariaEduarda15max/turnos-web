// Formato de montos para mostrar. Supabase devuelve las columnas numeric
// como número (o string si son muy grandes): siempre pasar por Number().
export function formatearMonto(monto: number | string, moneda: string = "UYU"): string {
  const valor = Number(monto);
  const simbolo = moneda === "USD" ? "US$" : "$";
  return `${simbolo} ${valor.toLocaleString("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// Lee un monto de un formulario: acepta "1500", "1500,50" o "1.500,50".
// Devuelve null si está vacío y NaN si no es un número válido.
export function leerMonto(texto: FormDataEntryValue | null): number | null {
  const crudo = String(texto ?? "").trim();
  if (!crudo) return null;
  const normalizado = crudo.includes(",") ? crudo.replace(/\./g, "").replace(",", ".") : crudo;
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : NaN;
}

export type PagoResumen = {
  id: string;
  monto: number | string;
  metodo: "efectivo" | "transferencia" | "mercadopago" | "otro";
  nota: string | null;
  creado_en: string;
};

export const ETIQUETA_METODO: Record<PagoResumen["metodo"], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
  otro: "Otro",
};

// Suma de lo pagado y lo que falta (si hay precio de referencia).
export function resumirPagos(pagos: PagoResumen[], total: number | string | null) {
  const pagado = pagos.reduce((suma, p) => suma + Number(p.monto), 0);
  const totalNum = total === null || total === undefined ? null : Number(total);
  const falta = totalNum === null ? null : Math.max(0, Math.round((totalNum - pagado) * 100) / 100);
  return { pagado, total: totalNum, falta };
}

// ── Cobro online (etapa 2) ──────────────────────────────────────────────
export type ConfigCobro = {
  cobro_modo: "no_cobrar" | "sena" | "total";
  sena_tipo: "porcentaje" | "monto" | null;
  sena_valor: number | string | null;
};

const redondear = (n: number) => Math.round(n * 100) / 100;

// Cuánto cobrar online al reservar. null = no se cobra (y el turno se
// confirma directo). Total y seña en % necesitan que el servicio tenga
// precio; la seña de monto fijo no (si hay precio, no lo supera).
export function montoACobrar(config: ConfigCobro, precio: number | string | null): number | null {
  if (config.cobro_modo === "no_cobrar") return null;
  const p = precio === null || precio === undefined ? null : Number(precio);
  if (config.cobro_modo === "total") return p && p > 0 ? redondear(p) : null;

  const valor = Number(config.sena_valor);
  if (!valor || valor <= 0) return null;
  if (config.sena_tipo === "porcentaje") return p && p > 0 ? redondear((p * valor) / 100) : null;
  return redondear(p && p > 0 ? Math.min(valor, p) : valor);
}
