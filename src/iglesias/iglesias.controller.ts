import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { IglesiasService } from './iglesias.service.js';
import { CreateIglesiaDto } from './dto/create-iglesia.dto.js';
import { UpdateIglesiaDto } from './dto/update-iglesia.dto.js';

@Controller('iglesias')
export class IglesiasController {
  constructor(private readonly iglesiasService: IglesiasService) {}

  @Post()
  create(@Body() createIglesiaDto: CreateIglesiaDto) {
    return this.iglesiasService.create(createIglesiaDto);
  }

  @Get()
  findAll() {
    return this.iglesiasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.iglesiasService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateIglesiaDto: UpdateIglesiaDto) {
    return this.iglesiasService.update(+id, updateIglesiaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.iglesiasService.remove(+id);
  }
}
