import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShopType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ShopFilterDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ShopType })
  @IsOptional()
  @IsEnum(ShopType)
  shopType?: ShopType;
}
