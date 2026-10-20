import { Transform } from 'class-transformer';

/**
 * Decorador para campos de texto de un DTO: quita los espacios de los extremos
 * y deja uno solo donde había varios. "  Iglesia   Central " → "Iglesia Central".
 *
 * Por qué: los índices únicos de Mongo comparan el texto exacto. Sin esto,
 * "Iglesia Central" e "Iglesia  Central" (dos espacios) se guardarían como dos
 * iglesias distintas. Además, un nombre hecho solo de espacios queda vacío y
 * @IsNotEmpty() lo rechaza.
 *
 * Se ejecuta antes de las validaciones. Si el valor no es texto, lo deja tal cual
 * para que @IsString() lo rechace.
 */
export const NormalizeSpaces = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value));
