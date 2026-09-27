"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function RegistroPage() {
  const router = useRouter();
  const supabase = crearClienteNavegador();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const { data, error: errorAuth } = await supabase.auth.signUp({ email, password });

    if (errorAuth || !data.user) {
      setError(errorAuth?.message ?? "No se pudo crear la cuenta.");
      setCargando(false);
      return;
    }

    // Crea la fila en `negocios` ligada a este usuario recién autenticado.
    // RLS exige auth_user_id = auth.uid() — esto solo funciona si Supabase
    // ya dejó al usuario logueado en este mismo paso (auto-confirmación de
    // email activada en el proyecto). Si el proyecto pide confirmar el
    // email antes de dar sesión, este insert falla acá — hay que revisar
    // Authentication → Settings → "Confirm email" en el dashboard.
    const { error: errorNegocio } = await supabase.from("negocios").insert({
      nombre,
      email_admin: email,
      auth_user_id: data.user.id,
    });

    if (errorNegocio) {
      setError(
        "La cuenta se creó, pero hubo un error registrando el negocio: " +
          errorNegocio.message,
      );
      setCargando(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl text-bosque-800 mb-1">Registrar negocio</h1>
        <p className="text-bosque-600 text-sm mb-8">Creá tu cuenta para empezar a gestionar turnos.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-bosque-700 mb-1" htmlFor="nombre">
              Nombre del negocio
            </label>
            <input
              id="nombre"
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-md border border-bosque-100 bg-white px-3 py-2 text-bosque-900 focus:outline-none focus:ring-2 focus:ring-bosque-400"
            />
          </div>

          <div>
            <label className="block text-sm text-bosque-700 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-bosque-100 bg-white px-3 py-2 text-bosque-900 focus:outline-none focus:ring-2 focus:ring-bosque-400"
            />
          </div>

          <div>
            <label className="block text-sm text-bosque-700 mb-1" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-bosque-100 bg-white px-3 py-2 text-bosque-900 focus:outline-none focus:ring-2 focus:ring-bosque-400"
            />
          </div>

          {error && <p className="text-arcilla-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-md bg-bosque-800 text-white py-2 font-medium hover:bg-bosque-900 transition-colors disabled:opacity-60"
          >
            {cargando ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>

        <p className="text-sm text-bosque-600 mt-6">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-arcilla-600 hover:underline">
            Ingresar
          </Link>
        </p>
      </div>
    </main>
  );
}
