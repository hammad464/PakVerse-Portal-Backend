import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FriendshipStatus } from '@prisma/client';

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        throw new ConflictException('Already friends');
      }
      if (existing.status === FriendshipStatus.PENDING) {
        throw new ConflictException('Friend request already sent');
      }
    }

    return this.prisma.friendship.create({
      data: { senderId, receiverId },
      include: {
        sender: { select: { id: true, fullName: true, avatar: true } },
        receiver: { select: { id: true, fullName: true, avatar: true } },
      },
    });
  }

  async acceptRequest(friendshipId: string, userId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) throw new NotFoundException('Friend request not found');
    if (friendship.receiverId !== userId) {
      throw new BadRequestException('You cannot accept this request');
    }
    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.ACCEPTED },
    });
  }

  async rejectRequest(friendshipId: string, userId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) throw new NotFoundException('Friend request not found');
    if (friendship.receiverId !== userId) {
      throw new BadRequestException('You cannot reject this request');
    }
    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: FriendshipStatus.REJECTED },
    });
  }

  async unfriend(friendshipId: string, userId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship) throw new NotFoundException('Friendship not found');
    if (friendship.senderId !== userId && friendship.receiverId !== userId) {
      throw new BadRequestException('Not your friendship');
    }
    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { message: 'Unfriended successfully' };
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: FriendshipStatus.ACCEPTED,
      },
      include: {
        sender: { select: { id: true, fullName: true, avatar: true, isOnline: true, lastActive: true, city: true } },
        receiver: { select: { id: true, fullName: true, avatar: true, isOnline: true, lastActive: true, city: true } },
      },
    });

    return friendships.map((f) => ({
      friendshipId: f.id,
      friend: f.senderId === userId ? f.receiver : f.sender,
    }));
  }

  async getPendingRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: { receiverId: userId, status: FriendshipStatus.PENDING },
      include: {
        sender: { select: { id: true, fullName: true, avatar: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFriendSuggestions(userId: string) {
    // Users who are friends of friends but not yet connected
    const myFriendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: FriendshipStatus.ACCEPTED,
      },
      select: { senderId: true, receiverId: true },
    });

    const myFriendIds = myFriendships.map((f) =>
      f.senderId === userId ? f.receiverId : f.senderId,
    );

    const suggestions = await this.prisma.user.findMany({
      where: {
        id: { notIn: [userId, ...myFriendIds] },
        OR: [
          { sentFriendRequests: { some: { receiverId: { in: myFriendIds }, status: 'ACCEPTED' } } },
          { receivedFriendRequests: { some: { senderId: { in: myFriendIds }, status: 'ACCEPTED' } } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        avatar: true,
        city: true,
        bio: true,
        _count: { select: { posts: true } },
      },
      take: 10,
    });

    return suggestions;
  }
}
