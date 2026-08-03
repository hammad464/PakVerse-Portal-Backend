import { Module, forwardRef } from '@nestjs/common';
import { PostsService } from './posts.service';
import { FriendsService } from './friends.service';
import { FeedController } from './feed.controller';
import { UploadModule } from '../upload/upload.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UploadModule, forwardRef(() => NotificationsModule)],
  controllers: [FeedController],
  providers: [PostsService, FriendsService],
  exports: [PostsService, FriendsService],
})
export class FeedModule {}
