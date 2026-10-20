import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PasswordHasher, TokenService } from '@nestjs/authentication';
import { Mailer } from '@nestjs/mail';
import { BienvenidaMail } from '../correo/mails/bienvenida.mail.js';
import { capitalizar } from '../common/utils/texto.utils.js';
import { isValidObjectId, Model } from 'mongoose';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { LoginAuthDto } from './dto/login-auth.dto.js';
import { UpdateAuthDto } from './dto/update-auth.dto.js';
import { Auth } from './entities/auth.entity.js';
import { getMenu } from './menu/menu.config.js';

/**
 * Lógica de usuarios: registro, login y la gestión que hace un ADMIN.
 */
@Injectable()
export class AuthService {

  private readonly logger = new Logger(AuthService.name);

  /**
   * @param userModel      modelo de Mongo de los usuarios
   * @param passwordHasher hashea y verifica contraseñas con scrypt (lo provee @nestjs/authentication)
   * @param tokenService   firma los tokens JWT con la configuración de auth.module.ts
   * @param mailer         envía correos (lo provee @nestjs/mail, configurado en CorreoModule)
   */
  constructor(
    @InjectModel(Auth.name) private readonly userModel: Model<Auth>,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly mailer: Mailer,
  ) { }

  /**
   * Registra un usuario nuevo con rol IGLESIA (el default del esquema) y le inicia sesión.
   *
   * Nombre, apellido y correo se guardan en minúsculas y sin espacios en los extremos,
   * para que "Jose@Mail.cl" y "jose@mail.cl" sean el mismo usuario.
   *
   * @returns el usuario creado (sin password) junto con { accessToken, expiresIn }
   * @throws BadRequestException (400) si ya existe un usuario con ese correo
   */
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

    this.enviarBienvenida(user);

    return { user, ...(await this.getJWT(user)) };
  }

  /**
   * Envía el correo de bienvenida EN SEGUNDO PLANO: no se espera (sin await).
   *
   * Por qué: el Mailer reintenta hasta 3 veces con esperas de hasta 30 segundos. Si se
   * esperara, una caída del servidor de correo haría que el registro tarde o falle, y la
   * cuenta ya quedó creada. Así el registro responde de inmediato y, si el correo falla
   * definitivamente, solo queda el error en el log.
   *
   * idempotencyKey: identifica este correo; si se reenviara, el servidor de correo lo
   * reconoce como el mismo y no llega duplicado.
   */
  private enviarBienvenida(user: Auth) {
    const { name, last_name, email } = user;
    this.mailer
      .send(BienvenidaMail, {
        // Nombre visible del destinatario: "José María Muñoz" (se guarda en minúsculas)
        to: { name: capitalizar(`${name} ${last_name}`), address: email },
        data: { name, last_name, email },
        idempotencyKey: `bienvenida-${user._id.toString()}`,
      })
      .catch((error: unknown) =>
        this.logger.error(`No se pudo enviar la bienvenida a ${email}`, error instanceof Error ? error.stack : error),
      );
  }

  /**
   * Inicia sesión con correo y contraseña.
   *
   * Pasos:
   * 1. Busca el usuario activo por correo, pidiendo explícitamente el hash
   *    (.select('+password'), porque el esquema lo oculta por defecto).
   * 2. Rechaza si no existe o si está bloqueado (3 o más intentos fallidos).
   * 3. Compara la contraseña con el hash. Si falla, suma un intento.
   * 4. Si es correcta: actualiza el hash si usa parámetros viejos, reinicia los
   *    intentos, guarda la fecha de login y genera el token.
   *
   * @returns { user, accessToken, expiresIn, menu } — el menú según sus roles
   * @throws BadRequestException (400) si el correo no existe o el usuario está bloqueado
   * @throws UnauthorizedException (401) si la contraseña es incorrecta
   *
   * Problemas conocidos (ver docs/seguridad.md):
   * - Responder distinto si el correo no existe permite averiguar quién tiene cuenta;
   *   lo recomendable es responder siempre "Invalid credentials".
   * - El chequeo de !user.isActive nunca se cumple, porque la consulta ya filtra isActive: true.
   */
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

    // Bloqueo por intentos fallidos. Hoy solo se desbloquea editando retry en Mongo
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

    // Si algún día se suben los parámetros de scrypt, el hash viejo se reemplaza aquí,
    // aprovechando que en este momento se tiene la contraseña en texto plano
    if (this.passwordHasher.needsRehash(user.password)) {
      user.password = await this.passwordHasher.hash(password);
    }
    user.retry = 0; // login correcto: se reinician los intentos fallidos
    user.update_at_login = new Date();
    await user.save();

    return { user, ...(await this.getJWT(user)), menu: getMenu(user.roles) };
  }

  /** Todos los usuarios activos, sin paginar. */
  findAll() {
    return this.userModel.find({ isActive: true });
  }

  /**
   * Un usuario por id, esté activo o no (el ADMIN necesita ver los desactivados para reactivarlos).
   * @throws BadRequestException (400) si el id no tiene formato de Mongo
   * @throws NotFoundException (404) si no existe
   */
  async findOne(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException(`${id} is not a valid id`);

    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }

  /**
   * Edita un usuario. Solo cambia los campos que vienen en el body.
   * Si viene password, guarda su hash; si vienen roles, reemplaza todos los anteriores.
   * @returns el usuario actualizado
   */
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

  /**
   * Desactiva un usuario (borrado lógico): no puede hacer login y sus tokens dejan
   * de funcionar en el siguiente request (JwtAuth.validate solo acepta activos).
   * Se reactiva con PATCH { "isActive": true }.
   */
  async remove(id: string) {
    // Borrado lógico: el usuario queda inactivo y sus tokens dejan de funcionar
    const user = await this.findOne(id);
    user.isActive = false;
    await user.save();
    return { message: `User ${id} deactivated` };
  }

  /**
   * Firma el token del usuario.
   * @returns { accessToken, expiresIn } — expiresIn en segundos
   */
  private async getJWT(user: Auth) {
    // El "sub" del JWT es el id del usuario; los roles NO van en el token,
    // se leen de la BD en cada request (si cambian, aplican de inmediato)
    return this.tokenService.issue(user._id.toString(), { method: 'password' });
  }
}
