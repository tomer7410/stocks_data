import { Controller, Get, Query } from '@nestjs/common';
import { StocksService } from './stocks.service';
import { StockEntity } from './entities/stockDto';

@Controller('api')
export class StocksController {

    constructor(private readonly _stocksService: StocksService){}
    @Get('stocks')
    getStocksPrices( @Query('names') names: string) : Promise<Array<number>>{
        return this._stocksService.getAllStocksPrices(names)
    }
   
}
