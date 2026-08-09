import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { generateSlug } from '../../common/utils/slug.util';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class HospitalService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  // ─── Hospitals ────────────────────────────────────────────────
  async findAll(filter: any) {
    const { search, city, category, specialization, page = 1, limit = 20 } = filter;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { specialization: { contains: search, mode: 'insensitive' } },
    ];
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (specialization) where.specialization = { contains: specialization, mode: 'insensitive' };

    const [total, hospitals] = await Promise.all([
      this.prisma.hospital.count({ where }),
      this.prisma.hospital.findMany({
        where,
        select: {
          id: true, name: true, slug: true, description: true,
          specialization: true, city: true, category: true, imageUrl: true,
          rating: true, doctorsCount: true, bedsCount: true,
          emergencyService: true, admissionStatus: true, phone: true, email: true,
          _count: { select: { doctors: true, appointments: true } },
        },
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
        skip, take: Number(limit),
      }),
    ]);

    return { hospitals, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
  }

  async findOne(idOrSlug: string) {
    const hospital = await this.prisma.hospital.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        doctors: {
          include: { user: { select: { id: true, fullName: true, avatar: true } } },
          where: { isAvailable: true },
        },
        admin: { select: { id: true, fullName: true } },
        _count: { select: { appointments: true } },
      },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');
    return hospital;
  }

  async create(adminId: string, dto: any, image?: Express.Multer.File) {
    const slug = generateSlug(dto.name);
    let imageUrl: string | undefined;
    if (image) imageUrl = (await this.uploadService.uploadImage(image, 'pakverse/hospitals')).url;
    return this.prisma.hospital.create({ data: { ...dto, slug, adminId, imageUrl } });
  }

  async update(id: string, userId: string, data: any) {
    await this.assertAdmin(id, userId);
    return this.prisma.hospital.update({ where: { id }, data });
  }

  // ─── Doctors ──────────────────────────────────────────────────
  async getDoctors(hospitalId: string) {
    return this.prisma.doctor.findMany({
      where: { hospitalId },
      include: { user: { select: { id: true, fullName: true, avatar: true } } },
    });
  }

  async createDoctorProfile(userId: string, dto: any) {
    return this.prisma.doctor.create({ data: { ...dto, userId } });
  }

  // ─── Time Slots ───────────────────────────────────────────────
  async getTimeSlots(hospitalId: string, doctorId: string, date: string) {
    const allSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    ];

    const booked = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        hospitalId,
        date: new Date(date),
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      select: { time: true },
    });

    const bookedTimes = new Set(booked.map((a) => a.time));
    return allSlots.map((time) => ({
      time,
      available: !bookedTimes.has(time),
    }));
  }

  // ─── Appointments ─────────────────────────────────────────────
  async bookAppointment(dto: any) {
    return this.prisma.appointment.create({ data: dto });
  }

  async updateAppointment(id: string, userId: string, data: any) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, patient: true, hospital: true },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    const isDoctor = appt.doctor.userId === userId;
    const isPatient = appt.patient?.userId === userId;
    const isAdmin = appt.hospital.adminId === userId;

    if (!isDoctor && !isPatient && !isAdmin) {
      throw new ForbiddenException('Not authorized to update this appointment');
    }

    return this.prisma.appointment.update({ where: { id }, data });
  }

  // ─── Doctor Dashboard ─────────────────────────────────────────
  async getDoctorDashboard(userId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayAppointments, allAppointments, patients, stats] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { doctorId: doctor.id, date: { gte: today, lt: tomorrow } },
        include: { patient: { include: { user: { select: { fullName: true, avatar: true } } } } },
        orderBy: { time: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: { doctorId: doctor.id },
        orderBy: { date: 'desc' },
        take: 20,
      }),
      this.prisma.prescription.findMany({
        where: { doctorId: doctor.id },
        include: { patient: { include: { user: { select: { id: true, fullName: true, avatar: true } } } } },
        distinct: ['patientId'],
        take: 20,
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { doctorId: doctor.id },
        _count: true,
      }),
    ]);

    return { doctor, todayAppointments, allAppointments, patients, stats };
  }

  // ─── Patient Dashboard ────────────────────────────────────────
  async getPatientDashboard(userId: string) {
    let patient = await this.prisma.patient.findUnique({ where: { userId } });

    if (!patient) {
      // Auto-create patient profile
      patient = await this.prisma.patient.create({ data: { userId, allergies: [] } });
    }

    const [appointments, prescriptions, medicalRecords, healthMetrics] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { patientId: patient.id },
        include: {
          doctor: { include: { user: { select: { fullName: true, avatar: true } } } },
          hospital: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      this.prisma.prescription.findMany({
        where: { patientId: patient.id, isActive: true },
        include: { doctor: { include: { user: { select: { fullName: true } } } } },
      }),
      this.prisma.medicalRecord.findMany({
        where: { patientId: patient.id },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      this.prisma.healthMetric.findMany({
        where: { patientId: patient.id },
        orderBy: { recordedAt: 'desc' },
        take: 20,
      }),
    ]);

    return { patient, appointments, prescriptions, medicalRecords, healthMetrics };
  }

  async createPrescription(doctorUserId: string, dto: any) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    return this.prisma.prescription.create({ data: { ...dto, doctorId: doctor.id } });
  }

  async logHealthMetric(userId: string, dto: any) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new NotFoundException('Patient profile not found');
    return this.prisma.healthMetric.create({ data: { ...dto, patientId: patient.id } });
  }

  async getHealthMetrics(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return [];
    return this.prisma.healthMetric.findMany({
      where: { patientId: patient.id },
      orderBy: { recordedAt: 'desc' },
    });
  }

  private async assertAdmin(hospitalId: string, userId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { adminId: true },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');
    if (hospital.adminId !== userId) throw new ForbiddenException('Not the hospital admin');
  }
}
