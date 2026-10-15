"use client";

import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

// Compartido entre el panel del negocio (vuelve a /login) y la cuenta de
// cliente (vuelve a la página de reservas de ese negocio).
export default function CerrarSesionBoton({ destino = "/login" }: { destino?: string }) {
  const router = useRouter();
  const supabase = crearClienteNavegador();

  async function handleClick() {
    await supabase.auth.signOut();
    router.push(destino);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      className="text-sm text-bosque-600 hover:text-arcilla-600 transition-colors"
    >
      Cerrar sesión
    </button>
  );
}
