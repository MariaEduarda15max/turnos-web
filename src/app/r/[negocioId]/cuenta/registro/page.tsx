"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function RegistroClientePage({
  params,
}: {
  params: Promise<{ negocioId: string }>;
}) {
  // use() puede "desenvolver" una Promise también dentro de un Client
  // Component (a diferencia de await, que solo funciona en componentes
  // de servidor) — es la forma correcta de leer `params` acá, más simple
  // que manejarlo a mano con useState + una promesa resuelta aparte.
  const { negocioId } = use(params);

  const router = useRouter();
  const supabase = crearClienteNavegador();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const [emailEnviado, setEmailEnviado] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const emailNormalizado = email.trim().toLowerCase();
    const destino = `/r/${negocioId}/mis-turnos`;

    // Con "Confirm email" activado, signUp NO abre sesión: manda un email
    // con un link a /auth/confirm, que es quien crea la fila de cliente y
    // adopta los turnos de invitado (vincular_cliente, migración 0005).
    // El nombre viaja en la metadata del usuario hasta ese momento.
    const { data, error: errorAuth } = await supabase.auth.signUp({
      email: emailNormalizado,
      password,
      options: {
        data: { nombre: nombre.trim() },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(destino)}`,
      },
    });

    if (errorAuth || !data.user) {
      setError(errorAuth?.message ?? "No se pudo crear la cuenta.");
      setCargando(false);
      return;
    }

    // Email ya registrado: Supabase no lo dice explícitamente (para no
    // revelar qué emails existen) — devuelve un usuario sin identidades.
    if (data.user.identities?.length === 0) {
      setError("Ese email ya tiene una cuenta. Ingresá con tu contraseña.");
      setCargando(false);
      return;
    }

    // Si el proyecto tuviera la confirmación desactivada, ya hay sesión:
    // se termina el alta acá mismo.
    if (data.session) {
      const { error: errorVinculo } = await supabase.rpc("vincular_cliente", {
        negocio_id_param: negocioId,
      });
      if (errorVinculo) {
        setError("La cuenta se creó, pero hubo un error registrándote: " + errorVinculo.message);
        setCargando(false);
        return;
      }
      router.push(destino);
      router.refresh();
      return;
    }

    setEmailEnviado(emailNormalizado);
    setCargando(false);
  }

  if (emailEnviado) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl text-bosque-800 mb-3">Revisá tu email</h1>
          <p className="text-bosque-600 text-sm">
            Te mandamos un link a <strong>{emailEnviado}</strong> para confirmar tu cuenta.
            Abrilo desde este mismo navegador y vas a entrar directo a tus turnos.
          </p>
          <p className="text-sm text-bosque-500 mt-6">
            ¿Ya lo confirmaste?{" "}
            <Link href={`/r/${negocioId}/cuenta/login`} className="text-arcilla-600 hover:underline">
              Ingresar
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-bosque-800 mb-1">Crear cuenta</h1>
        <p className="text-bosque-500 text-sm mb-8">
          Para ver todos tus turnos en un solo lugar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Tu nombre"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-md border border-bosque-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bosque-400"
          />
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
            minLength={6}
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
            {cargando ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>

        <p className="text-sm text-bosque-500 mt-6">
          ¿Ya tenés cuenta?{" "}
          <Link href={`/r/${negocioId}/cuenta/login`} className="text-arcilla-600 hover:underline">
            Ingresar
          </Link>
        </p>

        <p className="text-xs text-bosque-500 mt-8 border-t border-bosque-100 pt-4">
          ¿Tenés un negocio?{" "}
          <Link href="/registro" className="text-arcilla-600 hover:underline">
            Registralo para gestionar tus turnos
          </Link>
        </p>
      </div>
    </main>
  );
}