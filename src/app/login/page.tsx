"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function LoginPage() {
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

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email o contraseña incorrectos.");
      setCargando(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl text-bosque-800 mb-1">Ingresar</h1>
        <p className="text-bosque-600 text-sm mb-8">Panel del negocio.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="text-sm text-bosque-600 mt-6">
          ¿Todavía no tenés cuenta?{" "}
          <Link href="/registro" className="text-arcilla-600 hover:underline">
            Registrar mi negocio
          </Link>
        </p>
      </div>
    </main>
  );
}
