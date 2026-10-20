import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser, Public } from '@nestjs/authentication';
import { AuthService } from './auth.service.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { LoginAuthDto } from './dto/login-auth.dto.js';
import { UpdateAuthDto } from './dto/update-auth.dto.js';
import { Auth } from './entities/auth.entity.js';
import { Roles } from './decorators/roles.decorator.js';
import { ValidRoles } from './interfaces/role.enum.js';

/**
 * Rutas de usuarios: /api/auth
 * - Registro y login: públicos.
 * - /me: cualquier usuario con sesión.
 * - Gestión de usuarios: solo ADMIN.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/register — Crea una cuenta con rol IGLESIA.
   * @returns 201 con { user, accessToken, expiresIn } (queda con sesión iniciada)
   */
  @Public()
  @Post('register')
  register(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.register(createAuthDto);
  }

  /**
   * POST /api/auth/login — Inicia sesión.
   * @HttpCode(200): por defecto un POST responde 201 (creado), pero el login no crea nada.
   * @returns { user, accessToken, expiresIn, menu }
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.login(loginAuthDto);
  }

  /**
   * GET /api/auth/me — Devuelve el usuario dueño del token.
   * @Roles() sin roles = cualquier usuario autenticado. Útil para que el front sepa
   * quién está conectado al recargar la página.
   */
  // @Public()
  // Cualquier usuario con token válido
  @Roles()
  @Get('me')
  me(@CurrentUser() user: Auth) {
    return user;
  }

  /** GET /api/auth — Lista los usuarios activos (solo ADMIN). */
  @Roles(ValidRoles.admin)
  @Get()
  findAll() {
    return this.authService.findAll();
  }

  /** GET /api/auth/:id — Un usuario, activo o no (solo ADMIN). */
  @Roles(ValidRoles.admin)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authService.findOne(id);
  }

  /** PATCH /api/auth/:id — Edita datos, roles o estado de un usuario (solo ADMIN). */
  @Roles(ValidRoles.admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAuthDto: UpdateAuthDto) {
    return this.authService.update(id, updateAuthDto);
  }

  /** DELETE /api/auth/:id — Desactiva un usuario; sus tokens dejan de servir (solo ADMIN). */
  @Roles(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authService.remove(id);
  }
}
