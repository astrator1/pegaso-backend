import { getDb } from "../db.ts";
import { getUserFromRequest } from "./auth.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/planes-vuelo/:id/decidir  { estado: "aprobado" | "rechazado", comentario? }
// Solo admin/superadmin. El nombre de quien decide y la fecha los pone el propio servidor,
// para que no se puedan falsear desde el cliente (equivale a la "firma" del papel).
export async function handleDecidirPlanVuelo(req: Request, id: string): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) return json({ message: "No autenticado" }, 401);
  if (user.role !== "admin" && user.role !== "superadmin") {
    return json({ message: "Requiere rol admin" }, 403);
  }

  const { estado, comentario } = await req.json().catch(() => ({}));
  if (estado !== "aprobado" && estado !== "rechazado") {
    return json({ message: "Estado no válido. Debe ser 'aprobado' o 'rechazado'." }, 400);
  }

  const db = await getDb();
  const { ObjectId } = await import("npm:mongodb@6");
  const collection = db.collection("PlanVuelo");
  const existing = await collection.findOne({ _id: new ObjectId(id) });
  if (!existing) return json({ message: "No encontrado" }, 404);

  const now = new Date().toISOString();
  await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        estado,
        comentario_aprobacion: comentario || null,
        aprobado_por: user.full_name || user.email,
        aprobado_por_email: user.email,
        fecha_decision: now,
        updated_date: now,
      },
    },
  );
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  const { _id, ...rest } = doc!;
  return json({ id: _id.toString(), ...rest });
}

// POST /api/vuelos/:id/decidir  { estado: "validado" | "rechazado", comentario? }
// Solo admin/superadmin. Valida (o rechaza) un vuelo registrado por un piloto, antes de que
// se considere definitivo en el registro. El nombre de quien valida y la fecha los pone el
// propio servidor.
export async function handleDecidirVuelo(req: Request, id: string): Promise<Response> {
  const user = await getUserFromRequest(req);
  if (!user) return json({ message: "No autenticado" }, 401);
  if (user.role !== "admin" && user.role !== "superadmin") {
    return json({ message: "Requiere rol admin" }, 403);
  }

  const { estado, comentario } = await req.json().catch(() => ({}));
  if (estado !== "validado" && estado !== "rechazado") {
    return json({ message: "Estado no válido. Debe ser 'validado' o 'rechazado'." }, 400);
  }

  const db = await getDb();
  const { ObjectId } = await import("npm:mongodb@6");
  const collection = db.collection("Vuelo");
  const existing = await collection.findOne({ _id: new ObjectId(id) });
  if (!existing) return json({ message: "No encontrado" }, 404);

  const now = new Date().toISOString();
  await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        estado,
        comentario_validacion: comentario || null,
        validado_por: user.full_name || user.email,
        validado_por_email: user.email,
        fecha_validacion: now,
        updated_date: now,
      },
    },
  );
  const doc2 = await collection.findOne({ _id: new ObjectId(id) });
  const { _id: _id2, ...rest2 } = doc2!;
  return json({ id: _id2.toString(), ...rest2 });
}
