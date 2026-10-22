import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PasswordHasher, TokenService } from '@nestjs/authentication';
import { Mailer } from '@nestjs/mail';
import { BienvenidaMail } from '../correo/mails/bienvenida.mail.js';
import { capitalizar } from '../common/utils/texto.utils.js';
import { Model } from 'mongoose';
import { rethrowDuplicate } from '../common/utils/mongo.utils.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { LoginAuthDto } from './dto/login-auth.dto.js';
import { UpdateAuthDto } from './dto/update-auth.dto.js';
import { Auth } from './entities/auth.entity.js';
import { getMenu } from './menu/menu.config.js';
import { ValidRoles } from './interfaces/role.enum.js';
import { IglesiasService } from '../iglesias/iglesias.service.js';

/**
 * Qué datos de la iglesia se incluyen al devolver un usuario: lo que el panel muestra
 * ("La Gran Comisión · Norte · Antofagasta"), no la ficha completa.
 * lean: la trae como objeto simple, sin los campos calculados (ficha, pendientes), que
 * con solo estos 3 campos saldrían mal ("Faltan 5" aunque la ficha esté completa).
 */
const IGLESIA_FIELDS = { path: 'iglesia', select: 'name distrito comuna', options: { lean: true } };

/** Intentos de login fallidos seguidos que bloquean al usuario. */
export const MAX_INTENTOS = 3;

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
   * @param iglesiasService valida la iglesia asociada a un usuario con rol IGLESIA
   */
  constructor(
    @InjectModel(Auth.name) private readonly userModel: Model<Auth>,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly mailer: Mailer,
    private readonly iglesiasService: IglesiasService,
  ) { }

  /**
   * Registra un usuario nuevo con rol IGLESIA (el default del esquema) y le inicia sesión.
   *
   * Nombre, apellido y correo se guardan en minúsculas y sin espacios en los extremos,
   * para que "Jose@Mail.cl" y "jose@mail.cl" sean el mismo usuario.
   *
   * La iglesia es opcional. Si viene, debe existir y estar activa; si no, el usuario se crea
   * sin iglesia y no puede hacer login hasta que un ADMIN se la asigne.
   *
   * @returns el usuario creado (sin password, con su iglesia) junto con { accessToken, expiresIn }
   * @throws BadRequestException (400) si ya existe un usuario con ese correo, o si la iglesia
   *         enviada no existe o está desactivada
   */
  async register(createAuthDto: CreateAuthDto) {

    const email = createAuthDto.email.toLowerCase().trim();

    const userExist = await this.userModel.exists({ email });
    if (userExist) {
      throw new BadRequestException(`The user already exists in the database with the email ${email}`);
    }
    if (createAuthDto.iglesia) await this.validarIglesia(createAuthDto.iglesia);

    const user = await this.userModel
      .create({
        name: createAuthDto.name.toLowerCase().trim(),
        last_name: createAuthDto.last_name.toLowerCase().trim(),
        email,
        // Hash scrypt con salt aleatorio: no se puede revertir (a diferencia de cifrar con AES)
        password: await this.passwordHasher.hash(createAuthDto.password),
        iglesia: createAuthDto.iglesia ?? null,
      })
      // Dos registros simultáneos con el mismo correo pasan el exists() de arriba;
      // el índice único frena al segundo y aquí se convierte en el mismo 400
      .catch((error: unknown) => rethrowDuplicate(error, `The user already exists in the database with the email ${email}`));

    this.enviarBienvenida(user);

    return { user: await user.populate(IGLESIA_FIELDS), ...(await this.getJWT(user)) };
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
   * 2. Compara la contraseña con el hash, aunque el usuario no exista (ver abajo).
   * 3. Rechaza con el mismo 401 si el correo no existe o la contraseña no coincide.
   * 4. Rechaza si está bloqueado (MAX_INTENTOS fallidos seguidos).
   * 5. Con rol IGLESIA, exige que tenga una iglesia asociada y activa.
   * 6. Si es correcta: actualiza el hash si usa parámetros viejos, reinicia los
   *    intentos, guarda la fecha de login y genera el token.
   *
   * Por qué el mismo 401 para "no existe" y "clave incorrecta": si respondiera distinto,
   * cualquiera podría averiguar qué correos tienen cuenta probando de a uno.
   *
   * @returns { user, accessToken, expiresIn, menu } — el menú según sus roles
   * @throws UnauthorizedException (401) si el correo no existe, está desactivado o la contraseña es incorrecta
   * @throws ForbiddenException (403) si está bloqueado por intentos fallidos (lo desbloquea un ADMIN),
   *         o si tiene rol IGLESIA y no tiene una iglesia asociada (o la suya está desactivada)
   */
  async login({ email, password }: LoginAuthDto) {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase().trim(), isActive: true })
      .select('+password');

    // verify() con usuario inexistente (hash undefined) compara contra un hash falso: tarda
    // lo mismo, así el tiempo de respuesta tampoco revela qué correos están registrados
    const valid = await this.passwordHasher.verify(password, user?.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Bloqueo por intentos fallidos. Se revisa después de comparar la clave para que un
    // bloqueado tarde lo mismo; solo se le avisa si la clave es correcta (el dueño real)
    if (user.retry >= MAX_INTENTOS) {
      throw valid
        ? new ForbiddenException('The user is blocked after too many failed attempts; an ADMIN must unblock it')
        : new UnauthorizedException('Invalid credentials');
    }

    if (!valid) {
      // $inc es atómico: dos intentos fallidos simultáneos suman 2, no 1
      await this.userModel.updateOne({ _id: user._id }, { $inc: { retry: 1 } });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Un usuario IGLESIA sin iglesia (o con su iglesia desactivada) no puede entrar: el panel
    // no sabría qué mostrarle. Se revisa con la clave ya verificada, así solo lo sabe el dueño
    await user.populate(IGLESIA_FIELDS);
    if (user.roles.includes(ValidRoles.iglesia)) {
      const iglesia = user.iglesia ? await this.iglesiasService.buscarActiva(String(user.iglesia._id)) : null;
      if (!iglesia) {
        throw new ForbiddenException(
          'Users with the IGLESIA role need an active iglesia; an ADMIN must assign it (PATCH /api/auth/:id { "iglesia": "<id>" })',
        );
      }
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

  /** Todos los usuarios activos, sin paginar, con su iglesia. */
  findAll() {
    return this.userModel.find({ isActive: true }).populate(IGLESIA_FIELDS);
  }

  /**
   * El usuario del token con su iglesia (GET /api/auth/me). El usuario ya viene cargado por
   * JwtAuth; aquí solo se le agregan los datos de la iglesia.
   */
  me(user: Auth) {
    return user.populate(IGLESIA_FIELDS);
  }

  /**
   * Un usuario por id, esté activo o no (el ADMIN necesita ver los desactivados para reactivarlos).
   * El formato del id ya lo validó ParseMongoIdPipe en el controller.
   * @throws NotFoundException (404) si no existe
   */
  async findOne(id: string) {
    const user = await this.userModel.findById(id).populate(IGLESIA_FIELDS);
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }

  /**
   * Edita un usuario. Solo cambia los campos que vienen en el body.
   * Si viene password, guarda su hash; si vienen roles, reemplaza todos los anteriores.
   *
   * Desbloqueo: { "unblock": true } (o asignar una contraseña nueva) reinicia los intentos
   * fallidos, y el usuario puede volver a hacer login.
   *
   * Iglesia: { "iglesia": "<id>" } la asigna o la cambia; { "iglesia": null } la quita. Un
   * usuario IGLESIA sin iglesia se puede guardar, pero no puede hacer login (ver login).
   *
   * @returns el usuario actualizado, con su iglesia
   * @throws BadRequestException (400) si el correo nuevo ya lo usa otro usuario, si la iglesia
   *         no existe o está desactivada
   */
  async update(id: string, updateAuthDto: UpdateAuthDto) {
    const user = await this.findOne(id);
    // Campo por campo: los no enviados llegan como undefined y no deben pisar lo guardado
    const { password, email, name, last_name, roles, isActive, unblock } = updateAuthDto;
    // null = quitar la iglesia (el DTO tipa el campo como string, pero acepta null)
    const iglesia = (updateAuthDto as { iglesia?: string | null }).iglesia;

    if (password) user.password = await this.passwordHasher.hash(password);
    if (email) user.email = email.toLowerCase().trim();
    if (name) user.name = name.toLowerCase().trim();
    if (last_name) user.last_name = last_name.toLowerCase().trim();
    if (roles) user.roles = roles;
    if (isActive !== undefined) user.isActive = isActive;
    if (unblock || password) user.retry = 0;

    if (iglesia) {
      await this.validarIglesia(iglesia);
      user.set('iglesia', iglesia);
    } else if (iglesia === null) {
      user.set('iglesia', null);
    }

    try {
      await user.save();
    } catch (error) {
      rethrowDuplicate(error, `The email ${user.email} is already in use`);
    }
    return user.populate(IGLESIA_FIELDS);
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
   * Revisa que la iglesia exista y esté activa antes de asociarla a un usuario.
   * @throws BadRequestException (400) si no existe o está desactivada
   */
  private async validarIglesia(id: string) {
    if (!(await this.iglesiasService.buscarActiva(id))) {
      throw new BadRequestException(`The iglesia ${id} does not exist or is not active`);
    }
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
