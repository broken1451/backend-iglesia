import { Module } from '@nestjs/common';
import { IglesiasService } from './iglesias.service.js';
import { IglesiasController } from './iglesias.controller.js';

@Module({
  controllers: [IglesiasController],
  providers: [IglesiasService],
})
export class IglesiasModule {}
