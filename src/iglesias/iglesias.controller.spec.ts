import { Test, TestingModule } from '@nestjs/testing';
import { IglesiasController } from './iglesias.controller.js';
import { IglesiasService } from './iglesias.service.js';

describe('IglesiasController', () => {
  let controller: IglesiasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IglesiasController],
      providers: [IglesiasService],
    }).compile();

    controller = module.get<IglesiasController>(IglesiasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
