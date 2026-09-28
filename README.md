# turnos-web

Aplicación web de gestión de turnos, multi-negocio (multi-tenant). Evolución
del [bot de Telegram `turnos-bot`](https://github.com/MariaEduarda15max/turnos-bot)
hacia una web app real: panel del negocio con login, y — próximamente —
reserva pública para clientes sin necesidad de cuenta.

## Estado del proyecto

- [x] Backend en Supabase: 7 tablas, multi-negocio, Row Level Security
- [x] Auth del negocio (registro + login con Supabase Auth)
- [x] Dashboard protegido, con aislamiento real entre negocios (RLS, no solo
      lógica de frontend)
- [x] Gestión de Servicios (crear, activar/desactivar, borrar)
- [x] Gestión de Disponibilidad/Horarios, con anti-solape de franjas
- [x] Reserva pública de turnos (sin cuenta), con horarios calculados en
      tiempo real y anti-doble-reserva
- [x] Ver/cancelar/reprogramar un turno vía link con token, sin cuenta
- [ ] "Mis turnos" para clientes con cuenta (fusión de turnos de invitado)
- [ ] Gestión de Pedidos

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Components, Server Actions)
- [Supabase](https://supabase.com) — Postgres, Auth, Row Level Security
- [Tailwind CSS](https://tailwindcss.com)
- TypeScript

## Por qué existe un backend separado del bot

`turnos-bot` asume un solo negocio. Acá el modelo de datos es **multi-tenant**:
todas las tablas llevan `negocio_id`, y las políticas de RLS garantizan —a
nivel de base de datos, no solo de código— que un negocio nunca pueda leer o
escribir datos de otro. Por eso corre en su propio proyecto de Supabase, no
comparte base con el bot.

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el proyecto en Supabase

Uno nuevo, separado del de `turnos-bot` — así los datos de portfolio/demo no
se mezclan con datos de negocios reales interesados.

### 3. Aplicar la migración

```bash
npm install supabase --save-dev   # si no está ya
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

> ⚠️ `npm install -g supabase` está deprecado por Supabase y falla a
> propósito — usar siempre `npx supabase ...`.

### 4. Variables de entorno

```bash
cp .env.local.example .env.local
```

Completar con los valores reales del proyecto (Dashboard → Settings → API
Keys):

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" — formato corto `https://xxxxx.supabase.co`, **no** el link del dashboard |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | "Publishable key", empieza con `sb_publishable_...` |

### 5. Desactivar confirmación de email (solo para desarrollo)

Dashboard → **Authentication → Sign In / Providers → Email** → desactivar
"Confirm email" → **guardar el cambio explícitamente** (el toggle puede
verse activado visualmente sin haber persistido).

Sin este paso, el registro crea el usuario pero no da sesión activa hasta
confirmar el email — y como el `insert` en `negocios` corre en el mismo paso
que el registro, falla con "violates row-level security policy" (no hay
`auth.uid()` todavía).

### 6. Correr

```bash
npm run dev
```

`http://localhost:3000` redirige a `/login` o `/dashboard` según haya sesión.

## Estructura

```
src/
  proxy.ts                        # refresca la sesión en cada request (ver nota abajo)
  lib/
    fechas.ts                     # zona horaria fija, mismo patrón que turnos-bot
    slots.ts                      # cálculo de horarios libres, compartido
    supabase/
      client.ts                   # Client Components (navegador)
      server.ts                   # Server Components/Actions autenticados
      publico.ts                  # secret key, SOLO server-side, para la reserva pública
  app/
    login/page.tsx
    registro/page.tsx
    dashboard/
      page.tsx                    # panel principal, protegido
      CerrarSesionBoton.tsx
      servicios/
        page.tsx
        actions.ts                 # Server Actions: crear/activar/borrar
        FormularioAgregarServicio.tsx
        BotonBorrarServicio.tsx
      horarios/                    # disponibilidad, con anti-solape
    r/
      [negocioId]/                 # reserva pública — sin login
        page.tsx                   # elegir servicio → día → horario → confirmar
        actions.ts
        FormularioReserva.tsx
        turno/
          [token]/                 # ver/cancelar/reprogramar por link, sin cuenta
            page.tsx
            actions.ts
            BotonCancelar.tsx
            FormularioReprogramar.tsx
supabase/
  migrations/
    0001_init.sql                 # schema completo: tablas, RLS, funciones
    0002_disponibilidad_sin_solapes.sql
```

## Decisiones de diseño que vale la pena entender

**Dos clientes de Supabase, no uno.** A diferencia de `turnos-bot` (una sola
función), acá hace falta `client.ts` (navegador) y `server.ts` (servidor) —
Next.js corre código en los dos lados, y cada uno maneja la sesión distinto.

**`proxy.ts`, no `middleware.ts`.** Next 16 renombró la convención. Cumple
una función de refresco de sesión, **no** es la única protección de rutas
(ver comentario en el archivo sobre CVE-2025-29927) — el dashboard también
valida la sesión del lado del servidor, como segunda capa.

**RLS con dos políticas por tabla en varios casos** (`turnos`, `pedidos`,
`clientes`): una para el negocio dueño, otra para el cliente con cuenta.
Postgres las combina con OR — si algo "no se ve" cuando debería, revisar que
estén las dos, no solo una.

**La reserva pública NO usa políticas de RLS abiertas al público.** Para
calcular horarios libres hace falta leer `turnos` y `bloqueos`, no solo
`servicios`/`disponibilidad` — y `turnos` tiene datos de clientes reales.
Abrir eso a "cualquiera" expondría más de lo necesario. En cambio,
`lib/supabase/publico.ts` usa la secret key (bypasea RLS por diseño, igual
que la función `telegram-webhook` de `turnos-bot`) y el código decide
explícitamente qué exponer — nunca las filas crudas.

**Acceso por token para clientes sin cuenta.** Cada turno tiene un
`token_acceso` (uuid) único — quien tenga ese link puede ver/cancelar/
reprogramar ESE turno puntual, sin login. Es el mismo patrón que usaba el
bot con "Mis turnos", adaptado a web.

**Server Actions con `.bind()`** para pasar argumentos (ver
`servicios/actions.ts` + `page.tsx`): permite que un botón de una lista
dispare una acción del servidor con el id correcto, sin necesitar un input
oculto por fila.

## Seguridad

- `.env.local` nunca se versiona (ver `.gitignore`) — sin eso, las
  credenciales de Supabase quedarían públicas en el repo.
- Next se mantiene en la versión parcheada más reciente disponible al
  momento de cada sesión de trabajo — hubo más de un CVE de Denial of
  Service corregido entre fines de 2025 y mediados de 2026.

---

Hecho por **Maria Eduarda Da Rosa**