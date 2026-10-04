"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function LoginClientePage({
  params,
}: {
  params: Promise<{ negocioId: string }>;
}) {
  const { negocioId } = use(params);
  const confirmacion = useSearchParams().get("confirmacion");

  const router = useRouter();
  const supabase = crearClienteNavegador();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setError(
        error.code === "email_not_confirmed"
          ? "Todavía no confirmaste tu email. Revisá tu bandeja de entrada."
          : "Email o contraseña incorrectos.",
      );
      setCargando(false);
      return;
    }

    // Idempotente: si ya sos cliente de este negocio no hace nada; si no,
    // adopta tus turnos de invitado o crea tu fila (p. ej. confirmaste el
    // email desde otro dispositivo, o tenés cuenta en otro negocio).
    const { error: errorVinculo } = await supabase.rpc("vincular_cliente", {
      negocio_id_param: negocioId,
    });
    if (errorVinculo) {
      setError("Ingresaste, pero hubo un error vinculando tu cuenta: " + errorVinculo.message);
      setCargando(false);
      return;
    }

    router.push(`/r/${negocioId}/mis-turnos`);
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-bosque-800 mb-8">Ingresar</h1>

        {confirmacion && (
          <p className="text-bosque-600 text-sm mb-6">
            {confirmacion === "error"
              ? "Tu email quedó confirmado, pero no pudimos terminar el alta. Ingresá para completarla."
              : "Si ya confirmaste tu email, ingresá con tu contraseña."}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
          />
          <input
            type="password"
            placeholder="Contraseña"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
          />

          {error && <p className="text-arcilla-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-md bg-bosque-800 text-white py-2 text-sm font-medium hover:bg-bosque-900 transition-colors disabled:opacity-60"
          >
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="text-sm text-bosque-500 mt-6">
          ¿Todavía no tenés cuenta?{" "}
          <Link href={`/r/${negocioId}/cuenta/registro`} className="text-arcilla-600 hover:underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </main>
  );
}