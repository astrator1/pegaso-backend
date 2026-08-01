import { MongoClient } from "npm:mongodb@6";

let client: MongoClient | null = null;

export async function getDb() {
  if (!client) {
    const uri = Deno.env.get("MONGODB_URI");
    if (!uri) {
      throw new Error("Falta la variable de entorno MONGODB_URI");
    }
    client = new MongoClient(uri);
    await client.connect();
  }
  const dbName = Deno.env.get("MONGODB_DB") || "flota_drones";
  return client.db(dbName);
}
