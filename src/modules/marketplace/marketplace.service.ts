import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { ListingStatus, ListingCondition } from '@prisma/client';

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  async findAll(filter: any) {
    const {
      search, city, category, condition, minPrice, maxPrice,
      sortBy = 'createdAt', sortOrder = 'desc',
      page = 1, limit = 20,
    } = filter;

    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { status: ListingStatus.ACTIVE };

    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (condition) where.condition = condition;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    const orderBy: any = { [sortBy]: sortOrder };

    const [total, listings] = await Promise.all([
      this.prisma.marketplaceListing.count({ where }),
      this.prisma.marketplaceListing.findMany({
        where,
        select: {
          id: true, title: true, description: true, price: true,
          category: true, condition: true, city: true, imageUrls: true,
          status: true, viewsCount: true, favoritesCount: true, isFeatured: true,
          seller: { select: { id: true, fullName: true, avatar: true } },
          createdAt: true,
        },
        orderBy,
        skip,
        take: Number(limit),
      }),
    ]);

    return {
      listings,
      pagination: {
        total, page: Number(page), limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async findOne(id: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, fullName: true, avatar: true, phone: true } },
        _count: { select: { inquiries: true } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    // Increment view count
    await this.prisma.marketplaceListing.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    });

    return listing;
  }

  async create(sellerId: string, dto: any, files?: Express.Multer.File[]) {
    let imageUrls: string[] = [];
    if (files?.length) {
      const uploads = await this.uploadService.uploadImages(files, 'pakverse/marketplace');
      imageUrls = uploads.map((u) => u.url);
    }
    return this.prisma.marketplaceListing.create({
      data: { ...dto, sellerId, imageUrls },
    });
  }

  async update(id: string, userId: string, data: any) {
    await this.assertOwner(id, userId);
    return this.prisma.marketplaceListing.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.assertOwner(id, userId);
    await this.prisma.marketplaceListing.delete({ where: { id } });
    return { message: 'Listing removed' };
  }

  async updateStatus(id: string, userId: string, status: ListingStatus) {
    await this.assertOwner(id, userId);
    return this.prisma.marketplaceListing.update({ where: { id }, data: { status } });
  }

  async toggleFavorite(listingId: string) {
    // Simple favorite count increment (no per-user tracking in this schema)
    return this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: { favoritesCount: { increment: 1 } },
    });
  }

  async sendInquiry(listingId: string, senderId: string, message: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      select: { sellerId: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    return this.prisma.inquiry.create({
      data: {
        message,
        senderId,
        receiverId: listing.sellerId,
        listingId,
      },
    });
  }

  async getSellerDashboard(userId: string) {
    const [listings, inquiries, stats] = await Promise.all([
      this.prisma.marketplaceListing.findMany({
        where: { sellerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.inquiry.findMany({
        where: { receiverId: userId },
        include: {
          sender: { select: { id: true, fullName: true, avatar: true } },
          listing: { select: { id: true, title: true, imageUrls: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.marketplaceListing.aggregate({
        where: { sellerId: userId },
        _count: true,
        _sum: { viewsCount: true, favoritesCount: true },
      }),
    ]);

    return { listings, inquiries, stats };
  }

  async getCategories() {
    const result = await this.prisma.marketplaceListing.groupBy({
      by: ['category'],
      where: { status: ListingStatus.ACTIVE },
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
    });
    return result.map((r) => ({ category: r.category, count: r._count.category }));
  }

  async getInquiries(userId: string, type: 'sent' | 'received') {
    return this.prisma.inquiry.findMany({
      where: type === 'sent' ? { senderId: userId } : { receiverId: userId },
      include: {
        sender: { select: { id: true, fullName: true, avatar: true } },
        receiver: { select: { id: true, fullName: true, avatar: true } },
        listing: { select: { id: true, title: true, imageUrls: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async replyToInquiry(inquiryId: string, userId: string, reply: string) {
    const inquiry = await this.prisma.inquiry.findUnique({ where: { id: inquiryId } });
    if (!inquiry || inquiry.receiverId !== userId) {
      throw new ForbiddenException('Not your inquiry');
    }
    return this.prisma.inquiry.update({
      where: { id: inquiryId },
      data: { reply, status: 'REPLIED' },
    });
  }

  private async assertOwner(id: string, userId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
      select: { sellerId: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== userId) throw new ForbiddenException('Not your listing');
  }
}
