import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  CustomerOrderResponse,
  extractAuthenticatedActor,
} from './orders.types';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUserPayload;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Endpoint tạo đơn hàng mới: POST /api/orders
   * - Bảo vệ nghiêm ngặt bằng JwtAuthGuard.
   * - Trích xuất userId từ authenticated user session (JWT), tuyệt đối không nhận từ client request body.
   * - Nhận CreateOrderDto đã qua whitelist validation loại bỏ các trường tài chính/trạng thái.
   * - Hỗ trợ pointsToRedeem và voucherCode.
   * - Ủy quyền toàn bộ tính giá, kiểm tra tồn kho, khuyến mãi cho OrdersService.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateOrderDto,
  ): Promise<CreateOrderResult> {
    const actor = extractAuthenticatedActor(request.user);
    return this.ordersService.createOrder(actor.userId, dto);
  }

  /**
   * Endpoint tra cứu lịch sử đơn hàng của người dùng hiện tại: GET /api/orders/me
   * - Đặt trước route :id để tránh xung đột pattern matching trong NestJS routing.
   * - Bắt buộc JwtAuthGuard, nguồn danh tính DUY NHẤT là JWT token (request.user).
   * - Tuyệt đối không nhận userId từ query/body/header nhằm chống IDOR triệt để.
   * - Response được bảo vệ quyền riêng tư, không chứa thông tin kho nội bộ.
   */
  @Get('me')
  async getUserOrderHistory(
    @Req() request: AuthenticatedRequest,
  ): Promise<CustomerOrderResponse[]> {
    const actor = extractAuthenticatedActor(request.user);
    return this.ordersService.getUserOrderHistory(actor.userId);
  }

  /**
   * Endpoint xem chi tiết một đơn hàng: GET /api/orders/:id
   * - Bắt buộc JwtAuthGuard, truyền cả orderId và authenticated actor.userId vào getCustomerOrderById.
   * - Chữ ký bắt buộc authenticatedUserId không cho phép optional để chống ownership bypass.
   * - Response được bảo vệ quyền riêng tư, không chứa thông tin kho nội bộ.
   */
  @Get(':id')
  async getOrderById(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CustomerOrderResponse> {
    const actor = extractAuthenticatedActor(request.user);
    return this.ordersService.getCustomerOrderById(id, actor.userId);
  }
}
