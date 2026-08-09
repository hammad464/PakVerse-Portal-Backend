import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
  UploadedFiles, UseInterceptors, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsPositive, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ListingCondition, ListingStatus } from '@prisma/client';
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

class CreateListingDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsString() @IsNotEmpty() description: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @IsPositive() price: number;
  @ApiProperty() @IsString() @IsNotEmpty() category: string;
  @ApiProperty({ enum: ListingCondition }) @IsEnum(ListingCondition) condition: ListingCondition;
  @ApiProperty() @IsString() @IsNotEmpty() city: string;
  @ApiProperty() @IsString() @IsNotEmpty() contactPhone: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() contactEmail?: string;
}

class InquiryDto {
  @ApiProperty() @IsString() @IsNotEmpty() message: string;
}

class ReplyDto {
  @ApiProperty() @IsString() @IsNotEmpty() reply: string;
}

class UpdateStatusDto {
  @ApiProperty({ enum: ListingStatus }) @IsEnum(ListingStatus) status: ListingStatus;
}

@ApiTags('Marketplace')
@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Public() @Get('listings')
  @ApiOperation({ summary: 'List marketplace products with filters' })
  async findAll(@Query() query: any) {
    return { message: 'Listings retrieved', data: await this.marketplaceService.findAll(query) };
  }

  @Public() @Get('categories')
  @ApiOperation({ summary: 'Get categories with listing counts' })
  async getCategories() {
    return { message: 'Categories', data: await this.marketplaceService.getCategories() };
  }

  @Public() @Get('listings/:id')
  @ApiOperation({ summary: 'Get product details' })
  async findOne(@Param('id') id: string) {
    return { message: 'Listing retrieved', data: await this.marketplaceService.findOne(id) };
  }

  @Post('listings') @ApiBearerAuth('JWT') @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('images', 5))
  @ApiOperation({ summary: 'Create a new listing (up to 5 images)' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateListingDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return { message: 'Listing created', data: await this.marketplaceService.create(userId, dto, files) };
  }

  @Patch('listings/:id') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update your listing' })
  async update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: Partial<CreateListingDto>) {
    return { message: 'Listing updated', data: await this.marketplaceService.update(id, userId, body) };
  }

  @Delete('listings/:id') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete your listing' })
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.marketplaceService.remove(id, userId);
  }

  @Patch('listings/:id/status') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark listing as sold/expired/active' })
  async updateStatus(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateStatusDto) {
    return { message: 'Status updated', data: await this.marketplaceService.updateStatus(id, userId, dto.status) };
  }

  @Post('listings/:id/favorite') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Toggle favorite on listing' })
  async toggleFavorite(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return { message: 'Favorite toggled', data: await this.marketplaceService.toggleFavorite(id, userId) };
  }

  @Post('listings/:id/inquire') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Send inquiry message to seller' })
  async sendInquiry(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: InquiryDto) {
    return { message: 'Inquiry sent', data: await this.marketplaceService.sendInquiry(id, userId, dto.message) };
  }

  @Get('dashboard') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Seller dashboard: listings, inquiries, analytics' })
  async getDashboard(@CurrentUser('id') userId: string) {
    return { message: 'Dashboard', data: await this.marketplaceService.getSellerDashboard(userId) };
  }

  @Get('inquiries') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get inquiries (sent or received)' })
  async getInquiries(@CurrentUser('id') userId: string, @Query('type') type: 'sent' | 'received' = 'received') {
    return { message: 'Inquiries', data: await this.marketplaceService.getInquiries(userId, type) };
  }

  @Patch('inquiries/:id/reply') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Reply to an inquiry' })
  async replyToInquiry(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: ReplyDto) {
    return { message: 'Reply sent', data: await this.marketplaceService.replyToInquiry(id, userId, dto.reply) };
  }
}
