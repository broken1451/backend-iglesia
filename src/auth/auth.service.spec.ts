import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PasswordHasher, TokenService } from '@nestjs/authentication';
import { Mailer } from '@nestjs/mail';
import { AuthService, MAX_INTENTOS } from './auth.service.js';
import { Auth } from './entities/auth.entity.js';
import { ValidRoles } from './interfaces/role.enum.js';

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
    retry: 0,
    isActive: true,
    ...datos,
    save: vi.fn(),
  };
  user.save.mockResolvedValue(user);
  return user;
};

// Modelo de Mongoose falso. findOne().select() devuelve lo que se ponga en `encontrado`
const createModelMock = () => {
  const model = {
    encontrado: null as unknown,
    findOne: vi.fn(() => ({ select: vi.fn(() => Promise.resolve(model.encontrado)) })),
    findById: vi.fn(() => Promise.resolve(model.encontrado)),
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
    const dto = { name: 'José', last_name: 'Muñoz', email: 'Jose@Iglesia.cl', password: 'Clave1234!' };

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
});
