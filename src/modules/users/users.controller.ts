import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get own profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return { message: 'Profile retrieved', data: await this.usersService.getProfile(userId) };
  }

  @Public()
  @Get('profile/:id')
  @ApiOperation({ summary: 'Get user profile by ID' })
  async getPublicProfile(@Param('id') userId: string) {
    return { message: 'Profile retrieved', data: await this.usersService.getProfile(userId) };
  }

  @Patch('profile')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update own profile' })
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return { message: 'Profile updated', data: await this.usersService.updateProfile(userId, dto) };
  }

  @Patch('avatar')
  @ApiBearerAuth('JWT')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload avatar image' })
  async uploadAvatar(@CurrentUser('id') userId: string, @UploadedFile() file: Express.Multer.File) {
    return { message: 'Avatar updated', data: await this.usersService.uploadAvatar(userId, file) };
  }

  @Patch('cover-photo')
  @ApiBearerAuth('JWT')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload cover photo' })
  async uploadCoverPhoto(@CurrentUser('id') userId: string, @UploadedFile() file: Express.Multer.File) {
    return { message: 'Cover photo updated', data: await this.usersService.uploadCoverPhoto(userId, file) };
  }

  @Public()
  @Get(':id/stats')
  @ApiOperation({ summary: 'Get public user stats' })
  async getUserStats(@Param('id') userId: string) {
    return { message: 'Stats retrieved', data: await this.usersService.getUserStats(userId) };
  }
}
