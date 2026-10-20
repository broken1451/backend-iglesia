import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { NoticiasService } from './noticias.service.js';
import { CreateNoticiaDto } from './dto/create-noticia.dto.js';
import { UpdateNoticiaDto } from './dto/update-noticia.dto.js';
import { FindNoticiasDto } from './dto/find-noticias.dto.js';
import { Auth } from '../auth/entities/auth.entity.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ValidRoles } from '../auth/interfaces/role.enum.js';
import { hasMenuAccess, MENU } from '../auth/menu/menu.config.js';
import { OptionalAuth } from '../auth/decorators/optional-auth.decorator.js';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe.js';

/**
 * Rutas de noticias: /api/noticias
 *
 * Aquí solo se decide QUIÉN puede usar cada ruta y QUÉ recibe; la lógica está en NoticiasService.
 */
// Todo el controller: solo los roles que ven "Noticias" en el menú (ADMIN, COMUNICACIONES).
// Excepción: los GET están abiertos al sitio web; los visitantes solo ven las publicadas.
@Roles(...MENU.noticias.roles)
@Controller('noticias')
export class NoticiasController {
  constructor(private readonly noticiasService: NoticiasService) {}

  /**
   * GET /api/noticias — Lista paginada, la más reciente primero.
   * Filtros: ?publicado, ?categoria, ?search, ?limit, ?offset.
   */
  // Visitante (o rol sin acceso a Noticias): solo publicadas.
  // ADMIN / COMUNICACIONES con token: también los borradores, para el panel.
  @OptionalAuth()
  @Get()
  findAll(@Query() query: FindNoticiasDto, @CurrentUser() user: Auth | null) {
    return this.noticiasService.findAll(query, hasMenuAccess(user, 'noticias'));
  }

  /** GET /api/noticias/:id — Una noticia completa. Para visitantes, un borrador responde 404. */
  @OptionalAuth()
  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: string, @CurrentUser() user: Auth | null) {
    return this.noticiasService.findOne(id, hasMenuAccess(user, 'noticias'));
  }

  /**
   * POST /api/noticias — Crea una noticia. El autor es el usuario del token.
   * Sin @Roles propio: aplica el de la clase (COMUNICACIONES y ADMIN).
   */
  // Crear y editar: cualquiera que vea el menú (COMUNICACIONES y ADMIN)
  @Post()
  create(@Body() createNoticiaDto: CreateNoticiaDto, @CurrentUser() user: Auth) {
    return this.noticiasService.create(createNoticiaDto, user);
  }

  /** PATCH /api/noticias/:id — Edita, publica o reactiva una noticia (COMUNICACIONES y ADMIN). */
  @Patch(':id')
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() updateNoticiaDto: UpdateNoticiaDto) {
    return this.noticiasService.update(id, updateNoticiaDto);
  }

  /** DELETE /api/noticias/:id — Desactiva la noticia (borrado lógico). Solo ADMIN. */
  @Roles(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.noticiasService.remove(id);
  }
}
