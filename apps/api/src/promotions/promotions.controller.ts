import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';
import { PromotionsService } from './promotions.service';

interface RequestWithAuth {
  user?: {
    id?: string;
    sub?: string;
    userId?: string;
  };
  headers?: {
    authorization?: string;
  };
}

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  create(@Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(dto);
  }

  @Get()
  findAllActive(@Req() req: RequestWithAuth) {
    const userId = this.extractUserId(req);
    return this.promotionsService.findAllActive(userId);
  }

  @Post('validate')
  validate(@Body() dto: ValidatePromotionDto, @Req() req: RequestWithAuth) {
    const userId = this.extractUserId(req);
    return this.promotionsService.validateAndCalculateDiscount(
      dto,
      undefined,
      userId,
    );
  }

  private extractUserId(req: RequestWithAuth): string | undefined {
    const fromGuard = req.user?.id || req.user?.sub || req.user?.userId;
    if (fromGuard) {
      return fromGuard;
    }

    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }

    try {
      const token = authHeader.slice(7).trim();
      const payloadPart = token.split('.')[1];
      if (!payloadPart) {
        return undefined;
      }

      const decoded = JSON.parse(
        Buffer.from(payloadPart, 'base64url').toString('utf8'),
      ) as { id?: string; sub?: string; userId?: string };

      return decoded.id || decoded.sub || decoded.userId;
    } catch {
      return undefined;
    }
  }
}