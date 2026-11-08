import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Get('me')
  getUserOrderHistory(@Query('userId') userId: string) {
    return this.ordersService.getUserOrderHistory(userId);
  }

  @Get(':id')
  getOrderById(@Param('id') id: string, @Query('userId') userId: string) {
    return this.ordersService.getOrderById(id, userId);
  }

  @Patch(':id/status')
  updateOrderStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateOrderStatus(id, dto);
  }
}