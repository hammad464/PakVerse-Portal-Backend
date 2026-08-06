import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  avatar: true,
  coverPhoto: true,
  bio: true,
  city: true,
  website: true,
  role: true,
  isVerified: true,
  isOnline: true,
  lastActive: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  async getProfile(userId: string, currentUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...PUBLIC_USER_SELECT,
        _count: {
          select: {
            posts: true,
            shops: true,
            sentFriendRequests: { where: { status: 'ACCEPTED' } },
            receivedFriendRequests: { where: { status: 'ACCEPTED' } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    let isFollowing = false;
    if (currentUserId && currentUserId !== userId) {
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: userId },
            { senderId: userId, receiverId: currentUserId },
          ],
        },
      });
      if (friendship) {
        isFollowing = true;
      }
    }

    return { ...user, isFollowing };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: PUBLIC_USER_SELECT,
    });
    return user;
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const { url } = await this.uploadService.uploadImage(file, 'pakverse/avatars');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: url },
      select: PUBLIC_USER_SELECT,
    });
    return user;
  }

  async uploadCoverPhoto(userId: string, file: Express.Multer.File) {
    const { url } = await this.uploadService.uploadImage(file, 'pakverse/covers');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { coverPhoto: url },
      select: PUBLIC_USER_SELECT,
    });
    return user;
  }

  async getUserStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        avatar: true,
        _count: {
          select: {
            posts: true,
            shops: true,
            listings: true,
            enrollments: true,
            sentFriendRequests: { where: { status: 'ACCEPTED' } },
            receivedFriendRequests: { where: { status: 'ACCEPTED' } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
