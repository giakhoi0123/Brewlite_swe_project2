import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';
import {
  AuthenticatedUserPayload,
  CreateOrderResult,
  extractAuthenticatedActor,
} from './orders.types';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUserPayload;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Endpoint tạo đơn hàng mới: POST /api/orders
   * - Bảo vệ nghiêm ngặt bằng JwtAuthGuard.
   * - Trích xuất userId từ authenticated user session, tuyệt đối không nhận từ client request body.
   * - Nhận CreateOrderDto đã qua whitelist validation loại bỏ các trường tài chính/trạng thái.
   * - Ủy quyền toàn bộ tính giá, kiểm tra tồn kho, khuyến mãi cho OrdersService.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateOrderDto,
  ): Promise<CreateOrderResult> {
    const actor = extractAuthenticatedActor(request.user);
    return this.ordersService.createOrder(actor.userId, dto);
  }
}
