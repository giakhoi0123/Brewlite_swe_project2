import {
  Controller,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BaristaQueueQueryDto } from './dto/barista-queue-query.dto';
import { CancelBaristaOrderDto } from './dto/cancel-barista-order.dto';
import { OrdersService } from './orders.service';
import {
  AuthenticatedUserPayload,
  BaristaOrderResponse,
  BaristaQueueResult,
  extractAuthenticatedActor,
} from './orders.types';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUserPayload;
}

@Controller('barista/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BARISTA, UserRole.MANAGER)
export class BaristaController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Endpoint đọc hàng đợi đơn hàng phục vụ pha chế:
   * GET /api/barista/orders
   * - Phân quyền RBAC nghiêm ngặt: Chỉ BARISTA và MANAGER được phép truy cập.
   * - CUSTOMER nhận HTTP 403 Forbidden.
   * - Người dùng chưa đăng nhập nhận HTTP 401 Unauthorized.
   * - Mặc định chỉ trả các đơn ở trạng thái: PAID, PREPARING, READY.
   * - Loại trừ hoàn toàn: PENDING, PAYMENT_FAILED, CANCELLED, COMPLETED.
   * - Hỗ trợ phân trang an toàn (page, limit) và sắp xếp tất định FIFO theo thời điểm tạo đơn (createdAt ASC, id ASC).
   * - Trả đủ thông tin sản phẩm, option snapshots và ghi chú pha chế; không trả email, mật khẩu hay tồn kho nội bộ.
   */
  @Get()
  async getQueue(
    @Query() query: BaristaQueueQueryDto,
  ): Promise<BaristaQueueResult> {
    return this.ordersService.getBaristaQueue(query);
  }

  /**
   * Endpoint Barista tiếp nhận đơn và bắt đầu pha chế:
   * POST /api/barista/orders/:id/accept
   * - Chuyển trạng thái: PAID -> PREPARING.
   * - ActorId và role trích xuất 100% từ JWT session đã xác thực (req.user), tuyệt đối không nhận từ body.
   */
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptOrder(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<BaristaOrderResponse> {
    const actor = extractAuthenticatedActor(request.user);
    return this.ordersService.acceptBaristaOrder(id, actor);
  }

  /**
   * Endpoint Barista hoàn tất pha chế món:
   * POST /api/barista/orders/:id/ready
   * - Chuyển trạng thái: PREPARING -> READY.
   * - ActorId và role trích xuất từ JWT session (req.user).
   */
  @Post(':id/ready')
  @HttpCode(HttpStatus.OK)
  async readyOrder(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<BaristaOrderResponse> {
    const actor = extractAuthenticatedActor(request.user);
    return this.ordersService.readyBaristaOrder(id, actor);
  }

  /**
   * Endpoint Barista hoàn tất giao đơn cho khách hàng:
   * POST /api/barista/orders/:id/complete
   * - Chuyển trạng thái: READY -> COMPLETED.
   * - ActorId và role trích xuất từ JWT session (req.user).
   */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async completeOrder(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<BaristaOrderResponse> {
    const actor = extractAuthenticatedActor(request.user);
    return this.ordersService.completeBaristaOrder(id, actor);
  }

  /**
   * Barista confirms cancellation of a paid order before preparation starts.
   * Identity and role always come from the authenticated JWT session.
   */
  @Post(':orderId/cancel')
  @Roles(UserRole.BARISTA)
  @HttpCode(HttpStatus.OK)
  async cancelPaidOrder(
    @Param('orderId') orderId: string,
    @Body() dto: CancelBaristaOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = extractAuthenticatedActor(request.user);
    const result = await this.ordersService.cancelPaidOrderByBarista(
      orderId,
      actor,
      dto.reason,
    );

    return {
      orderId: result.order.id,
      status: result.order.status,
      refund: {
        refundId: result.refund.refundId,
        paymentId: result.refund.paymentId,
        amount: Number(result.refund.amount),
        status: result.refund.status,
      },
      alreadyCancelled: result.alreadyCancelled,
    };
  }
}
