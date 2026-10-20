import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { IglesiasService } from './iglesias.service.js';
import { CreateIglesiaDto } from './dto/create-iglesia.dto.js';
import { UpdateIglesiaDto } from './dto/update-iglesia.dto.js';
import { FindIglesiasDto } from './dto/find-iglesias.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ValidRoles } from '../auth/interfaces/role.enum.js';
import { hasMenuAccess, MENU } from '../auth/menu/menu.config.js';
import { OptionalAuth } from '../auth/decorators/optional-auth.decorator.js';
import { Auth } from '../auth/entities/auth.entity.js';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe.js';
import { CurrentUser, Public } from '@nestjs/authentication';

/**
 * Rutas del directorio de iglesias: /api/iglesias
 *
 * Aquí solo se decide QUIÉN puede usar cada ruta y QUÉ recibe; la lógica está en IglesiasService.
 */
// Todo el controller: solo los roles que ven "Iglesias" en el menú (ADMIN, DISTRITO, IGLESIA).
// Los @Roles de cada método se suman a este (deben cumplirse ambos).
// Excepción: los GET están abiertos al sitio web; los visitantes solo ven las activas.
@Roles(...MENU.iglesias.roles)
@Controller('iglesias')
export class IglesiasController {
  constructor(private readonly iglesiasService: IglesiasService) {}

  /**
   * GET /api/iglesias — Lista paginada. Filtros: ?distrito, ?search, ?isActive, ?limit, ?offset.
   * hasMenuAccess decide si quien consulta puede ver también las desactivadas.
   */
  // Visitante (o rol sin acceso a Iglesias): solo activas.
  // ADMIN / DISTRITO / IGLESIA con token: también las desactivadas, para el panel.
  @OptionalAuth()
  @Get()
  findAll(@Query() query: FindIglesiasDto, @CurrentUser() user: Auth | null) {
    return this.iglesiasService.findAll(query, hasMenuAccess(user, 'iglesias'));
  }

  /**
   * GET /api/iglesias/distritos — Distritos con iglesias activas y cuántas tiene cada uno,
   * para el filtro del sitio. Público: no cambia según quién consulta.
   */
  // Debe ir antes de ':id'; si no, "distritos" se tomaría como un id
  @Public()
  @Get('distritos')
  distritos() {
    return this.iglesiasService.distritos();
  }

  /**
   * GET /api/iglesias/:id — Una iglesia. Para visitantes, una desactivada responde 404.
   */
  @OptionalAuth()
  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: string, @CurrentUser() user: Auth | null) {
    return this.iglesiasService.findOne(id, hasMenuAccess(user, 'iglesias'));
  }

  /**
   * POST /api/iglesias — Crea una iglesia.
   *
   * ⚠ ESTADO ACTUAL: ABIERTO A CUALQUIERA, SIN LOGIN. El @Roles(ValidRoles.distrito) está
   * comentado y @OptionalAuth() anula el @Roles de la clase. Lo previsto (y lo que dice
   * docs/seguridad.md) es que solo DISTRITO y ADMIN puedan crear: para eso, descomentar
   * @Roles(ValidRoles.distrito) y quitar @OptionalAuth().
   */
  // Crear y editar: además, rol DISTRITO (ADMIN siempre pasa)
  // @Roles(ValidRoles.distrito)
  @OptionalAuth()
  @Post()
  create(@Body() createIglesiaDto: CreateIglesiaDto) {
    return this.iglesiasService.create(createIglesiaDto);
  }

  /**
   * PATCH /api/iglesias/:id — Edita una iglesia o la reactiva con { "isActive": true }.
   * Solo DISTRITO (y ADMIN, que pasa siempre).
   */
  @Roles(ValidRoles.distrito)
  @Patch(':id')
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() updateIglesiaDto: UpdateIglesiaDto) {
    return this.iglesiasService.update(id, updateIglesiaDto);
  }

  /**
   * DELETE /api/iglesias/:id — Desactiva la iglesia (borrado lógico). Solo ADMIN.
   */
  @Roles(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.iglesiasService.remove(id);
  }
}
