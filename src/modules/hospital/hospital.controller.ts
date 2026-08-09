import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AppointmentType, AppointmentStatus } from '@prisma/client';
import { HospitalService } from './hospital.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

class CreateHospitalDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiProperty() @IsString() @IsNotEmpty() description: string;
  @ApiProperty() @IsString() @IsNotEmpty() specialization: string;
  @ApiProperty() @IsString() @IsNotEmpty() city: string;
  @ApiProperty() @IsString() @IsNotEmpty() category: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() bedsCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emergencyService?: boolean;
}

class BookAppointmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() doctorId: string;
  @ApiProperty() @IsString() @IsNotEmpty() hospitalId: string;
  @ApiProperty() @IsString() @IsNotEmpty() date: string;
  @ApiProperty() @IsString() @IsNotEmpty() time: string;
  @ApiProperty() @IsString() @IsNotEmpty() patientName: string;
  @ApiProperty() @IsString() @IsNotEmpty() patientPhone: string;
  @ApiPropertyOptional() @IsOptional() @IsString() patientEmail?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() patientAge?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() patientGender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() symptoms?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(AppointmentType) type?: AppointmentType;
}

class CreatePrescriptionDto {
  @ApiProperty() @IsString() patientId: string;
  @ApiProperty() @IsString() medication: string;
  @ApiProperty() @IsString() dosage: string;
  @ApiProperty() @IsString() frequency: string;
  @ApiProperty() @IsString() duration: string;
  @ApiPropertyOptional() @IsOptional() @IsString() instructions?: string;
}

class HealthMetricDto {
  @ApiProperty() @IsString() metricType: string;
  @ApiProperty() @IsString() value: string;
  @ApiProperty() @IsString() unit: string;
  @ApiProperty() @IsString() status: string;
}

export class UpdateHospitalDto extends PartialType(CreateHospitalDto) {}
export class UpdateAppointmentDto extends PartialType(BookAppointmentDto) {
  @ApiPropertyOptional() @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
}

@ApiTags('Hospital')
@Controller('hospital')
@UseGuards(JwtAuthGuard)
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  // ─── Hospitals ────────────────────────────────────────────────
  @Public() @Get('hospitals')
  @ApiOperation({ summary: 'List hospitals with filters' })
  async findAll(@Query() query: any) {
    return { message: 'Hospitals retrieved', data: await this.hospitalService.findAll(query) };
  }

  @Public() @Get('hospitals/:idOrSlug')
  @ApiOperation({ summary: 'Get hospital detail with doctors' })
  async findOne(@Param('idOrSlug') id: string) {
    return { message: 'Hospital retrieved', data: await this.hospitalService.findOne(id) };
  }

  @Post('hospitals') @ApiBearerAuth('JWT') @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Register a hospital (4-step wizard)' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateHospitalDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return { message: 'Hospital created', data: await this.hospitalService.create(userId, dto, image) };
  }

  @Patch('hospitals/:id') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update hospital' })
  async update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: UpdateHospitalDto) {
    return { message: 'Hospital updated', data: await this.hospitalService.update(id, userId, body) };
  }

  @Public() @Get('hospitals/:id/doctors')
  @ApiOperation({ summary: 'List doctors at a hospital' })
  async getDoctors(@Param('id') id: string) {
    return { message: 'Doctors', data: await this.hospitalService.getDoctors(id) };
  }

  @Public() @Get('hospitals/:id/time-slots')
  @ApiOperation({ summary: 'Get available time slots for a doctor on a date' })
  async getTimeSlots(
    @Param('id') hospitalId: string,
    @Query('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    return { message: 'Time slots', data: await this.hospitalService.getTimeSlots(hospitalId, doctorId, date) };
  }

  // ─── Appointments ─────────────────────────────────────────────
  @Post('appointments') @ApiBearerAuth('JWT') @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Book an appointment (3-step: doctor → date → patient info)' })
  async bookAppointment(@CurrentUser('id') userId: string, @Body() dto: BookAppointmentDto) {
    const data = { ...dto, date: new Date(dto.date) };
    return { message: 'Appointment booked', data: await this.hospitalService.bookAppointment(data) };
  }

  @Patch('appointments/:id') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update/cancel appointment' })
  async updateAppointment(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: UpdateAppointmentDto) {
    return { message: 'Appointment updated', data: await this.hospitalService.updateAppointment(id, userId, body) };
  }

  // ─── Doctor Dashboard ─────────────────────────────────────────
  @Get('doctor-dashboard') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Doctor dashboard: stats, appointments, patients' })
  async getDoctorDashboard(@CurrentUser('id') userId: string) {
    return { message: 'Doctor dashboard', data: await this.hospitalService.getDoctorDashboard(userId) };
  }

  @Post('prescriptions') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a prescription (doctor only)' })
  async createPrescription(@CurrentUser('id') userId: string, @Body() dto: CreatePrescriptionDto) {
    return { message: 'Prescription created', data: await this.hospitalService.createPrescription(userId, dto) };
  }

  // ─── Patient Dashboard ────────────────────────────────────────
  @Get('patient-dashboard') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Patient dashboard: metrics, appointments, history, prescriptions' })
  async getPatientDashboard(@CurrentUser('id') userId: string) {
    return { message: 'Patient dashboard', data: await this.hospitalService.getPatientDashboard(userId) };
  }

  @Post('patient-dashboard/health-metrics') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Log a health metric' })
  async logHealthMetric(@CurrentUser('id') userId: string, @Body() dto: HealthMetricDto) {
    return { message: 'Health metric logged', data: await this.hospitalService.logHealthMetric(userId, dto) };
  }

  @Get('patient-dashboard/health-metrics') @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get health metrics history' })
  async getHealthMetrics(@CurrentUser('id') userId: string) {
    return { message: 'Health metrics', data: await this.hospitalService.getHealthMetrics(userId) };
  }
}
