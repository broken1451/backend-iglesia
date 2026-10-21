import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ResumenService } from './resumen.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Auth } from '../auth/entities/auth.entity.js';

/**
 * Rutas de la pantalla "Resumen" del panel: /api/resumen
 */
@Controller('resumen')
export class ResumenController {
  constructor(private readonly resumenService: ResumenService) {}

  /**
   * GET /api/resumen — Toda la pantalla Resumen del panel en un request: tarjetas de
   * números, "Por hacer", accesos rápidos, actividad reciente y avance por distrito.
   * Cualquier usuario con sesión; cada bloque según su rol (lo que no ve llega como null).
   */
  @Roles()
  @Get()
  resumen(@CurrentUser() user: Auth) {
    return this.resumenService.resumen(user);
  }

  /**
   * GET /api/resumen/por-hacer — Solo el recuadro "Por hacer" (para refrescarlo sin
   * pedir toda la pantalla). Cualquier usuario con sesión; cada uno recibe solo las tareas que su rol
   * puede resolver (un IGLESIA, que todavía no edita nada, recibe la lista vacía).
   */
  @Roles()
  @Get('por-hacer')
  porHacer(@CurrentUser() user: Auth) {
    return this.resumenService.porHacer(user);
  }
}
