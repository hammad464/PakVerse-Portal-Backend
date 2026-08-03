import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { generateSlug } from '../../common/utils/slug.util';

@Injectable()
export class EducationService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  // ─── Institutes ───────────────────────────────────────────────
  async findAllInstitutes(filter: any) {
    const { search, city, type, page = 1, limit = 20 } = filter;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { specialization: { contains: search, mode: 'insensitive' } },
    ];
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (type) where.type = { equals: type, mode: 'insensitive' };

    const [total, institutes] = await Promise.all([
      this.prisma.institute.count({ where }),
      this.prisma.institute.findMany({
        where,
        select: {
          id: true, name: true, slug: true, type: true, city: true,
          logoUrl: true, bannerUrl: true, tagline: true, specialization: true,
          admissionStatus: true, rating: true, isVerified: true,
          phone: true, email: true, website: true,
          _count: { select: { courses: true, enrollments: true } },
          createdAt: true,
        },
        orderBy: [{ isVerified: 'desc' }, { rating: 'desc' }],
        skip, take: Number(limit),
      }),
    ]);

    return { institutes, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
  }

  async findOneInstitute(idOrSlug: string) {
    const inst = await this.prisma.institute.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        admin: { select: { id: true, fullName: true, avatar: true } },
        courses: true,
        _count: { select: { enrollments: true } },
      },
    });
    if (!inst) throw new NotFoundException('Institute not found');
    return inst;
  }

  async createInstitute(adminId: string, dto: any, logo?: Express.Multer.File, banner?: Express.Multer.File) {
    const slug = generateSlug(dto.name);
    let logoUrl: string | undefined;
    let bannerUrl: string | undefined;
    if (logo) logoUrl = (await this.uploadService.uploadImage(logo, 'pakverse/institutes/logos')).url;
    if (banner) bannerUrl = (await this.uploadService.uploadImage(banner, 'pakverse/institutes/banners')).url;
    return this.prisma.institute.create({ data: { ...dto, slug, adminId, logoUrl, bannerUrl } });
  }

  async updateInstitute(id: string, userId: string, data: any) {
    await this.assertAdmin(id, userId);
    return this.prisma.institute.update({ where: { id }, data });
  }

  // ─── Courses ──────────────────────────────────────────────────
  async getCourses(instituteId: string) {
    return this.prisma.course.findMany({ where: { instituteId }, orderBy: { createdAt: 'desc' } });
  }

  async createCourse(instituteId: string, userId: string, dto: any) {
    await this.assertAdmin(instituteId, userId);
    return this.prisma.course.create({ data: { ...dto, instituteId } });
  }

  // ─── Enrollment ───────────────────────────────────────────────
  async enroll(studentId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { instituteId: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (existing) throw new ConflictException('Already enrolled in this course');

    return this.prisma.enrollment.create({
      data: { studentId, courseId, instituteId: course.instituteId },
    });
  }

  async getStudentDashboard(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { studentId: userId },
      include: {
        course: true,
        institute: {
          select: { id: true, name: true, logoUrl: true, city: true },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  private async assertAdmin(instituteId: string, userId: string) {
    const inst = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { adminId: true },
    });
    if (!inst) throw new NotFoundException('Institute not found');
    if (inst.adminId !== userId) throw new ForbiddenException('Not the institute admin');
  }
}
