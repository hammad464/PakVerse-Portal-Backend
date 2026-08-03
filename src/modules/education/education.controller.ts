import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFiles, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EducationService } from './education.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class CreateInstituteDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiProperty() @IsString() @IsNotEmpty() description: string;
  @ApiProperty() @IsString() @IsNotEmpty() type: string;
  @ApiProperty() @IsString() @IsNotEmpty() city: string;
  @ApiProperty() @IsString() @IsNotEmpty() location: string;
  @ApiProperty() @IsString() @IsNotEmpty() phone: string;
  @ApiProperty() @IsString() @IsNotEmpty() email: string;
  @ApiProperty() @IsString() @IsNotEmpty() specialization: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tagline?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() facilities?: string;
}

class CreateCourseDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() duration?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() fee?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() instructor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() schedule?: string;
}

class EnrollDto {
  @ApiProperty() @IsString() @IsNotEmpty() courseId: string;
}

@ApiTags('Education')
@Controller('education')
@UseGuards(JwtAuthGuard)
export class EducationController {
  constructor(private readonly educationService: EducationService) {}

  @Public() @Get('institutes')
  @ApiOperation({ summary: 'List institutes with filters' })
  async findAll(@Query() query: any) {
    return { message: 'Institutes retrieved', data: await this.educationService.findAllInstitutes(query) };
  }

  @Public() @Get('institutes/:idOrSlug')
  @ApiOperation({ summary: 'Get institute detail with courses' })
  async findOne(@Param('idOrSlug') id: string) {
    return { message: 'Institute retrieved', data: await this.educationService.findOneInstitute(id) };
  }

  @Post('institutes') @ApiBearerAuth('JWT') @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]))
  @ApiOperation({ summary: 'Create institute (5-step wizard)' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInstituteDto,
    @UploadedFiles() files: any,
  ) {
    return { message: 'Institute created', data: await this.educationService.createInstitute(userId, dto, files?.logo?.[0], files?.banner?.[0]) };
  }

  @Patch('institutes/:id') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update institute' })
  async update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: Partial<CreateInstituteDto>) {
    return { message: 'Institute updated', data: await this.educationService.updateInstitute(id, userId, body) };
  }

  @Public() @Get('institutes/:id/courses')
  @ApiOperation({ summary: 'List courses at an institute' })
  async getCourses(@Param('id') id: string) {
    return { message: 'Courses', data: await this.educationService.getCourses(id) };
  }

  @Post('institutes/:id/courses') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Add a course to institute' })
  async createCourse(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: CreateCourseDto) {
    return { message: 'Course added', data: await this.educationService.createCourse(id, userId, dto) };
  }

  @Post('enroll') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Enroll in a course' })
  async enroll(@CurrentUser('id') userId: string, @Body() dto: EnrollDto) {
    return { message: 'Enrolled successfully', data: await this.educationService.enroll(userId, dto.courseId) };
  }

  @Get('dashboard') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Student dashboard: enrollments, grades, progress' })
  async getDashboard(@CurrentUser('id') userId: string) {
    return { message: 'Student dashboard', data: await this.educationService.getStudentDashboard(userId) };
  }
}
