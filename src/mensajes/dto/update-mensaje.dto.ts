import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Body de PATCH /api/mensajes/:id. El panel no edita lo que escribió el visitante:
 * solo lo marca como leído (o no leído) y lo archiva o recupera.
 */
export class UpdateMensajeDto {

    /** true = leído (deja de contar en "sin leer"); false lo vuelve a marcar como nuevo. */
    @IsBoolean()
    @IsOptional()
    leido?: boolean;

    /** false lo archiva (igual que DELETE); true lo recupera. */
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
