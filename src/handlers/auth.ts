import { getDb } from "../db.ts";
import { hashPassword, verifyPassword, signJWT, verifyJWT, randomToken } from "../crypto.ts";

const JWT_SECRET = () => Deno.env.get("JWT_SECRET") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function userToPublic(u: any) {
  return { id: u._id.toString(), email: u.email, role: u.role, full_name: u.full_name || null, unidad: u.unidad || null, approved: !!u.approved };
}

export async function handleRegister(req: Request): Promise<Response> {
  const { email, password, full_name, unidad } = await req.json().catch(() => ({}));
  if (!email || !password) return json({ message: "Email y contraseña son obligatorios" }, 400);
  if (!full_name || !full_name.trim()) return json({ message: "El nombre y apellidos son obligatorios" }, 400);
  if (!unidad || !unidad.trim()) return json({ message: "La unidad es obligatoria" }, 400);
  if (password.length < 8) return json({ message: "La contraseña debe tener al menos 8 caracteres" }, 400);

  const db = await getDb();
  const users = db.collection("User");
  const existing = await users.findOne({ email: email.toLowerCase() });
  if (existing) return json({ message: "Ya existe una cuenta con ese email" }, 409);

  const userCount = await users.countDocuments({});
  const isFirstUser = userCount === 0;
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const { insertedId } = await users.insertOne({
    email: email.toLowerCase(),
    password_hash: passwordHash,
    full_name: full_name.trim(),
    unidad: unidad.trim(),
    // El primer usuario que se registra se convierte en admin automáticamente y queda aprobado.
    // Los siguientes se registran como "user" y quedan pendientes de aprobación por un admin.
    role: isFirstUser ? "superadmin" : "user",
    approved: isFirstUser,
    created_date: now,
  });

  if (!isFirstUser) {
    // No damos token de sesión hasta que un admin apruebe la cuenta.
    return json({ pending: true, message: "Cuenta creada. Un administrador debe aprobarla antes de que puedas entrar." }, 201);
  }

  const user = await users.findOne({ _id: insertedId });
  const token = await signJWT({ sub: user!._id.toString() }, JWT_SECRET());
  return json({ access_token: token, user: userToPublic(user) }, 201);
}

export async function handleLogin(req: Request): Promise<Response> {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return json({ message: "Email y contraseña son obligatorios" }, 400);

  const db = await getDb();
  const users = db.collection("User");
  const user = await users.findOne({ email: email.toLowerCase() });
  if (!user) return json({ message: "Credenciales inválidas" }, 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return json({ message: "Credenciales inválidas" }, 401);

  if (!user.approved) {
    return json({ pending: true, message: "Tu cuenta todavía no ha sido aprobada por un administrador." }, 403);
  }

  const token = await signJWT({ sub: user._id.toString() }, JWT_SECRET());
  return json({ access_token: token, user: userToPublic(user) });
}

export async function handleMe(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) return json({ message: "No autenticado" }, 401);
  return json(userToPublic(user));
}

export async function handleChangePassword(req: Request): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) return json({ message: "No autenticado" }, 401);

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!currentPassword || !newPassword) return json({ message: "Faltan datos" }, 400);
  if (newPassword.length < 8) return json({ message: "La contraseña nueva debe tener al menos 8 caracteres" }, 400);

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) return json({ message: "La contraseña actual no es correcta" }, 401);

  const db = await getDb();
  const passwordHash = await hashPassword(newPassword);
  await db.collection("User").updateOne({ _id: user._id }, { $set: { password_hash: passwordHash } });
  return json({ message: "Contraseña actualizada" });
}

export async function handleForgotPassword(req: Request): Promise<Response> {
  const { email } = await req.json().catch(() => ({}));
  if (email) {
    const db = await getDb();
    const users = db.collection("User");
    const user = await users.findOne({ email: email.toLowerCase() });
    if (user) {
      const token = randomToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora
      await users.updateOne({ _id: user._id }, { $set: { reset_token: token, reset_token_expires: expires } });

      const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";
      const resetLink = `${appUrl}/reset-password?token=${token}`;
      const resendKey = Deno.env.get("RESEND_API_KEY");

      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: Deno.env.get("RESEND_FROM") || "onboarding@resend.dev",
              to: email,
              subject: "Restablecer contraseña",
              html: `<p>Haz clic para restablecer tu contraseña: <a href="${resetLink}">${resetLink}</a></p><p>Caduca en 1 hora.</p>`,
            }),
          });
        } catch (e) {
          console.error("Error enviando email de reset:", e);
        }
      } else {
        console.log(`[reset-password] Link para ${email}: ${resetLink}`);
      }
    }
  }
  // Siempre respondemos éxito, exista o no el email, para no filtrar qué correos están registrados.
  return json({ message: "Si el email existe, se ha enviado un enlace de recuperación" });
}

export async function handleResetPassword(req: Request): Promise<Response> {
  const { resetToken, newPassword } = await req.json().catch(() => ({}));
  if (!resetToken || !newPassword) return json({ message: "Faltan datos" }, 400);
  if (newPassword.length < 8) return json({ message: "La contraseña debe tener al menos 8 caracteres" }, 400);

  const db = await getDb();
  const users = db.collection("User");
  const user = await users.findOne({ reset_token: resetToken });
  if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
    return json({ message: "El enlace de recuperación es inválido o ha caducado" }, 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await users.updateOne(
    { _id: user._id },
    { $set: { password_hash: passwordHash }, $unset: { reset_token: "", reset_token_expires: "" } },
  );
  return json({ message: "Contraseña actualizada" });
}

// Usado por otras rutas para saber quién hace la petición.
export async function getUserFromRequest(req: Request): Promise<any | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const payload = await verifyJWT(token, JWT_SECRET());
  if (!payload || !payload.sub) return null;

  const db = await getDb();
  const users = db.collection("User");
  const { ObjectId } = await import("npm:mongodb@6");
  try {
    const user = await users.findOne({ _id: new ObjectId(payload.sub as string) });
    return user;
  } catch {
    return null;
  }
}
