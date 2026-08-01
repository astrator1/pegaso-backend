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
  // Listados básicos que un piloto necesita ver para poder rellenar el formulario de vuelo
  // (elegir aeronave, batería, piloto). Cualquier usuario autenticado y aprobado los puede leer.
  Aeronave: { name: "Aeronave", readRule: "any" },
  Bateria: { name: "Bateria", readRule: "any" },
  Piloto: { name: "Piloto", readRule: "any" },
  // Un piloto solo ve sus propios registros de vuelo, no los de otros
  Vuelo: { name: "Vuelo", readRule: "owner" },
  // El resto de la gestión de flota queda fuera del alcance de un piloto normal
  BateriaMantenimiento: { name: "BateriaMantenimiento", readRule: "owner" },
  Mantenimiento: { name: "Mantenimiento", readRule: "owner" },
  Material: { name: "Material", readRule: "owner" },
  Modificaciones: { name: "Modificaciones", readRule: "owner" },
};

export function isValidEntity(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENTITIES, name);
}
