import { Injectable } from '@nestjs/common';
import { CreateIglesiaDto } from './dto/create-iglesia.dto.js';
import { UpdateIglesiaDto } from './dto/update-iglesia.dto.js';

@Injectable()
export class IglesiasService {
  create(createIglesiaDto: CreateIglesiaDto) {
    return 'This action adds a new iglesia';
  }

  findAll() {
    return `This action returns all iglesias`;
  }

  findOne(id: number) {
    return `This action returns a #${id} iglesia`;
  }

  update(id: number, updateIglesiaDto: UpdateIglesiaDto) {
    return `This action updates a #${id} iglesia`;
  }

  remove(id: number) {
    return `This action removes a #${id} iglesia`;
  }
}
