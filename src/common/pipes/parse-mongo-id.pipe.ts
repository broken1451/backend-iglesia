import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

/**
 * Valida que un parámetro de ruta sea un ObjectId de Mongo antes de llegar al controller.
 *
 * Uso: `@Param('id', ParseMongoIdPipe) id: string`
 *
 * Por qué: sin esto, un id como "abc" llega a Mongo, que lanza un error de conversión
 * y la API respondería 500. Con el pipe responde 400 con un mensaje claro y ni
 * siquiera se consulta la base.
 */
@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string, string> {
  /**
   * @param value el valor tal como viene en la URL
   * @returns el mismo valor, si es un id válido
   * @throws BadRequestException (400) si no tiene formato de ObjectId
   */
  transform(value: string): string {
    if (!isValidObjectId(value)) throw new BadRequestException(`${value} is not a valid id`);
    return value;
  }
}
