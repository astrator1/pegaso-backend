# Backend – Gestión de Flota (Deno + MongoDB)

Backend serverless en Deno que reemplaza a Base44: autenticación por email/contraseña (JWT)
y CRUD para las 9 entidades de la app (Aeronave, Bateria, BateriaMantenimiento, Mantenimiento,
Material, Modificaciones, Piloto, Vuelo, User), con las mismas reglas de acceso que tenía
definidas en Base44 (`src/entities.ts`).

## 1. Crear la base de datos en MongoDB Atlas (gratis)

1. Ve a https://www.mongodb.com/cloud/atlas/register y crea una cuenta gratuita.
2. Al crear tu primer proyecto, elige el plan **M0 Free** (512 MB, gratis para siempre).
3. Elige un proveedor y región (cualquiera cercana a ti está bien).
4. En **Security Quickstart**:
   - Crea un usuario de base de datos (usuario + contraseña) — **guarda la contraseña**.
   - En "Where would you like to connect from", añade `0.0.0.0/0` (permitir desde cualquier IP).
     Esto es necesario porque Deno Deploy no tiene IPs fijas. Es seguro porque el acceso sigue
     requiriendo usuario y contraseña.
5. Cuando el cluster esté listo, pulsa **Connect** → **Drivers** → copia la cadena de conexión,
   se ve así:
   ```
   mongodb+srv://usuario:<password>@cluster0.xxxxx.mongodb.net/
   ```
6. Sustituye `<password>` por la contraseña real. Esa es tu `MONGODB_URI`.

## 2. Configurar variables de entorno

Copia `.env.example` a `.env` (solo para desarrollo local; en Deno Deploy se configuran en el
dashboard) y rellena:

- `MONGODB_URI`: la cadena de conexión del paso anterior
- `MONGODB_DB`: el nombre que quieras darle a la base de datos, ej. `flota_drones`
- `JWT_SECRET`: una cadena aleatoria larga. Genera una con `openssl rand -hex 32`
- `APP_URL`: la URL de tu frontend (para CORS). En local: `http://localhost:5173`

## 3. Probar en local

Necesitas [Deno instalado](https://docs.deno.com/runtime/getting_started/installation/).

```bash
cd backend
deno task dev
```

Esto levanta el servidor en `http://localhost:8000`.

## 4. Desplegar en Deno Deploy (gratis)

1. Sube este proyecto a un repositorio de GitHub (puedes subir el `frontend` y el `backend`
   al mismo repo, en carpetas separadas, o en repos distintos).
2. Ve a https://dash.deno.com y entra con tu cuenta de GitHub.
3. Crea una nueva app, conecta el repositorio y selecciona la carpeta `backend` como raíz
   del proyecto (o indica `backend/main.ts` como entry point si te lo pide).
4. En la configuración de la app, añade las variables de entorno del paso 2
   (`MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET`, `APP_URL`, y opcionalmente `RESEND_API_KEY`).
5. Despliega. Deno Deploy te dará una URL tipo `https://tu-app.deno.dev` — esa es la URL de
   tu backend, que necesitarás en el frontend como `VITE_API_URL`.

## Notas importantes

- **El primer usuario que se registre se convierte automáticamente en `admin`.** Los
  siguientes se registran con rol `user`. Puedes cambiar el rol de cualquiera directamente
  en MongoDB Atlas (colección `User`, campo `role`).
- **Reglas de acceso (RLS):** están en `src/entities.ts`. Tal y como estaba configurado en
  Base44, un usuario normal solo puede *ver* lo que él mismo creó (excepto en `Aeronave`,
  donde también puede verlo si es admin), y solo un `admin` puede editar o borrar cualquier
  registro. Si tu caso de uso real es que todos los pilotos vean todos los datos de la flota
  (lo más probable en una gestión compartida), cambia `readRule` a `"any"` en las entidades
  que quieras — es la única línea que hay que tocar.
- **Recuperación de contraseña:** funciona sin necesidad de configurar nada — si no defines
  `RESEND_API_KEY`, el link de recuperación se imprime en los logs del servidor (lo ves en el
  dashboard de Deno Deploy). Si quieres que se envíe por email de verdad, crea una cuenta
  gratis en https://resend.com y pon tu API key en `RESEND_API_KEY`.
