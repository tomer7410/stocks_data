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
import { RedisCache, RedisClient } from './interfaces/redis.interface';
import { readFile } from 'fs';
import { resolve } from 'path';
import { EXPERATION_TIME, JSON_FILE_DIR, REDIS_FLAG } from 'src/utils/const';
@Injectable()
export class StocksService {
    private redisClient: RedisClient;
    constructor(
        @Inject(CACHE_MANAGER) private cacheService: RedisCache,
        @InjectModel(Stock.name) private stockModel: Model<Stock>,
        private readonly httpService: HttpService
        ){
            this.redisClient = this.cacheService.store.getClient();
            this.handleOnInit()
            
        }
    handleOnInit(){
        //read fron json file when the server is up 
        this.readStocksDataFromFile().then((stocks:StockEntity[])=>{
            this.redisClient.lpush("stocks", JSON.stringify(stocks), function(err, data) {
                if (err) throw new Error('cannot push to redis');
                console.log('data write to redis'); 
            });
            // flag to read from file every 3 hours
            this.writeFlagToRedis()
            
        })
    }
    async getAllStocksPrices(names?: string): Promise<Array<number>> {
        const stockNames = names?.split(',') || []
        return await this.fetchStocksFromResources(stockNames)
    }

    writeFlagToRedis(){
        // renew the experation time
        this.redisClient.set(REDIS_FLAG, true, 'EX',EXPERATION_TIME,((err,data)=>{
            console.log(data);
            
        }));
    }
    readStocksDataFromFile():Promise< StockEntity[]>{
        return new Promise((resolve,reject)=>{
            readFile(process.cwd()+JSON_FILE_DIR,async(err,data)=>{
                if(err) resolve([]);
                resolve(JSON.parse(data.toString()) as StockEntity[]) 
            })
        })
        
    }

    // read from db
    async getStockDataFromDb(stockNames: string[]){
        
        if(!stockNames.length){
            return this.stockModel.find({}).exec()
        }
        return this.stockModel.find({
            'name':{$in:stockNames}
        }).exec()   
    }

    // handling whatever we should read from file agaiin or not 
    async handleFileReading(){
        return new Promise((resolve, reject)=>{
            this.redisClient.ttl('shouldRead',(async(err, timetoLive) => {
                if(!err){
                    let stocksFromFile = null
                    if(timetoLive<= 0){
                       // renew experation time
                        this.writeFlagToRedis()
                        stocksFromFile = await this.readStocksDataFromFile()
                        resolve(stocksFromFile as StockEntity[])
                    }
                    resolve([] as StockEntity[])
                }
              }))
            })
        
        
        

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

        //for each required stock for each found stock by resource, find the most updated record complexity = nOfrequiredStock * nOfresource * log(n stocks) * (g found records)
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
        const dataFromFilePromise = this.handleFileReading()
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
