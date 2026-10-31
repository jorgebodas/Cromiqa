# Prueba compartida (varios móviles, cuentas reales)

Con esto, cada probador entra con su propia cuenta desde su móvil y todos compartís los mismos
datos de prueba: si tu amigo envía una solicitud, te llega al móvil del taller **en directo**.

Se configura una sola vez en Supabase (≈5 minutos):

## 1. Crea la tabla compartida
Supabase → **SQL Editor** → *New query* → pega todo `supabase/shared-demo.sql` → **Run**.

## 2. Deja que los probadores creen su cuenta
Supabase → **Authentication** → **Sign In / Providers** → **Email**:
- **Allow new users to sign up**: activado.
- **Confirm email**: desactivado para las pruebas (si lo dejas activado, cada probador recibirá un
  email de confirmación; entonces pon también *Authentication → URL Configuration → Site URL* =
  `https://cromiqa.com`).

## 3. Crea los tres talleres de prueba
Supabase → **Authentication** → **Users** → *Add user* → *Create new user*, marcando **Auto Confirm User**:

| Email | Taller |
|---|---|
| `taller1@cromiqa.com` | Rafa Gómez · Taller Centro (Madrid centro, Vallecas, Moratalaz) |
| `taller2@cromiqa.com` | Laura Prieto · Bici a Domicilio (solo a domicilio: Rivas, Arganda, Coslada, San Fernando, Mejorada, Velilla, Vallecas) |
| `taller3@cromiqa.com` | Sergio Lara · Taller Este (Coslada, San Fernando, Moratalaz, Rivas) |

Pon la contraseña que quieras (la misma para los tres vale). No hace falta que esos emails existan.

## 4. Publica
Dile a Claude «publica». A partir de ahí cromiqa.com, después de la contraseña de acceso del
prototipo (no está en el repositorio), pide entrar o crear cuenta.

## Cómo probar
- **Tu amigo:** abre `cromiqa.com/#/entrar`, contraseña de acceso, **Crear cuenta** (nombre, zona,
  email, contraseña) y pide un servicio con el **+**. Elige uno o varios talleres de prueba.
- **Tú:** entra con `taller1@…`, `taller2@…` o `taller3@…`. La solicitud aparece en **Solicitudes**;
  respóndela. Para cambiar de taller: **Salir** (barra negra de arriba) y entra con otro.
- Lo que haga uno le llega al otro al momento (o al recargar si la conexión en tiempo real falla).
- **Empezar de cero:** Perfil → *Datos de prueba* → *Restablecer* (borra las solicitudes de todos; las cuentas se mantienen).

## Límites (es una prueba, no producción)
- Todos los datos de prueba son un único documento que cualquier probador con cuenta puede leer y cambiar.
- Las fotos se guardan comprimidas dentro de ese documento.
- El cierre automático a las 72 h se calcula al abrir la app.
- `npm run dev`, staging y los tests siguen usando la demo local por navegador (sin cuentas).
