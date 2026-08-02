// Definición de las entidades y sus reglas de acceso (equivalente al "rls" de los .jsonc de Base44).
//
// read: "owner"       -> solo quien creó el registro puede leerlo
// read: "owner_or_admin" -> quien lo creó, o cualquier admin
// read: "any"          -> cualquier usuario autenticado
// create: "any"        -> cualquier usuario autenticado y aprobado puede crear registros
// create: "admin"      -> solo un admin puede crear registros de esta entidad
// write ("update"/"delete"): "admin" -> solo administradores
// write ("update"/"delete"): "owner_or_admin" -> quien creó el registro, o cualquier admin
//
// Si tu caso de uso real necesita que todos los pilotos vean todos los datos (probable en una
// gestión de flota compartida), cambia el "read" de las entidades que quieras a "any" aquí abajo.
// Es el único sitio que hay que tocar.

export type ReadRule = "owner" | "owner_or_admin" | "any";
export type CreateRule = "any" | "admin";
export type WriteRule = "admin" | "owner_or_admin";

export interface EntityConfig {
  name: string;
  readRule: ReadRule;
  createRule: CreateRule;
  writeRule: WriteRule;
}

export const ENTITIES: Record<string, EntityConfig> = {
  // Listados básicos que un piloto necesita ver para poder rellenar el formulario de vuelo
  // (elegir aeronave, batería, piloto). Cualquier usuario autenticado y aprobado los puede leer,
  // pero solo un admin puede dar de alta, editar o borrar aeronaves/baterías/pilotos.
  Aeronave: { name: "Aeronave", readRule: "any", createRule: "admin", writeRule: "admin" },
  Bateria: { name: "Bateria", readRule: "any", createRule: "admin", writeRule: "admin" },
  Piloto: { name: "Piloto", readRule: "any", createRule: "admin", writeRule: "admin" },
  // Un piloto ve, crea, edita y borra sus propios registros de vuelo (y nada más que los suyos)
  Vuelo: { name: "Vuelo", readRule: "owner", createRule: "any", writeRule: "owner_or_admin" },
  // El resto de la gestión de flota queda fuera del alcance de un piloto normal
  BateriaMantenimiento: { name: "BateriaMantenimiento", readRule: "owner", createRule: "admin", writeRule: "admin" },
  Mantenimiento: { name: "Mantenimiento", readRule: "owner", createRule: "admin", writeRule: "admin" },
  Material: { name: "Material", readRule: "owner", createRule: "admin", writeRule: "admin" },
  Modificaciones: { name: "Modificaciones", readRule: "owner", createRule: "admin", writeRule: "admin" },
};

export function isValidEntity(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENTITIES, name);
}
