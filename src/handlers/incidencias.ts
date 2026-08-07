import { getDb } from "../db.ts";
import { getUserFromRequest } from "./auth.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireSuperadmin(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return { error: json({ message: "No autenticado" }, 401) };
  if (user.role !== "superadmin") return { error: json({ message: "Solo el superusuario puede hacer esto" }, 403) };
  return { user };
}

// POST /api/incidencias/descartar  { clave, tipo, referencia, fecha_mantenimiento }
export async function handleDescartarIncidencia(req: Request): Promise<Response> {
  const { error, user } = await requireSuperadmin(req);
  if (error) return error;

  const { clave, tipo, referencia, fecha_mantenimiento } = await req.json().catch(() => ({}));
  if (!clave) return json({ message: "Falta la clave de la incidencia" }, 400);

  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection("IncidenciaDescartada").updateOne(
    { clave },
    { $set: { clave, tipo, referencia, fecha_mantenimiento, descartado_por: user!.full_name || user!.email, descartado_fecha: now } },
    { upsert: true },
  );
  return json({ message: "Descartado" });
}

// POST /api/incidencias/descartar-todas  { items: [{ clave, tipo, referencia, fecha_mantenimiento }] }
export async function handleDescartarTodasIncidencias(req: Request): Promise<Response> {
  const { error, user } = await requireSuperadmin(req);
  if (error) return error;

  const { items } = await req.json().catch(() => ({ items: [] }));
  if (!Array.isArray(items) || items.length === 0) return json({ message: "Nada que descartar" });

  const db = await getDb();
  const collection = db.collection("IncidenciaDescartada");
  const now = new Date().toISOString();
  for (const item of items) {
    if (!item?.clave) continue;
    await collection.updateOne(
      { clave: item.clave },
      { $set: { ...item, descartado_por: user!.full_name || user!.email, descartado_fecha: now } },
      { upsert: true },
    );
  }
  return json({ descartadas: items.length });
}
