import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { EarnPointsDto } from './dto/earn-points.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('user/:userId')
  getUserLoyaltyInfo(@Param('userId') userId: string) {
    return this.loyaltyService.getUserLoyaltyInfo(userId);
  }

  @Post('earn')
  earnPoints(@Body() dto: EarnPointsDto) {
    return this.loyaltyService.earnPoints(dto);
  }

  @Post('redeem')
  redeemPoints(@Body() dto: RedeemPointsDto) {
    return this.loyaltyService.redeemPoints(dto);
  }
}