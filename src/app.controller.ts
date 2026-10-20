import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { AppService } from './app.service.js';

/**
 * Controller raíz de la API (ruta /api).
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /api — Responde "Hello World!".
   * Es público y sirve para comprobar rápidamente que la API está arriba.
   */
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
