import { handleRegister, handleLogin, handleMe, handleChangePassword, handleForgotPassword, handleResetPassword } from "./src/handlers/auth.ts";
import { handleEntities } from "./src/handlers/entities.ts";
import { handleListAllUsers, handleApproveUser, handleDeleteUser, handleResetUserPassword } from "./src/handlers/admin.ts";

function corsHeaders() {
  const origin = Deno.env.get("APP_URL") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  const cors = corsHeaders();
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

async function router(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (path === "/" || path === "/health") {
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  if (path === "/api/auth/register" && req.method === "POST") return handleRegister(req);
  if (path === "/api/auth/login" && req.method === "POST") return handleLogin(req);
  if (path === "/api/auth/me" && req.method === "GET") return handleMe(req);
  if (path === "/api/auth/change-password" && req.method === "POST") return handleChangePassword(req);
  if (path === "/api/auth/forgot-password" && req.method === "POST") return handleForgotPassword(req);
  if (path === "/api/auth/reset-password" && req.method === "POST") return handleResetPassword(req);

  if (path === "/api/admin/users" && req.method === "GET") return handleListAllUsers(req);
  const approveMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/approve$/);
  if (approveMatch && req.method === "POST") return handleApproveUser(req, approveMatch[1]);
  const resetPwMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/reset-password$/);
  if (resetPwMatch && req.method === "POST") return handleResetUserPassword(req, resetPwMatch[1]);
  const userIdMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userIdMatch && req.method === "DELETE") return handleDeleteUser(req, userIdMatch[1]);

  const entityMatch = path.match(/^\/api\/entities\/([^/]+)(?:\/(.*))?$/);
  if (entityMatch) {
    const [, entityName, rest] = entityMatch;
    const subPath = rest ? rest.split("/").filter(Boolean) : [];
    return handleEntities(req, url, entityName, subPath);
  }

  return new Response(JSON.stringify({ message: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  try {
    const res = await router(req);
    return withCors(res);
  } catch (e) {
    console.error(e);
    return withCors(new Response(JSON.stringify({ message: "Error interno" }), { status: 500, headers: { "Content-Type": "application/json" } }));
  }
});
