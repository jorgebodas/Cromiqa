# Conectar Supabase (backend de Cromiqa)

Tiempo: unos 10 minutos, solo una vez. Hasta que lo completes, la web sigue funcionando con los
formularios por email y el carrusel incluido en el código, y `cromiqa.com/#/admin` muestra
"Conecta Supabase".

## Pasos

1. **Crea el proyecto**
   - Entra en [supabase.com](https://supabase.com) y crea una cuenta (gratis).
   - *New project* → nombre `cromiqa`.
   - Región: **West EU (Ireland)** o **Central EU (Frankfurt)**.
   - Guarda la contraseña de la base de datos en tu gestor de contraseñas.

2. **Crea las tablas y la seguridad**
   - Menú *SQL Editor* → *New query*.
   - Pega todo el contenido del archivo `supabase/schema.sql` de este repositorio.
   - Pulsa *Run*. Debe terminar sin errores (se puede volver a ejecutar sin problema).

3. **Crea tu usuario**
   - *Authentication* → *Users* → *Add user* → *Create new user*.
   - Tu email y una contraseña larga. Marca **Auto Confirm User**.

4. **Hazte administrador**
   - En *SQL Editor* ejecuta (con el mismo email del paso 3):
     ```sql
     insert into public.admins (email) values ('tu-email@ejemplo.com');
     ```

5. **Cierra el registro público de cuentas** (recomendado)
   - *Authentication* → *Sign In / Providers* → *Email* → desactiva **Allow new users to sign up**.
   - Así nadie puede crearse una cuenta; los administradores los añades tú (pasos 3 y 4).

6. **Conecta la web**
   - *Project Settings* → *API*.
   - Copia **Project URL** y la clave **anon public**.
   - Pégalas en `DEFAULT_URL` y `DEFAULT_ANON_KEY` de `src/services/supabase.ts`, o pásaselas a Claude.
   - La clave *anon* es pública por diseño (la seguridad está en las reglas de la base de datos).
   - **Nunca compartas ni pegues la clave `service_role`.**

7. **Publica** (push a `main`) y entra en `cromiqa.com/#/admin` con tu email y contraseña.

## Añadir otro administrador

Repite los pasos 3 y 4 con su email. Para quitarle el acceso:

```sql
delete from public.admins where email = 'su-email@ejemplo.com';
```

## Qué protege qué

- Los visitantes solo pueden **añadir** registros (lista de espera y mecánicos), nunca leerlos.
- Leer, editar, exportar o borrar exige iniciar sesión **y** estar en la tabla `admins`.
- Los emails son únicos por formulario: un email repetido se rechaza desde cualquier dispositivo.
- Las fotos del carrusel se guardan en el bucket público `site`; solo los administradores pueden subir o borrar.
