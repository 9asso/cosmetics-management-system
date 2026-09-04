import { Body, Controller, Post } from '@nestjs/common';
import { adjustInventorySchema, type AdjustInventoryInput } from '@cosmetics/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post('adjustments')
  adjust(
    @Body(new ZodValidationPipe(adjustInventorySchema)) input: AdjustInventoryInput,
  ) {
    return this.inventory.adjust(input);
  }
}
