import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser, Public } from '@nestjs/authentication';
import { AuthService } from './auth.service.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { LoginAuthDto } from './dto/login-auth.dto.js';
import { UpdateAuthDto } from './dto/update-auth.dto.js';
import { Auth } from './entities/auth.entity.js';
import { Roles } from './decorators/roles.decorator.js';
import { ValidRoles } from './interfaces/role.enum.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.register(createAuthDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.login(loginAuthDto);
  }

  // @Public()
  // Cualquier usuario con token válido
  @Roles()
  @Get('me')
  me(@CurrentUser() user: Auth) {
    return user;
  }

  @Roles(ValidRoles.admin)
  @Get()
  findAll() {
    return this.authService.findAll();
  }

  @Roles(ValidRoles.admin)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authService.findOne(id);
  }

  @Roles(ValidRoles.admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAuthDto: UpdateAuthDto) {
    return this.authService.update(id, updateAuthDto);
  }

  @Roles(ValidRoles.admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authService.remove(id);
  }
}
