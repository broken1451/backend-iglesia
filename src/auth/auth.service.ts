import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PasswordHasher, TokenService } from '@nestjs/authentication';
import { isValidObjectId, Model } from 'mongoose';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { LoginAuthDto } from './dto/login-auth.dto.js';
import { UpdateAuthDto } from './dto/update-auth.dto.js';
import { Auth } from './entities/auth.entity.js';

@Injectable()
export class AuthService {

  constructor(
    @InjectModel(Auth.name) private readonly userModel: Model<Auth>,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) { }

  async register(createAuthDto: CreateAuthDto) {

    const email = createAuthDto.email.toLowerCase().trim();

    const userExist = await this.userModel.exists({ email });
    if (userExist) {
      throw new BadRequestException(`The user already exists in the database with the email ${email}`);
    }

    const user = await this.userModel.create({
      name: createAuthDto.name.toLowerCase().trim(),
      last_name: createAuthDto.last_name.toLowerCase().trim(),
      email,
      // Hash scrypt con salt aleatorio: no se puede revertir (a diferencia de cifrar con AES)
      password: await this.passwordHasher.hash(createAuthDto.password),
    });

    return { user, ...(await this.getJWT(user)) };
  }

  async login({ email, password }: LoginAuthDto) {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase().trim(), isActive: true })
      .select('+password');


    if (!user) {
      throw new BadRequestException(`The user with the email ${email} does not exist`);
    }

    if (!user.isActive) {
      throw new BadRequestException(`The user with the email ${email} is not active`);
    }

    if (user.retry >= 3) {
      throw new BadRequestException(`The user with the email ${email} is blocked`);
    }


    // verify() con usuario inexistente compara contra un hash falso, así el tiempo
    // de respuesta no revela qué correos están registrados
    const valid = await this.passwordHasher.verify(password, user?.password);
    if (!user || !valid) {
      user.retry = user.retry + 1;
      await user.save();
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.passwordHasher.needsRehash(user.password)) {
      user.password = await this.passwordHasher.hash(password);
    }
    user.update_at_login = new Date();
    await user.save();

    return { user, ...(await this.getJWT(user)), menu: this.obtenerMenu(user.roles) };
  }

  findAll() {
    return this.userModel.find({ isActive: true });
  }

  async findOne(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException(`${id} is not a valid id`);

    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }

  async update(id: string, updateAuthDto: UpdateAuthDto) {
    const user = await this.findOne(id);
    // Campo por campo: los no enviados llegan como undefined y no deben pisar lo guardado
    const { password, email, name, last_name, roles, isActive } = updateAuthDto;

    if (password) user.password = await this.passwordHasher.hash(password);
    if (email) user.email = email.toLowerCase().trim();
    if (name) user.name = name.toLowerCase().trim();
    if (last_name) user.last_name = last_name.toLowerCase().trim();
    if (roles) user.roles = roles;
    if (isActive !== undefined) user.isActive = isActive;

    return user.save();
  }

  async remove(id: string) {
    // Borrado lógico: el usuario queda inactivo y sus tokens dejan de funcionar
    const user = await this.findOne(id);
    user.isActive = false;
    await user.save();
    return { message: `User ${id} deactivated` };
  }

  private async getJWT(user: Auth) {
    // El "sub" del JWT es el id del usuario; los roles NO van en el token,
    // se leen de la BD en cada request (si cambian, aplican de inmediato)
    return this.tokenService.issue(user._id.toString(), { method: 'password' });
  }

  obtenerMenu(roles: string[]) {
    let menu: any[] = [];
    switch (true) {
      case roles.includes('ADMIN'):
        menu =  [
           { titulo: 'Resumen', icono: 'grafico' },
           { titulo: 'Iglesias', icono: 'templo' },
           { titulo: 'Noticias', icono: 'diario' },
           { titulo: 'Actividades', icono: 'calendario' },
           { titulo: 'Devocional', icono: 'libro' },
           { titulo: 'Proyectos', icono: 'semilla' },
           { titulo: 'Directiva', icono: 'usuarios' },
           { titulo: 'Mensajes', icono: 'bandeja' },
           { titulo: 'Usuarios y roles', icono: 'llave' },
           { titulo: 'Configuración', icono: 'ajustes' }
        ];
        return menu;
      case roles.includes('COMUNICACIONES'):
        menu =  [
           { titulo: 'Resumen', icono: 'grafico' },
           { titulo: 'Noticias', icono: 'diario' },
           { titulo: 'Actividades', icono: 'calendario' },
           { titulo: 'Devocional', icono: 'libro' },
           { titulo: 'Proyectos', icono: 'semilla' },
           { titulo: 'Mensajes', icono: 'bandeja' },
           { titulo: 'Configuración', icono: 'ajustes' }
        ];
        return menu;
      case roles.includes('DISTRITO') || roles.includes('IGLESIA'):
        menu =  [
           { titulo: 'Resumen', icono: 'grafico' },
           { titulo: 'Iglesias', icono: 'templo' },
           { titulo: 'Actividades', icono: 'calendario' },
           { titulo: 'Mensajes', icono: 'bandeja' },

        ];
        return menu;
    }
    return menu;
  }
}
