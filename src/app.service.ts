import { Injectable } from '@nestjs/common';

/**
 * Servicio raíz. Solo da la respuesta del chequeo de salud GET /api.
 */
@Injectable()
export class AppService {
  /** Texto fijo que confirma que la API responde. */
  getHello(): string {
    return 'Hello World!';
  }
}
