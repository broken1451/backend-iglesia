import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ActividadesService } from './actividades.service.js';
import { CreateActividadDto } from './dto/create-actividad.dto.js';
import { UpdateActividadDto } from './dto/update-actividad.dto.js';
import { FindActividadesDto } from './dto/find-actividades.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ValidRoles } from '../auth/interfaces/role.enum.js';
import { hasMenuAccess, MENU } from '../auth/menu/menu.config.js';
import { OptionalAuth } from '../auth/decorators/optional-auth.decorator.js';
import { Auth } from '../auth/entities/auth.entity.js';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe.js';

/**
 * Rutas del calendario de actividades: /api/actividades
 *
 * Aquí solo se decide QUIÉN puede usar cada ruta y QUÉ recibe; la lógica está en ActividadesService.
 */
// Todo el controller: solo los roles que ven "Actividades" en el menú
// (ADMIN, COMUNICACIONES, DISTRITO, IGLESIA). Los @Roles de cada método se suman a este.
// Excepción: los GET están abiertos al sitio web; los visitantes solo ven las activas.
@Roles(...MENU.actividades.roles)
@Controller('actividades')
export class ActividadesController {
  constructor(private readonly actividadesService: ActividadesService) {}

  /**
   * GET /api/actividades — Lista paginada, ordenada por fecha de inicio.
   * Filtros: ?desde, ?hasta, ?distrito, ?search, ?isActive, ?limit, ?offset.
   */
  // Visitante (o rol sin acceso a Actividades): solo activas.
  // ADMIN / COMUNICACIONES / DISTRITO / IGLESIA con token: también las desactivadas, para el panel.
  @OptionalAuth()
  @Get()
  findAll(@Query() query: FindActividadesDto, @CurrentUser() user: Auth | null) {
    return this.actividadesService.findAll(query, hasMenuAccess(user, 'actividades'));
  }

  /** GET /api/actividades/:id — Una actividad. Para visitantes, una desactivada responde 404. */
  @OptionalAuth()
  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: string, @CurrentUser() user: Auth | null) {
    return this.actividadesService.findOne(id, hasMenuAccess(user, 'actividades'));
  }

  /**
   * POST /api/actividades — Crea una actividad.
   * COMUNICACIONES o DISTRITO (y ADMIN). IGLESIA pasa el @Roles de la clase pero no este → 403.
   */
  // Crear y editar: COMUNICACIONES o DISTRITO (ADMIN siempre pasa)
  @Roles(ValidRoles.comunicaciones, ValidRoles.distrito)
  @Post()
  create(@Body() createActividadDto: CreateActividadDto) {
    return this.actividadesService.create(createActividadDto);
  }

  /** PATCH /api/actividades/:id — Edita o reactiva una actividad. COMUNICACIONES o DISTRITO (y ADMIN). */
  @Roles(ValidRoles.comunicaciones, ValidRoles.distrito)
  @Patch(':id')
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() updateActividadDto: UpdateActividadDto) {
    return this.actividadesService.update(id, updateActividadDto);
  }

  /** DELETE /api/actividades/:id — Desactiva la actividad (borrado lógico). Solo ADMIN. */
  @Roles(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.actividadesService.remove(id);
  }
}
