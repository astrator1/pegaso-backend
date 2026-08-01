import { getDb } from "../db.ts";
import { ENTITIES, isValidEntity } from "../entities.ts";
import { getUserFromRequest } from "./auth.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function docToJson(doc: any) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

function buildReadFilter(entityName: string, user: any): Record<string, unknown> {
  const rule = ENTITIES[entityName].readRule;
  if (rule === "any") return {};
  if (rule === "owner_or_admin") {
    if (user.role === "admin") return {};
    return { created_by_id: user._id.toString() };
  }
  // "owner"
  if (user.role === "admin") return {}; // un admin siempre puede ver todo, aunque la regla base sea "owner"
  return { created_by_id: user._id.toString() };
}

function parseSort(sortParam: string | null): Record<string, number> {
  if (!sortParam) return { created_date: -1 };
  const desc = sortParam.startsWith("-");
  const field = desc ? sortParam.slice(1) : sortParam;
  return { [field]: desc ? -1 : 1 };
}

export async function handleEntities(req: Request, url: URL, entityName: string, subPath: string[]): Promise<Response> {
  if (!isValidEntity(entityName)) return json({ message: `Entidad desconocida: ${entityName}` }, 404);

  const user = await getUserFromRequest(req);
  if (!user) return json({ message: "No autenticado" }, 401);

  const db = await getDb();
  const collection = db.collection(entityName);
  const isAdmin = user.role === "admin";
  const id = subPath[0] && subPath[0] !== "filter" && subPath[0] !== "bulk-create" && subPath[0] !== "bulk-update" ? subPath[0] : null;
  const action = subPath[0] === "filter" || subPath[0] === "bulk-create" || subPath[0] === "bulk-update" ? subPath[0] : null;

  try {
    // ---- LIST: GET /api/entities/:name ----
    if (req.method === "GET" && !id && !action) {
      const sort = parseSort(url.searchParams.get("sort"));
      const limit = Number(url.searchParams.get("limit")) || 1000;
      const filter = buildReadFilter(entityName, user);
      const docs = await collection.find(filter, { sort, limit }).toArray();
      return json(docs.map(docToJson));
    }

    // ---- FILTER: POST /api/entities/:name/filter ----
    if (req.method === "POST" && action === "filter") {
      const body = await req.json().catch(() => ({}));
      const query = body.query || body || {};
      const sort = parseSort(body.sort || null);
      const limit = Number(body.limit) || 1000;
      const filter = { ...query, ...buildReadFilter(entityName, user) };
      const docs = await collection.find(filter, { sort, limit }).toArray();
      return json(docs.map(docToJson));
    }

    // ---- GET ONE: GET /api/entities/:name/:id ----
    if (req.method === "GET" && id) {
      const { ObjectId } = await import("mongo/mod.ts");
      const filter = { _id: new ObjectId(id), ...buildReadFilter(entityName, user) };
      const doc = await collection.findOne(filter);
      if (!doc) return json({ message: "No encontrado" }, 404);
      return json(docToJson(doc));
    }

    // ---- CREATE: POST /api/entities/:name ----
    if (req.method === "POST" && !action) {
      const body = await req.json().catch(() => ({}));
      const now = new Date().toISOString();
      const toInsert = {
        ...body,
        created_by_id: user._id.toString(),
        created_by_email: user.email,
        created_date: now,
        updated_date: now,
      };
      delete toInsert.id;
      const insertId = await collection.insertOne(toInsert);
      const doc = await collection.findOne({ _id: insertId });
      return json(docToJson(doc), 201);
    }

    // ---- BULK CREATE: POST /api/entities/:name/bulk-create ----
    if (req.method === "POST" && action === "bulk-create") {
      const items: any[] = await req.json().catch(() => []);
      const now = new Date().toISOString();
      const toInsert = items.map((item) => {
        const clean = { ...item };
        delete clean.id;
        return { ...clean, created_by_id: user._id.toString(), created_by_email: user.email, created_date: now, updated_date: now };
      });
      if (toInsert.length === 0) return json([]);
      await collection.insertMany(toInsert);
      return json({ inserted: toInsert.length }, 201);
    }

    // ---- UPDATE: PUT /api/entities/:name/:id ---- (solo admin, igual que el rls original)
    if (req.method === "PUT" && id) {
      if (!isAdmin) return json({ message: "Requiere rol admin" }, 403);
      const { ObjectId } = await import("mongo/mod.ts");
      const body = await req.json().catch(() => ({}));
      delete body.id;
      delete body._id;
      body.updated_date = new Date().toISOString();
      await collection.updateOne({ _id: new ObjectId(id) }, { $set: body });
      const doc = await collection.findOne({ _id: new ObjectId(id) });
      if (!doc) return json({ message: "No encontrado" }, 404);
      return json(docToJson(doc));
    }

    // ---- BULK UPDATE: POST /api/entities/:name/bulk-update ---- (solo admin)
    if (req.method === "POST" && action === "bulk-update") {
      if (!isAdmin) return json({ message: "Requiere rol admin" }, 403);
      const { ObjectId } = await import("mongo/mod.ts");
      const items: any[] = await req.json().catch(() => []);
      for (const item of items) {
        const { id: itemId, ...fields } = item;
        if (!itemId) continue;
        fields.updated_date = new Date().toISOString();
        await collection.updateOne({ _id: new ObjectId(itemId) }, { $set: fields });
      }
      return json({ updated: items.length });
    }

    // ---- DELETE: DELETE /api/entities/:name/:id ---- (solo admin, igual que el rls original)
    if (req.method === "DELETE" && id) {
      if (!isAdmin) return json({ message: "Requiere rol admin" }, 403);
      const { ObjectId } = await import("mongo/mod.ts");
      await collection.deleteOne({ _id: new ObjectId(id) });
      return json({ message: "Eliminado" });
    }

    return json({ message: "Ruta no encontrada" }, 404);
  } catch (e) {
    console.error(e);
    return json({ message: "Error interno" }, 500);
  }
}
