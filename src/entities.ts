// Definición de las entidades y sus reglas de acceso (equivalente al "rls" de los .jsonc de Base44).
//
// read: "owner"       -> solo quien creó el registro puede leerlo
// read: "owner_or_admin" -> quien lo creó, o cualquier admin
// read: "any"          -> cualquier usuario autenticado
// create: "any"        -> cualquier usuario autenticado y aprobado puede crear registros
// create: "admin"      -> solo un admin puede crear registros de esta entidad
// write ("update"/"delete"): "admin" -> solo administradores
//
// Si tu caso de uso real necesita que todos los pilotos vean todos los datos (probable en una
// gestión de flota compartida), cambia el "read" de las entidades que quieras a "any" aquí abajo.
// Es el único sitio que hay que tocar.

export type ReadRule = "owner" | "owner_or_admin" | "any";
export type CreateRule = "any" | "admin";

export interface EntityConfig {
  name: string;
  readRule: ReadRule;
  createRule: CreateRule;
  // update/delete siempre exigen rol admin (igual que en el export de Base44)
}

export const ENTITIES: Record<string, EntityConfig> = {
  // Listados básicos que un piloto necesita ver para poder rellenar el formulario de vuelo
  // (elegir aeronave, batería, piloto). Cualquier usuario autenticado y aprobado los puede leer,
  // pero solo un admin puede dar de alta aeronaves/baterías/pilotos nuevos.
  Aeronave: { name: "Aeronave", readRule: "any", createRule: "admin" },
  Bateria: { name: "Bateria", readRule: "any", createRule: "admin" },
  Piloto: { name: "Piloto", readRule: "any", createRule: "admin" },
  // Un piloto solo ve y crea sus propios registros de vuelo
  Vuelo: { name: "Vuelo", readRule: "owner", createRule: "any" },
  // El resto de la gestión de flota queda fuera del alcance de un piloto normal
  BateriaMantenimiento: { name: "BateriaMantenimiento", readRule: "owner", createRule: "admin" },
  Mantenimiento: { name: "Mantenimiento", readRule: "owner", createRule: "admin" },
  Material: { name: "Material", readRule: "owner", createRule: "admin" },
  Modificaciones: { name: "Modificaciones", readRule: "owner", createRule: "admin" },
};

export function isValidEntity(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENTITIES, name);
}
