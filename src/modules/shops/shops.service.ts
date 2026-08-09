import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { ShopFilterDto } from './dto/shop-filter.dto';
import { CreateShopProductDto, CreateShopReviewDto } from './dto/shop-product.dto';
import { generateSlug } from '../../common/utils/slug.util';
import { PartialType } from '@nestjs/mapped-types';

const SHOP_LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  shopType: true,
  city: true,
  categories: true,
  logoUrl: true,
  bannerUrl: true,
  rating: true,
  totalReviews: true,
  isActive: true,
  whatsappNumber: true,
  phone: true,
  owner: { select: { id: true, fullName: true, avatar: true } },
  _count: { select: { products: true, gallery: true } },
  createdAt: true,
};

const SHOP_DETAIL_SELECT = {
  ...SHOP_LIST_SELECT,
  facebookUrl: true,
  instagramHandle: true,
  websiteUrl: true,
  email: true,
  products: {
    where: { isActive: true },
    orderBy: { createdAt: 'desc' as const },
  },
  gallery: { orderBy: { createdAt: 'desc' as const } },
  reviews: { orderBy: { createdAt: 'desc' as const }, take: 20 },
};

@Injectable()
export class ShopsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  // ─── List shops ───────────────────────────────────────────────
  async findAll(filter: ShopFilterDto) {
    const { search, city, category, shopType, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (category) where.categories = { has: category };
    if (shopType) where.shopType = shopType;

    const [total, shops] = await Promise.all([
      this.prisma.shop.count({ where }),
      this.prisma.shop.findMany({
        where,
        select: SHOP_LIST_SELECT,
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      shops,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  // ─── Get single shop ──────────────────────────────────────────
  async findOne(idOrSlug: string) {
    const shop = await this.prisma.shop.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        isActive: true,
      },
      select: SHOP_DETAIL_SELECT,
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  // ─── Create shop ──────────────────────────────────────────────
  async create(
    ownerId: string,
    dto: CreateShopDto,
    logo?: Express.Multer.File,
    banner?: Express.Multer.File,
  ) {
    const slug = generateSlug(dto.name);
    let logoUrl: string | undefined;
    let bannerUrl: string | undefined;

    if (logo) {
      const r = await this.uploadService.uploadImage(logo, 'pakverse/shops/logos');
      logoUrl = r.url;
    }
    if (banner) {
      const r = await this.uploadService.uploadImage(banner, 'pakverse/shops/banners');
      bannerUrl = r.url;
    }

    const shop = await this.prisma.shop.create({
      data: { ...dto, slug, ownerId, logoUrl, bannerUrl },
      select: SHOP_DETAIL_SELECT,
    });

    return shop;
  }

  // ─── Update shop ──────────────────────────────────────────────
  async update(shopId: string, userId: string, data: Partial<CreateShopDto>) {
    await this.assertOwner(shopId, userId);
    return this.prisma.shop.update({
      where: { id: shopId },
      data,
      select: SHOP_LIST_SELECT,
    });
  }

  // ─── Delete shop (soft) ───────────────────────────────────────
  async remove(shopId: string, userId: string) {
    await this.assertOwner(shopId, userId);
    await this.prisma.shop.update({
      where: { id: shopId },
      data: { isActive: false },
    });
    return { message: 'Shop deactivated successfully' };
  }

  // ─── Products ─────────────────────────────────────────────────
  async addProduct(
    shopId: string,
    userId: string,
    dto: CreateShopProductDto,
    image?: Express.Multer.File,
  ) {
    await this.assertOwner(shopId, userId);
    let imageUrl: string | undefined;
    if (image) {
      const r = await this.uploadService.uploadImage(image, 'pakverse/shops/products');
      imageUrl = r.url;
    }
    return this.prisma.shopProduct.create({
      data: { ...dto, shopId, imageUrl },
    });
  }

  async updateProduct(
    shopId: string,
    productId: string,
    userId: string,
    data: Partial<CreateShopProductDto>,
  ) {
    await this.assertOwner(shopId, userId);
    const product = await this.prisma.shopProduct.findUnique({ where: { id: productId } });
    if (!product || product.shopId !== shopId) {
      throw new NotFoundException('Product not found in this shop');
    }
    return this.prisma.shopProduct.update({
      where: { id: productId },
      data,
    });
  }

  async removeProduct(shopId: string, productId: string, userId: string) {
    await this.assertOwner(shopId, userId);
    const product = await this.prisma.shopProduct.findUnique({ where: { id: productId } });
    if (!product || product.shopId !== shopId) {
      throw new NotFoundException('Product not found in this shop');
    }
    await this.prisma.shopProduct.update({
      where: { id: productId },
      data: { isActive: false },
    });
    return { message: 'Product removed' };
  }

  // ─── Reviews ──────────────────────────────────────────────────
  async addReview(shopId: string, userId: string, dto: CreateShopReviewDto) {
    const review = await this.prisma.shopReview.create({
      data: { ...dto, shopId, reviewerId: userId },
    });

    // Update shop rating
    const stats = await this.prisma.shopReview.aggregate({
      where: { shopId },
      _avg: { rating: true },
      _count: true,
    });

    await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        rating: Math.round((stats._avg.rating ?? 0) * 10) / 10,
        totalReviews: stats._count,
      },
    });

    return review;
  }

  // ─── Gallery ──────────────────────────────────────────────────
  async addGalleryImages(
    shopId: string,
    userId: string,
    files: Express.Multer.File[],
  ) {
    await this.assertOwner(shopId, userId);
    const uploads = await this.uploadService.uploadImages(files, 'pakverse/shops/gallery');
    const images = await this.prisma.shopGalleryImage.createMany({
      data: uploads.map((u) => ({ shopId, imageUrl: u.url })),
    });
    return { count: images.count, message: `${images.count} images added to gallery` };
  }

  // ─── Helper ───────────────────────────────────────────────────
  private async assertOwner(shopId: string, userId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { ownerId: true },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    if (shop.ownerId !== userId) {
      throw new ForbiddenException('You do not own this shop');
    }
  }
}
