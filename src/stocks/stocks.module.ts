import { Module } from '@nestjs/common';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Stock, StockSchema } from './models/location.schema';
import { RedisService } from 'src/redis/redis.service';

@Module({
  imports:[
    HttpModule.register({
      
    }),
    MongooseModule.forFeature([{
      name: Stock.name,
      schema: StockSchema
    }]),
  ],
  controllers: [StocksController],
  providers: [StocksService,RedisService]
})
export class StocksModule {}
