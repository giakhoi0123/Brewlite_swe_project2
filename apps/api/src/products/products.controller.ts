import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductDetailResponseDto } from './dto/product-detail-response.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getProducts(
    @Query() query: GetProductsQueryDto,
  ): Promise<ProductResponseDto[]> {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  async getProductById(
    @Param(
      'id',
      new ParseUUIDPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    id: string,
  ): Promise<ProductDetailResponseDto> {
    return this.productsService.findOne(id);
  }
}
