import { getDb } from "../db.ts";
import { getUserFromRequest } from "./auth.ts";
import { hashPassword } from "../crypto.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function userSummary(u: any) {
  return {
    id: u._id.toString(),
    email: u.email,
    full_name: u.full_name || null,
    unidad: u.unidad || null,
    role: u.role,
    approved: !!u.approved,
    created_date: u.created_date,
  };
}

async function requireAdmin(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return { error: json({ message: "No autenticado" }, 401) };
  if (user.role !== "admin" && user.role !== "superadmin") return { error: json({ message: "Requiere rol admin" }, 403) };
  return { user };
}

async function requireSuperadmin(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return { error: json({ message: "No autenticado" }, 401) };
  if (user.role !== "superadmin") return { error: json({ message: "Solo el superusuario puede hacer esto" }, 403) };
  return { user };
}

// GET /api/admin/users
export async function handleListAllUsers(req: Request): Promise<Response> {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = await getDb();
  const users = await db.collection("User").find({}, { sort: { created_date: -1 } }).toArray();
  return json(users.map(userSummary));
}

// POST /api/admin/users/:id/approve
export async function handleApproveUser(req: Request, id: string): Promise<Response> {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const db = await getDb();
  const { ObjectId } = await import("npm:mongodb@6");
  await db.collection("User").updateOne({ _id: new ObjectId(id) }, { $set: { approved: true } });
  const user = await db.collection("User").findOne({ _id: new ObjectId(id) });
  if (!user) return json({ message: "No encontrado" }, 404);
  return json(userSummary(user));
}

// POST /api/admin/users/:id/reset-password  { newPassword }  (solo el superusuario)
export async function handleResetUserPassword(req: Request, id: string): Promise<Response> {
  const { error } = await requireSuperadmin(req);
  if (error) return error;

  const { newPassword } = await req.json().catch(() => ({}));
  if (!newPassword || newPassword.length < 8) {
    return json({ message: "La contraseña debe tener al menos 8 caracteres" }, 400);
  }

  const db = await getDb();
  const { ObjectId } = await import("npm:mongodb@6");
  const target = await db.collection("User").findOne({ _id: new ObjectId(id) });
  if (!target) return json({ message: "No encontrado" }, 404);
  if (target.role === "superadmin") {
    return json({ message: "No se puede cambiar la contraseña del superusuario desde aquí" }, 400);
  }
  const passwordHash = await hashPassword(newPassword);
  await db.collection("User").updateOne({ _id: new ObjectId(id) }, { $set: { password_hash: passwordHash } });
  return json({ message: "Contraseña actualizada" });
}

// POST /api/admin/users/:id/role  { role: "user" | "admin" }  (solo el superusuario)
export async function handleSetUserRole(req: Request, id: string): Promise<Response> {
  const { error, user: actor } = await requireSuperadmin(req);
  if (error) return error;

  const { role } = await req.json().catch(() => ({}));
  if (role !== "user" && role !== "admin") {
    return json({ message: "Rol no válido. Solo se puede asignar 'user' o 'admin'." }, 400);
  }
  if (actor!._id.toString() === id) {
    return json({ message: "No puedes cambiar tu propio rol de superusuario" }, 400);
  }

  const db = await getDb();
  const { ObjectId } = await import("npm:mongodb@6");
  const target = await db.collection("User").findOne({ _id: new ObjectId(id) });
  if (!target) return json({ message: "No encontrado" }, 404);
  if (target.role === "superadmin") {
    return json({ message: "No se puede cambiar el rol del superusuario" }, 400);
  }

  await db.collection("User").updateOne({ _id: new ObjectId(id) }, { $set: { role } });
  const user = await db.collection("User").findOne({ _id: new ObjectId(id) });
  return json(userSummary(user));
}

// DELETE /api/admin/users/:id  (rechaza / elimina una cuenta, pendiente o no — solo el superusuario)
export async function handleDeleteUser(req: Request, id: string): Promise<Response> {
  const { error, user: admin } = await requireSuperadmin(req);
  if (error) return error;
  if (admin!._id.toString() === id) {
    return json({ message: "No puedes eliminar tu propia cuenta" }, 400);
  }

  const db = await getDb();
  const { ObjectId } = await import("npm:mongodb@6");
  const target = await db.collection("User").findOne({ _id: new ObjectId(id) });
  if (target?.role === "superadmin") {
    return json({ message: "No se puede eliminar la cuenta del superusuario" }, 400);
  }
  await db.collection("User").deleteOne({ _id: new ObjectId(id) });
  return json({ message: "Eliminado" });
}
