import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PostType, ReactionType, FriendshipStatus } from '@prisma/client';

const POST_SELECT = {
  id: true,
  content: true,
  type: true,
  city: true,
  location: true,
  hashtags: true,
  mediaUrls: true,
  likesCount: true,
  commentsCount: true,
  sharesCount: true,
  author: { select: { id: true, fullName: true, avatar: true, city: true } },
  reactions: { take: 5, select: { type: true, user: { select: { id: true, fullName: true, avatar: true } } } },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(filter: any) {
    const { search, city, type, authorId, cursor, limit = 20 } = filter;

    const where: any = {};
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (type) where.type = type;
    if (authorId) where.authorId = authorId;
    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { hashtags: { has: search } },
      ];
    }

    const take = Number(limit) + 1;
    const cursorObj = cursor ? { id: cursor } : undefined;

    const posts = await this.prisma.post.findMany({
      where,
      select: POST_SELECT,
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursorObj && { cursor: cursorObj, skip: 1 }),
    });

    const hasNextPage = posts.length > Number(limit);
    const data = hasNextPage ? posts.slice(0, -1) : posts;
    const nextCursor = hasNextPage ? data[data.length - 1]?.id : null;

    return { posts: data, nextCursor, hasNextPage };
  }

  async findOne(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, fullName: true, avatar: true } },
        reactions: {
          select: { type: true, user: { select: { id: true, fullName: true, avatar: true } } },
        },
        comments: {
          where: { parentId: null },
          include: {
            author: { select: { id: true, fullName: true, avatar: true } },
            replies: {
              include: { author: { select: { id: true, fullName: true, avatar: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(
    authorId: string,
    dto: {
      content: string;
      type?: PostType;
      city: string;
      location?: string;
      hashtags?: string[];
    },
    files?: Express.Multer.File[],
  ) {
    let mediaUrls: string[] = [];

    if (files && files.length > 0) {
      const uploads = await this.uploadService.uploadImages(files, 'pakverse/posts');
      mediaUrls = uploads.map((u) => u.url);
    }

    // Extract hashtags from content if not explicitly provided
    const hashtags = dto.hashtags ??
      (dto.content.match(/#\w+/g)?.map((h) => h.toLowerCase()) ?? []);

    return this.prisma.post.create({
      data: {
        content: dto.content,
        type: dto.type ?? PostType.POST,
        city: dto.city,
        location: dto.location,
        hashtags,
        mediaUrls,
        authorId,
      },
      select: POST_SELECT,
    });
  }

  async update(postId: string, userId: string, data: Partial<{ content: string; city: string }>) {
    await this.assertAuthor(postId, userId);
    return this.prisma.post.update({ where: { id: postId }, data, select: POST_SELECT });
  }

  async remove(postId: string, userId: string) {
    await this.assertAuthor(postId, userId);
    await this.prisma.post.delete({ where: { id: postId } });
    return { message: 'Post deleted' };
  }

  // ─── Reactions ────────────────────────────────────────────────
  async reactToPost(postId: string, userId: string, reactionType: ReactionType) {
    const existing = await this.prisma.reaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      if (existing.type === reactionType) {
        // Remove reaction (toggle off)
        await this.prisma.reaction.delete({
          where: { userId_postId: { userId, postId } },
        });
        await this.prisma.post.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
        });
        return { message: 'Reaction removed' };
      } else {
        // Change reaction
        await this.prisma.reaction.update({
          where: { userId_postId: { userId, postId } },
          data: { type: reactionType },
        });
        return { message: 'Reaction updated' };
      }
    }

    await this.prisma.reaction.create({ data: { userId, postId, type: reactionType } });
    await this.prisma.post.update({
      where: { id: postId },
      data: { likesCount: { increment: 1 } },
    });

    return { message: 'Reaction added' };
  }

  async removeReaction(postId: string, userId: string) {
    const existing = await this.prisma.reaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) {
      await this.prisma.reaction.delete({ where: { userId_postId: { userId, postId } } });
      await this.prisma.post.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
      });
    }
    return { message: 'Reaction removed' };
  }

  // ─── Comments ─────────────────────────────────────────────────
  async addComment(
    postId: string,
    authorId: string,
    content: string,
    parentId?: string,
  ) {
    const comment = await this.prisma.comment.create({
      data: { content, postId, authorId, parentId },
      include: { author: { select: { id: true, fullName: true, avatar: true } } },
    });

    await this.prisma.post.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
    });

    return comment;
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, postId: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) throw new ForbiddenException('Not your comment');

    await this.prisma.comment.delete({ where: { id: commentId } });
    await this.prisma.post.update({
      where: { id: comment.postId },
      data: { commentsCount: { decrement: 1 } },
    });

    return { message: 'Comment deleted' };
  }

  // ─── Trending hashtags ────────────────────────────────────────
  async getTrendingHashtags() {
    const posts = await this.prisma.post.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { hashtags: true },
    });

    const hashtagCounts: Record<string, number> = {};
    for (const post of posts) {
      for (const tag of post.hashtags) {
        hashtagCounts[tag] = (hashtagCounts[tag] ?? 0) + 1;
      }
    }

    return Object.entries(hashtagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
  }

  // ─── Suggested users ──────────────────────────────────────────
  async getSuggestedUsers(userId: string) {
    return this.prisma.user.findMany({
      where: {
        id: { not: userId },
        sentFriendRequests: {
          none: { receiverId: userId },
        },
        receivedFriendRequests: {
          none: { senderId: userId },
        },
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
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Share ────────────────────────────────────────────────────
  async sharePost(postId: string) {
    await this.prisma.post.update({
      where: { id: postId },
      data: { sharesCount: { increment: 1 } },
    });
    return { message: 'Share count incremented' };
  }

  private async assertAuthor(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) throw new ForbiddenException('Not your post');
  }
}
