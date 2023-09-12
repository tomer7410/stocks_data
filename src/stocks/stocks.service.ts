import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { StockEntity } from './entities/stockDto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { sortCallbackFunction } from 'src/utils/sortCallback';
import { HttpService } from '@nestjs/axios'
import {  map } from 'rxjs';
import { InjectModel } from '@nestjs/mongoose';
import { Stock } from './models/location.schema';
import { Model } from 'mongoose';
import { RedisCache, RedisClient } from '../redis/interfaces/redis.interface';
import { readFile } from 'fs';
import { EXPERATION_TIME, JSON_FILE_DIR, LIST_KEY, SHOULD_READ_FROM_FILE } from 'src/utils/const';
import { RedisService } from 'src/redis/redis.service';
@Injectable()
export class StocksService {
    constructor(
        private readonly redisService: RedisService,
        @InjectModel(Stock.name) private stockModel: Model<Stock>,
        // @InjectConnection() private readonly sqlConnection: Connection
        private readonly httpService: HttpService
        ){}

    async getAllStocksPrices(names?: string): Promise<Array<number>> {
        const stockNames = names?.split(',') || []
        return await this.fetchStocksFromResources(stockNames)
    }
    // read from db
    async getStockDataFromDb(stockNames: string[]){
        
        if(!stockNames.length){
            return this.stockModel.find({}).exec()
        }
        return this.stockModel.find({
            'name':{$in:stockNames}
        }).exec() 

        ////////////////
        //sql version
        // if(!stockNames.length){
        //    return this.connection.query('SELECT * FROM STOCKS;');
        // }
        // return this.connection.query( `Select * from STOCKS where name in ${stockNames}`);
    }
    
    //searching the most updated record 
    getMostUpdateRecord(stockRecords: StockEntity[]){

        let mostupdatedRecord = stockRecords[0]
        let mostupdatedDate = mostupdatedRecord.date
        for (let index = 1; index < stockRecords.length; index++) {
            const currentRecord = stockRecords[index];
            const currentMostUpdatedDate = currentRecord.date
            if(currentMostUpdatedDate>mostupdatedDate){
                mostupdatedDate = currentMostUpdatedDate
                mostupdatedRecord = currentRecord
            }   
        }
        
        return mostupdatedRecord
    }
    
    async getMostUpdatedDataFromResources(datafromResources:Array<Array<StockEntity>>, stockNames:string[]){
        
        const sortedDatafromResources = datafromResources.map((data:Array<StockEntity>)=>data.sort(sortCallbackFunction)) //sorting list from each resource
        const namesIterator = stockNames.length > 0 ? stockNames : sortedDatafromResources[0].map(v=>v.name) //whatever is all the stocks name or just few

        //for each required stock for each found stock by resource, find the most updated record;
        // complexity = nOfrequiredStock * nOfresource * log(n stocks) * (g found records)
        return namesIterator.reduce((acc,currentName:string,index: Number)=>{
            const sameDataFromOtherResources = sortedDatafromResources.reduce((acc1,currentSortedResource)=>{
                const stock = this.binarySearch(currentSortedResource,currentName)
                if(stock) return [...acc1,stock]
                return acc1
            },[])  
            if(sameDataFromOtherResources.length > 0){
                const requirePrice = this.getMostUpdateRecord(sameDataFromOtherResources).price
                return[...acc,requirePrice]
            }
            return acc
            
        },[])
    }
    async fetchStocksFromResources(stockNames:string[]){ // fetching data from each resources
        const dataFromAmazonPromise = this.getStockDataFromAmazon() 
        const dataFromDbPromise = this.getStockDataFromDb(stockNames)
        const dataFromFilePromise = this.redisService.handleFileReading()
        const promisesArr = [dataFromAmazonPromise, dataFromDbPromise,dataFromFilePromise]
        const resourcesData = (await Promise.all(promisesArr)) as Array<Array<StockEntity>>

        return this.getMostUpdatedDataFromResources(resourcesData,stockNames)  
    }
    binarySearch(stocks: StockEntity[], currentStock: string): any {
        let l = 0;
        let r = stocks.length - 1;
        let mid;
        while (r >= l) {
            mid = l + Math.floor((r - l) / 2);
            if (stocks[mid].name == currentStock)
                return stocks[mid];
    
            if (stocks[mid].name > currentStock)
                r = mid - 1;
                
            else
                l = mid + 1;
        }
        
        return null;
    }
    getStockDataFromAmazon(): Promise<StockEntity[]>{
        return this.httpService.get(process.env.AMAZON_FILE_URL).pipe(map(resp => resp.data as StockEntity[])).toPromise()
    }

}
