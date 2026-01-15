import { BadRequestException } from '@nestjs/common';

export class InvalidQueryException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
