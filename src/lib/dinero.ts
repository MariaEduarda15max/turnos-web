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
