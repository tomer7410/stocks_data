import { Module } from '@nestjs/common';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Stock, StockSchema } from './models/location.schema';

@Module({
  imports:[
    HttpModule.register({
      
    }),
    MongooseModule.forFeature([{
      name: Stock.name,
      schema: StockSchema
    }]),
    CacheModule.register({ 
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    }),
  ],
  controllers: [StocksController],
  providers: [StocksService]
})
export class StocksModule {}
