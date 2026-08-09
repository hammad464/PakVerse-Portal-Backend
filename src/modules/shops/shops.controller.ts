import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { ShopsService } from './shops.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { ShopFilterDto } from './dto/shop-filter.dto';
import { CreateShopProductDto, CreateShopReviewDto } from './dto/shop-product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Shops')
@Controller('shops')
@UseGuards(JwtAuthGuard)
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  // ─── List ──────────────────────────────────────────────────
  @Public()
  @Get()
  @ApiOperation({ summary: 'List shops with filters and pagination' })
  async findAll(@Query() filter: ShopFilterDto) {
    return { message: 'Shops retrieved', data: await this.shopsService.findAll(filter) };
  }

  // ─── Get one ───────────────────────────────────────────────
  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get shop details with products, gallery, reviews' })
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    return { message: 'Shop retrieved', data: await this.shopsService.findOne(idOrSlug) };
  }

  // ─── Create ────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ]),
  )
  @ApiOperation({ summary: 'Create a new shop (6-step wizard support)' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateShopDto,
    @UploadedFiles() files: { logo?: Express.Multer.File[]; banner?: Express.Multer.File[] },
  ) {
    const result = await this.shopsService.create(
      userId,
      dto,
      files?.logo?.[0],
      files?.banner?.[0],
    );
    return { message: 'Shop created successfully', data: result };
  }

  // ─── Update ────────────────────────────────────────────────
  @Patch(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update your shop' })
  async update(
    @Param('id') shopId: string,
    @CurrentUser('id') userId: string,
    @Body() body: Partial<CreateShopDto>,
  ) {
    return { message: 'Shop updated', data: await this.shopsService.update(shopId, userId, body) };
  }

  // ─── Delete ────────────────────────────────────────────────
  @Delete(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Deactivate your shop' })
  async remove(@Param('id') shopId: string, @CurrentUser('id') userId: string) {
    return this.shopsService.remove(shopId, userId);
  }

  // ─── Products ──────────────────────────────────────────────
  @Post(':id/products')
  @ApiBearerAuth('JWT')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Add a product to your shop' })
  async addProduct(
    @Param('id') shopId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateShopProductDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return { message: 'Product added', data: await this.shopsService.addProduct(shopId, userId, dto, image) };
  }

  @Patch(':shopId/products/:productId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update a product' })
  async updateProduct(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @CurrentUser('id') userId: string,
    @Body() body: Partial<CreateShopProductDto>,
  ) {
    return { message: 'Product updated', data: await this.shopsService.updateProduct(shopId, productId, userId, body) };
  }

  @Delete(':shopId/products/:productId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Remove a product' })
  async removeProduct(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.shopsService.removeProduct(shopId, productId, userId);
  }

  // ─── Reviews ───────────────────────────────────────────────
  @Post(':id/reviews')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Submit a review for a shop' })
  async addReview(
    @Param('id') shopId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateShopReviewDto,
  ) {
    return { message: 'Review submitted', data: await this.shopsService.addReview(shopId, userId, dto) };
  }

  // ─── Gallery ───────────────────────────────────────────────
  @Post(':id/gallery')
  @ApiBearerAuth('JWT')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 5))
  @ApiOperation({ summary: 'Add up to 5 images to shop gallery' })
  async addGalleryImages(
    @Param('id') shopId: string,
    @CurrentUser('id') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.shopsService.addGalleryImages(shopId, userId, files);
  }
}
