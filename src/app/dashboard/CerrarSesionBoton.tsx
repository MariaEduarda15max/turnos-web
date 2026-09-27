"use client";

import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function CerrarSesionBoton() {
  const router = useRouter();
  const supabase = crearClienteNavegador();

  async function handleClick() {
    await supabase.auth.signOut();
    router.push("/login");
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
