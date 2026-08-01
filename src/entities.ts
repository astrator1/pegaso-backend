// Definición de las entidades y sus reglas de acceso (equivalente al "rls" de los .jsonc de Base44).
//
// read: "owner"       -> solo quien creó el registro puede leerlo
// read: "owner_or_admin" -> quien lo creó, o cualquier admin
// read: "any"          -> cualquier usuario autenticado
// write ("update"/"delete"): "admin" -> solo administradores
//
// Si tu caso de uso real necesita que todos los pilotos vean todos los datos (probable en una
// gestión de flota compartida), cambia el "read" de las entidades que quieras a "any" aquí abajo.
// Es el único sitio que hay que tocar.

export type ReadRule = "owner" | "owner_or_admin" | "any";

export interface EntityConfig {
  name: string;
  readRule: ReadRule;
  // create siempre exige estar autenticado y fuerza created_by_id = user.id
  // update/delete siempre exigen rol admin (igual que en el export de Base44)
}

export const ENTITIES: Record<string, EntityConfig> = {
  Aeronave: { name: "Aeronave", readRule: "owner_or_admin" },
  Bateria: { name: "Bateria", readRule: "owner" },
  BateriaMantenimiento: { name: "BateriaMantenimiento", readRule: "owner" },
  Mantenimiento: { name: "Mantenimiento", readRule: "owner" },
  Material: { name: "Material", readRule: "owner" },
  Modificaciones: { name: "Modificaciones", readRule: "owner" },
  Piloto: { name: "Piloto", readRule: "owner" },
  Vuelo: { name: "Vuelo", readRule: "owner" },
};

export function isValidEntity(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENTITIES, name);
}
