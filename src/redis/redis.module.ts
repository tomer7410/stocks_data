import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
@Module({
    imports:[
        CacheModule.register({ 
            isGlobal: true,
            store: redisStore,
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
          }),
    ],
    providers: [RedisService]
})
export class RedisModule {}
