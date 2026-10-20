import { Test, TestingModule } from '@nestjs/testing';
import { IglesiasController } from './iglesias.controller.js';
import { IglesiasService } from './iglesias.service.js';
import { ValidRoles } from '../auth/interfaces/role.enum.js';
import type { Auth } from '../auth/entities/auth.entity.js';

const user = (...roles: ValidRoles[]) => ({ roles }) as unknown as Auth;

describe('IglesiasController', () => {
  let controller: IglesiasController;
  const service = { findAll: vi.fn(), findOne: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IglesiasController],
      providers: [{ provide: IglesiasService, useValue: service }],
    }).compile();

    controller = module.get<IglesiasController>(IglesiasController);
  });

  // El segundo argumento es "puede ver las desactivadas"
  it.each([
    ['visitante sin login', null, false],
    ['COMUNICACIONES (no ve Iglesias en el menú)', user(ValidRoles.comunicaciones), false],
    ['IGLESIA', user(ValidRoles.iglesia), true],
    ['DISTRITO', user(ValidRoles.distrito), true],
    ['ADMIN', user(ValidRoles.admin), true],
  ])('%s -> verInactivas = %s', async (_name, currentUser, expected) => {
    await controller.findAll({}, currentUser);
    await controller.findOne('abc', currentUser);
    expect(service.findAll).toHaveBeenCalledWith({}, expected);
    expect(service.findOne).toHaveBeenCalledWith('abc', expected);
  });
});
