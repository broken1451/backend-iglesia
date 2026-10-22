import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PasswordHasher, TokenService } from '@nestjs/authentication';
import { Mailer } from '@nestjs/mail';
import { AuthService, MAX_INTENTOS } from './auth.service.js';
import { Auth } from './entities/auth.entity.js';
import { ValidRoles } from './interfaces/role.enum.js';
import { IglesiasService } from '../iglesias/iglesias.service.js';

/** Id de una iglesia activa (la que acepta el IglesiasService falso). */
const IGLESIA_ID = '64b0000000000000000000aa';

// PasswordHasher real pero barato (logN 10): los tests comparan hashes de verdad sin tardar
const hasher = new PasswordHasher({ logN: 10 });

/** Usuario guardado falso: un objeto con save() y el hash de "Clave1234!". */
const crearUsuario = async (datos: Partial<Auth> = {}) => {
  const user = {
    _id: { toString: () => '64b000000000000000000001' },
    name: 'josé',
    last_name: 'muñoz',
    email: 'jose@iglesia.cl',
    password: await hasher.hash('Clave1234!'),
    roles: [ValidRoles.iglesia],
    iglesia: { _id: IGLESIA_ID } as unknown,
    retry: 0,
    isActive: true,
    ...datos,
    save: vi.fn(),
    populate: vi.fn(),
    // Como un documento de Mongoose: set() cambia el campo
    set(campo: string, valor: unknown) { (this as Record<string, unknown>)[campo] = valor; },
  };
  user.save.mockResolvedValue(user);
  user.populate.mockResolvedValue(user);
  return user;
};

// Modelo de Mongoose falso. findOne().select() devuelve lo que se ponga en `encontrado`
const createModelMock = () => {
  const model = {
    encontrado: null as unknown,
    findOne: vi.fn(() => ({ select: vi.fn(() => Promise.resolve(model.encontrado)) })),
    findById: vi.fn(() => ({ populate: vi.fn(() => Promise.resolve(model.encontrado)) })),
    exists: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({}),
  };
  return model;
};

describe('AuthService', () => {
  let service: AuthService;
  let model: ReturnType<typeof createModelMock>;
  let mailer: { send: ReturnType<typeof vi.fn> };
  // Solo IGLESIA_ID existe y está activa
  const iglesias = { buscarActiva: vi.fn((id: string) => Promise.resolve(id === IGLESIA_ID ? { _id: id } : null)) };

  beforeEach(async () => {
    model = createModelMock();
    mailer = { send: vi.fn().mockResolvedValue({}) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(Auth.name), useValue: model },
        { provide: PasswordHasher, useValue: hasher },
        { provide: TokenService, useValue: { issue: vi.fn().mockResolvedValue({ accessToken: 'token', expiresIn: 28800 }) } },
        { provide: Mailer, useValue: mailer },
        { provide: IglesiasService, useValue: iglesias },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    const credenciales = { email: 'Jose@Iglesia.cl', password: 'Clave1234!' };

    it('con la clave correcta entrega token y menú, y reinicia los intentos', async () => {
      const user = await crearUsuario({ retry: 2 });
      model.encontrado = user;

      const result = await service.login(credenciales);

      expect(model.findOne).toHaveBeenCalledWith({ email: 'jose@iglesia.cl', isActive: true });
      expect(result.accessToken).toBe('token');
      expect(result.menu.map((item) => item.titulo)).toContain('Iglesias');
      expect(user.retry).toBe(0);
      expect(user.save).toHaveBeenCalled();
    });

    it('un correo que no existe responde lo mismo que una clave incorrecta', async () => {
      model.encontrado = null;
      await expect(service.login(credenciales)).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('una clave incorrecta suma un intento de forma atómica', async () => {
      model.encontrado = await crearUsuario();
      await expect(service.login({ ...credenciales, password: 'otra' })).rejects.toThrow(UnauthorizedException);
      expect(model.updateOne).toHaveBeenCalledWith({ _id: expect.anything() }, { $inc: { retry: 1 } });
    });

    it('bloqueado: al dueño (clave correcta) se le avisa con 403', async () => {
      model.encontrado = await crearUsuario({ retry: MAX_INTENTOS });
      await expect(service.login(credenciales)).rejects.toThrow(ForbiddenException);
    });

    it('bloqueado: a quien no sabe la clave no se le revela que la cuenta existe', async () => {
      model.encontrado = await crearUsuario({ retry: MAX_INTENTOS });
      await expect(service.login({ ...credenciales, password: 'otra' })).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
      expect(model.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    const dto = { name: 'José', last_name: 'Muñoz', email: 'Jose@Iglesia.cl', password: 'Clave1234!', iglesia: IGLESIA_ID };

    it('guarda en minúsculas, hashea la clave y envía la bienvenida sin esperarla', async () => {
      model.create.mockImplementation(async (datos: Partial<Auth>) => crearUsuario(datos));

      const { user, accessToken } = await service.register(dto);

      expect(user.email).toBe('jose@iglesia.cl');
      expect(user.name).toBe('josé');
      expect(await hasher.verify('Clave1234!', user.password)).toBe(true);
      expect(accessToken).toBe('token');
      expect(mailer.send).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ to: { name: 'José Muñoz', address: 'jose@iglesia.cl' } }),
      );
    });

    it('si el correo falla, el registro igual responde', async () => {
      model.create.mockImplementation(async (datos: Partial<Auth>) => crearUsuario(datos));
      mailer.send.mockRejectedValue(new Error('SMTP caído'));
      await expect(service.register(dto)).resolves.toHaveProperty('accessToken');
    });

    it('rechaza un correo ya registrado', async () => {
      model.exists.mockResolvedValue({ _id: 'x' });
      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });

    it('dos registros simultáneos: el índice único responde el mismo 400', async () => {
      model.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));
      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('{ unblock: true } desbloquea al usuario', async () => {
      const user = await crearUsuario({ retry: MAX_INTENTOS });
      model.encontrado = user;
      await service.update('64b000000000000000000001', { unblock: true });
      expect(user.retry).toBe(0);
    });

    it('asignar una clave nueva también lo desbloquea', async () => {
      const user = await crearUsuario({ retry: MAX_INTENTOS });
      model.encontrado = user;
      await service.update('64b000000000000000000001', { password: 'Nueva1234!' });
      expect(user.retry).toBe(0);
      expect(await hasher.verify('Nueva1234!', user.password)).toBe(true);
    });

    it('no pisa lo que no se envió', async () => {
      const user = await crearUsuario({ retry: 1 });
      model.encontrado = user;
      await service.update('64b000000000000000000001', { name: 'Pedro' });
      expect(user).toMatchObject({ name: 'pedro', last_name: 'muñoz', isActive: true, retry: 1 });
    });

    it('un correo que ya usa otro usuario responde 400, no 500', async () => {
      const user = await crearUsuario();
      user.save.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));
      model.encontrado = user;
      await expect(service.update('64b000000000000000000001', { email: 'otro@iglesia.cl' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('iglesia asociada (rol IGLESIA)', () => {
    const credenciales = { email: 'jose@iglesia.cl', password: 'Clave1234!' };
    const ID = '64b000000000000000000001';

    it('registro: guarda la iglesia elegida', async () => {
      model.create.mockImplementation(async (datos: Partial<Auth>) => crearUsuario(datos));
      await service.register({ name: 'Ana', last_name: 'Rojas', email: 'ana@t.cl', password: 'Clave1234!', iglesia: IGLESIA_ID });
      expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ iglesia: IGLESIA_ID }));
    });

    it('registro: sin iglesia también se crea (queda en null)', async () => {
      model.create.mockImplementation(async (datos: Partial<Auth>) => crearUsuario(datos));
      await service.register({ name: 'Ana', last_name: 'Rojas', email: 'ana@t.cl', password: 'Clave1234!' });
      expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ iglesia: null }));
      expect(iglesias.buscarActiva).not.toHaveBeenCalledWith(undefined);
    });

    it('registro: rechaza una iglesia que no existe o está desactivada', async () => {
      await expect(
        service.register({ name: 'Ana', last_name: 'Rojas', email: 'ana@t.cl', password: 'Clave1234!', iglesia: '64b0000000000000000000ff' }),
      ).rejects.toThrow('does not exist or is not active');
      expect(model.create).not.toHaveBeenCalled();
    });

    it('login: un IGLESIA sin iglesia recibe 403 y no obtiene token', async () => {
      model.encontrado = await crearUsuario({ iglesia: null });
      await expect(service.login(credenciales)).rejects.toThrow(ForbiddenException);
    });

    it('login: un IGLESIA con su iglesia desactivada también recibe 403', async () => {
      model.encontrado = await crearUsuario({ iglesia: { _id: '64b0000000000000000000ff' } as never });
      await expect(service.login(credenciales)).rejects.toThrow(ForbiddenException);
    });

    it('login: otros roles no necesitan iglesia', async () => {
      model.encontrado = await crearUsuario({ roles: [ValidRoles.distrito], iglesia: null });
      await expect(service.login(credenciales)).resolves.toHaveProperty('accessToken');
    });

    it('editar: asignar una iglesia la valida y la guarda', async () => {
      const user = await crearUsuario({ iglesia: null, roles: [ValidRoles.distrito] });
      model.encontrado = user;
      await service.update(ID, { iglesia: IGLESIA_ID });
      expect(user.iglesia).toBe(IGLESIA_ID);
    });

    it('editar: un IGLESIA sin iglesia se puede editar (el login es el que lo frena)', async () => {
      const user = await crearUsuario({ iglesia: null });
      model.encontrado = user;
      await service.update(ID, { name: 'Ana' });
      expect(user.name).toBe('ana');
    });

    it('editar: { "iglesia": null } quita la iglesia', async () => {
      const user = await crearUsuario();
      model.encontrado = user;
      await service.update(ID, { iglesia: null } as never);
      expect(user.iglesia).toBeNull();
    });
  });
});
