import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostType, ReactionType } from '@prisma/client';
import { PostsService } from './posts.service';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

class CreatePostDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) content: string;
  @ApiPropertyOptional({ enum: PostType }) @IsOptional() @IsEnum(PostType) type?: PostType;
  @ApiProperty() @IsString() @IsNotEmpty() city: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
}

class ReactDto {
  @ApiProperty({ enum: ReactionType }) @IsEnum(ReactionType) type: ReactionType;
}

class AddCommentDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000) content: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string;
}

class SendFriendRequestDto {
  @ApiProperty() @IsString() @IsNotEmpty() receiverId: string;
}

@ApiTags('Feed')
@Controller('feed')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class FeedController {
  constructor(
    private readonly postsService: PostsService,
    private readonly friendsService: FriendsService,
  ) {}

  // ─── Posts ────────────────────────────────────────────────────
  @Public()
  @Get('posts')
  @ApiOperation({ summary: 'List posts with cursor-based pagination' })
  async getPosts(@Query() query: any) {
    return { message: 'Posts retrieved', data: await this.postsService.findAll(query) };
  }

  @Public()
  @Get('posts/:id')
  @ApiOperation({ summary: 'Get post with comments and reactions' })
  async getPost(@Param('id') postId: string) {
    return { message: 'Post retrieved', data: await this.postsService.findOne(postId) };
  }

  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('media', 5))
  @ApiOperation({ summary: 'Create a new post (with optional media)' })
  async createPost(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return { message: 'Post created', data: await this.postsService.create(userId, dto, files) };
  }

  @Patch('posts/:id')
  @ApiOperation({ summary: 'Update your post' })
  async updatePost(
    @Param('id') postId: string,
    @CurrentUser('id') userId: string,
    @Body() body: Partial<CreatePostDto>,
  ) {
    return { message: 'Post updated', data: await this.postsService.update(postId, userId, body) };
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete your post' })
  async deletePost(@Param('id') postId: string, @CurrentUser('id') userId: string) {
    return this.postsService.remove(postId, userId);
  }

  // ─── Reactions ────────────────────────────────────────────────
  @Post('posts/:id/react')
  @ApiOperation({ summary: 'Add or toggle reaction on a post' })
  async reactToPost(
    @Param('id') postId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReactDto,
  ) {
    return this.postsService.reactToPost(postId, userId, dto.type);
  }

  @Delete('posts/:id/react')
  @ApiOperation({ summary: 'Remove reaction from a post' })
  async removeReaction(@Param('id') postId: string, @CurrentUser('id') userId: string) {
    return this.postsService.removeReaction(postId, userId);
  }

  // ─── Comments ─────────────────────────────────────────────────
  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Add a comment (with optional parentId for replies)' })
  async addComment(
    @Param('id') postId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddCommentDto,
  ) {
    return {
      message: 'Comment added',
      data: await this.postsService.addComment(postId, userId, dto.content, dto.parentId),
    };
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete a comment' })
  async deleteComment(@Param('id') commentId: string, @CurrentUser('id') userId: string) {
    return this.postsService.deleteComment(commentId, userId);
  }

  @Post('posts/:id/share')
  @ApiOperation({ summary: 'Increment share count' })
  async sharePost(@Param('id') postId: string) {
    return this.postsService.sharePost(postId);
  }

  // ─── Trending & Suggestions ───────────────────────────────────
  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Get trending hashtags (last 7 days)' })
  async getTrending() {
    return { message: 'Trending hashtags', data: await this.postsService.getTrendingHashtags() };
  }

  @Get('suggested-users')
  @ApiOperation({ summary: 'Get suggested users to connect with' })
  async getSuggestedUsers(@CurrentUser('id') userId: string) {
    return { message: 'Suggested users', data: await this.postsService.getSuggestedUsers(userId) };
  }

  // ─── Friends ──────────────────────────────────────────────────
  @Post('friends/request')
  @ApiOperation({ summary: 'Send a friend request' })
  async sendFriendRequest(@CurrentUser('id') userId: string, @Body() dto: SendFriendRequestDto) {
    return {
      message: 'Friend request sent',
      data: await this.friendsService.sendRequest(userId, dto.receiverId),
    };
  }

  @Post('friends/request/:userId')
  @ApiOperation({ summary: 'Send a friend request to specific target userId' })
  async sendFriendRequestToUser(
    @CurrentUser('id') currentUserId: string,
    @Param('userId') targetUserId: string,
  ) {
    return {
      message: 'Friend request sent',
      data: await this.friendsService.sendRequest(currentUserId, targetUserId),
    };
  }

  @Patch('friends/:id/accept')
  @ApiOperation({ summary: 'Accept a friend request' })
  async acceptRequest(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return { message: 'Friend request accepted', data: await this.friendsService.acceptRequest(id, userId) };
  }

  @Patch('friends/:id/reject')
  @ApiOperation({ summary: 'Reject a friend request' })
  async rejectRequest(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return { message: 'Friend request rejected', data: await this.friendsService.rejectRequest(id, userId) };
  }

  @Delete('friends/:id')
  @ApiOperation({ summary: 'Unfriend' })
  async unfriend(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.friendsService.unfriend(id, userId);
  }

  @Get('friends')
  @ApiOperation({ summary: 'Get friends list with online status' })
  async getFriends(@CurrentUser('id') userId: string) {
    return { message: 'Friends list', data: await this.friendsService.getFriends(userId) };
  }

  @Get('friends/requests')
  @ApiOperation({ summary: 'Get pending friend requests' })
  async getPendingRequests(@CurrentUser('id') userId: string) {
    return { message: 'Pending requests', data: await this.friendsService.getPendingRequests(userId) };
  }

  @Get('friends/suggestions')
  @ApiOperation({ summary: 'Get friend suggestions (mutual friends algorithm)' })
  async getFriendSuggestions(@CurrentUser('id') userId: string) {
    return { message: 'Friend suggestions', data: await this.friendsService.getFriendSuggestions(userId) };
  }
}
