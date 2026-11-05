import { Controller, Get, Post, Body } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  create(@Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(dto);
  }

  @Get()
  findAllActive() {
    return this.promotionsService.findAllActive();
  }

  @Post('validate')
  validate(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validateAndCalculateDiscount(dto);
  }
}