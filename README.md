# turnos-web

Aplicación web **multi-negocio** para gestionar turnos, pedidos y cobros. Cada negocio tiene su panel y un link de reservas para sus clientes. Los clientes pueden reservar como invitados o con cuenta, y pagar una seña con Mercado Pago.

Es la evolución de mi bot de Telegram [`turnos-bot`](https://github.com/MariaEduarda15max/turnos-bot): pasa de un solo negocio a una plataforma que sirve a varios, con aislamiento de datos a nivel de base de datos.

**Demo:** https://turnos-web-liart.vercel.app

> Proyecto de portfolio en desarrollo activo. El cobro online con Mercado Pago funciona en **modo prueba** (sandbox).

---

## Qué hace

**Para el negocio** (panel con login):
- **Agenda:** próximos turnos y los de los últimos 30 días. Se pueden marcar como *Atendido* o *No vino*, o cancelar.
- **Servicios:** duración y precio, activos e inactivos.
- **Horarios:** franjas por día de la semana y bloqueos puntuales (feriados, días libres).
- **Pedidos:** se crean y avanzan de *en preparación* → *listo* → *entregado*, con fechas de cada paso.
- **Pagos:** registro manual de pagos parciales o totales (efectivo, transferencia, etc.) en turnos y pedidos.
- **Cobros online:** el negocio conecta su cuenta de Mercado Pago y elige si no cobra, si cobra una seña (porcentaje o monto fijo) o si cobra el total al reservar.

**Para el cliente** (página pública `/r/<negocio>`):
- Reserva en tres pasos: servicio, día y horario. Los horarios libres se calculan en tiempo real.
- Puede reservar **sin cuenta**: recibe un link privado para ver, cancelar o reprogramar ese turno.
- O puede **crearse una cuenta** con email confirmado para ver todos sus turnos y pedidos en "Mis turnos", con su estado de pago.
- Si el negocio cobra seña, el horario queda **retenido 15 minutos** mientras el cliente paga en Mercado Pago.

## Lo técnico que vale la pena mirar

- **Multi-tenant con Row Level Security.** Todas las tablas llevan `negocio_id`, y las políticas de RLS de Postgres garantizan que un negocio no pueda leer ni escribir datos de otro. El control está en la base de datos, no en el frontend.
- **Anti doble reserva en la base.** Una *exclusion constraint* (`btree_gist` + rangos de tiempo) impide que dos turnos se superpongan, aunque dos personas confirmen en el mismo instante. Las reservas que esperan pago también bloquean el horario hasta que vencen.
- **Lo público no abre la base al público.** La página de reservas no usa políticas de RLS abiertas. Se calcula en el servidor y expone solo los horarios libres, nunca filas con datos de clientes.
- **Acceso por token** para clientes sin cuenta. Si después se crean una cuenta (con email verificado), sus reservas de invitado se vinculan a ella mediante una función `security definer`.
- **Mercado Pago como marketplace:**
  - **OAuth con PKCE:** cada negocio conecta *su* cuenta y la plata va directo a ella.
  - **Tokens protegidos:** se guardan cifrados con AES-256-GCM, en una tabla sin políticas de RLS a la que solo accede el servidor.
  - **Webhooks validados:** se verifica la firma HMAC y nunca se confía en el contenido del aviso. El pago se vuelve a consultar en la API de MP antes de registrarlo.
  - **Registro idempotente:** el mismo aviso repetido no duplica pagos.
  - **Casos borde resueltos en la base:** un pago que llega tarde, cuando el horario ya se ocupó, queda marcado para devolver.
- **Fechas siempre en hora de Montevideo** y en formato de 24 h, sin depender de la zona horaria del servidor.

## Stack

- [Next.js 16](https://nextjs.org): App Router, Server Components y Server Actions (`useActionState`).
- [Supabase](https://supabase.com): Postgres, Auth con confirmación por email y Row Level Security.
- [Mercado Pago](https://www.mercadopago.com.uy/developers): Checkout Pro, OAuth y webhooks.
- [Tailwind CSS](https://tailwindcss.com) y TypeScript.
- Desplegado en [Vercel](https://vercel.com).

## Estructura

```
src/
  proxy.ts                 # refresca la sesión en cada request (Next 16: proxy.ts en vez de middleware.ts)
  lib/
    supabase/              # clientes: navegador, servidor con sesión y servidor con secret key
    slots.ts               # cálculo de horarios libres
    fechas.ts              # fechas en hora de Montevideo
    dinero.ts              # montos, pagos y cálculo de la seña
    mp.ts                  # Mercado Pago: cifrado, OAuth/PKCE, preferencias y firma de webhooks
  app/
    login/, registro/      # acceso del negocio
    dashboard/             # panel: turnos, servicios, horarios, pedidos, pagos, cobros, negocio
    r/[negocioId]/         # reserva pública, cuenta de cliente, "Mis turnos" y turno por token
    api/mp/                # OAuth (iniciar y callback) y webhook de Mercado Pago
    auth/confirm/          # confirmación de email
supabase/migrations/       # 0001–0011: esquema, RLS, funciones y triggers
```

## Correrlo localmente

1. **Instalar dependencias:**
   ```bash
   npm install
   ```
2. **Crear un proyecto en Supabase y aplicar las migraciones:**
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push
   ```
   Usá siempre `npx supabase`: la instalación global (`npm install -g supabase`) está deprecada.
   - Las migraciones 0010 y 0011 tienen que aplicarse por separado: un valor nuevo de un enum no se puede usar en la misma transacción en que se crea. `db push` ya las aplica así.
3. **Variables de entorno:**
   ```bash
   cp .env.local.example .env.local
   ```
   Completá los valores. Las de Mercado Pago solo hacen falta para el cobro online.
4. **Supabase Auth:** dejá activado *Confirm email*. Las funciones de alta exigen un email verificado.
5. **Levantarlo:**
   ```bash
   npm run dev
   ```

La conexión con Mercado Pago (OAuth) solo funciona en la URL registrada en la aplicación de MP, no en `localhost`.

## Estado

- [x] Panel del negocio: servicios, horarios, agenda, pedidos y datos del negocio
- [x] Reserva pública, como invitado o con cuenta, y gestión del turno por link
- [x] Cuentas de cliente con email confirmado y "Mis turnos"
- [x] Pagos manuales, parciales y totales
- [x] Cobro online con Mercado Pago (seña o total), en modo prueba
- [ ] Prueba de pago de punta a punta en sandbox y paso a producción
- [ ] Avisos por email (pedido listo, turno cancelado)
- [ ] Suscripción de los negocios a la plataforma

---

Hecho por **Maria Eduarda Da Rosa**
