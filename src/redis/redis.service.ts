import { Inject, Injectable } from '@nestjs/common';
import { RedisCache, RedisClient } from './interfaces/redis.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { StockEntity } from 'src/stocks/entities/stockDto';
import { EXPERATION_KEY, EXPERATION_TIME, EXPERATION_VALUE, JSON_FILE_DIR, LIST_KEY, SHOULD_READ_FROM_CACHE } from 'src/utils/const';
import { readFile } from 'fs';

@Injectable()
export class RedisService {
    private redisClient: RedisClient;

    constructor( @Inject(CACHE_MANAGER) private cacheService: RedisCache,) {
        this.redisClient = this.cacheService.store.getClient();
        this.handleOnInit()
    }
    handleOnInit(){
        //read fron json file when the server is up 
        this.readStocksDataFromFile().then((stocks:StockEntity[])=>{
            this.writeDataToCache(LIST_KEY,stocks)
            // flag to read from file every 3 hours
            this.reNewFileReadingExperationTime(EXPERATION_KEY,EXPERATION_VALUE,EXPERATION_TIME)
            this.setFlagtoReadFromChace(SHOULD_READ_FROM_CACHE,"true")
            
        })
    }
    setFlagtoReadFromChace(key: string, value: string) {
        this.cacheService.set(key,value).catch(err=>console.log('cannot read rom redis'));
    }
    async getReadFromFileFlag(flag: string){
        return await this.cacheService.get(flag)
    }
    readStocksDataFromFile():Promise< StockEntity[]>{
        return new Promise((resolve,reject)=>{
            readFile(process.cwd()+JSON_FILE_DIR,async(err,data)=>{
                if(err) resolve([]);
                resolve(JSON.parse(data.toString()) as StockEntity[]);
            })
        })
        
    }
    reNewFileReadingExperationTime(key:string, value: string, experationTime: number){
        // renew the experation time
        this.cacheService.set(key,value,experationTime);
    }
    writeDataToCache(key: string,data:StockEntity[]){
        this.redisClient.lpush(key, JSON.stringify(data), function(err, data) {
            if (err) throw new Error('cannot push to redis');
            console.log('data write to redis'); 
        });
    }
    readDataFromCache(key: string){
        return new Promise((resolve,reject)=>{
            this.redisClient.lrange(key, 0, 0, function(err, res){
                if(err) resolve([])
                else resolve(JSON.parse(res.toString()))
            })
        })
    }
    async handleFileReading(){
        return new Promise(async(resolve, reject)=>{
            const shouldReadfromCache = await this.getReadFromFileFlag(SHOULD_READ_FROM_CACHE)
            if(shouldReadfromCache === "true"){
                const data = await this.readDataFromCache(LIST_KEY)
                resolve(data)
                this.setFlagtoReadFromChace(SHOULD_READ_FROM_CACHE,"false")
            }
            else{
                this.redisClient.ttl(EXPERATION_KEY,(async(err, timetoLive) => {
                    if(!err){
                        let stocksFromFile = null
                        if(timetoLive<= 0){
                           // renew experation time
                           this.reNewFileReadingExperationTime(EXPERATION_KEY,EXPERATION_VALUE,EXPERATION_TIME)
                            stocksFromFile = await this.readStocksDataFromFile()
                            resolve(stocksFromFile as StockEntity[])
                        }
                        resolve([] as StockEntity[])
                    }
                  }))
            }
            
            })

    }
}

