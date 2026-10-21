import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { MensajesService } from './mensajes.service.js';
import { CreateMensajeDto } from './dto/create-mensaje.dto.js';
import { UpdateMensajeDto } from './dto/update-mensaje.dto.js';
import { FindMensajesDto } from './dto/find-mensajes.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ValidRoles } from '../auth/interfaces/role.enum.js';
import { MENU } from '../auth/menu/menu.config.js';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe.js';

/**
 * Rutas de mensajes del formulario de contacto: /api/mensajes
 *
 * El sitio los envía (público); el panel los lee y los marca.
 */
// Todo el controller: los roles que ven "Mensajes" en el menú. Excepción: POST es público
@Roles(...MENU.mensajes.roles)
@Controller('mensajes')
export class MensajesController {
  constructor(private readonly mensajesService: MensajesService) {}

  /**
   * POST /api/mensajes — El formulario de contacto del sitio. Público, sin token.
   * Responde solo { message: "Mensaje recibido" }.
   */
  @Public()
  @Post()
  create(@Body() createMensajeDto: CreateMensajeDto) {
    return this.mensajesService.create(createMensajeDto);
  }

  /** GET /api/mensajes — Lista paginada, el más nuevo primero. Filtros: ?leido, ?isActive, ?search. */
  @Get()
  findAll(@Query() query: FindMensajesDto) {
    return this.mensajesService.findAll(query);
  }

  /** GET /api/mensajes/:id — Un mensaje. */
  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.mensajesService.findOne(id);
  }

  /** PATCH /api/mensajes/:id — Marcar como leído ({ "leido": true }) o recuperar uno archivado. */
  @Roles(...MENU.mensajes.editan)
  @Patch(':id')
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() updateMensajeDto: UpdateMensajeDto) {
    return this.mensajesService.update(id, updateMensajeDto);
  }

  /** DELETE /api/mensajes/:id — Archiva el mensaje (borrado lógico). Solo ADMIN. */
  @Roles(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.mensajesService.remove(id);
  }
}
