import { Inject, Injectable } from '@nestjs/common';
import { RedisCache, RedisClient } from './interfaces/redis.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { StockEntity } from 'src/stocks/entities/stockDto';
import { EXPERATION_TIME, JSON_FILE_DIR, LIST_KEY, SHOULD_READ_FROM_FILE } from 'src/utils/const';
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
            this.reNewFileReadingExperationTime()
            
        })
    }
    readStocksDataFromFile():Promise< StockEntity[]>{
        return new Promise((resolve,reject)=>{
            readFile(process.cwd()+JSON_FILE_DIR,async(err,data)=>{
                if(err) resolve([]);
                resolve(JSON.parse(data.toString()) as StockEntity[]) 
            })
        })
        
    }
    reNewFileReadingExperationTime(){
        // renew the experation time
        this.redisClient.set(SHOULD_READ_FROM_FILE, true, 'EX',EXPERATION_TIME,((err,data)=>{
            console.log(data);
            
        }));
    }
    writeDataToCache(key: string,data:StockEntity[]){
        this.redisClient.lpush(key, JSON.stringify(key), function(err, data) {
            if (err) throw new Error('cannot push to redis');
            console.log('data write to redis'); 
        });
    }
    async handleFileReading(){
        return new Promise((resolve, reject)=>{
            this.redisClient.ttl('shouldRead',(async(err, timetoLive) => {
                if(!err){
                    let stocksFromFile = null
                    if(timetoLive<= 0){
                       // renew experation time
                        this.reNewFileReadingExperationTime()
                        stocksFromFile = await this.readStocksDataFromFile()
                        resolve(stocksFromFile as StockEntity[])
                    }
                    resolve([] as StockEntity[])
                }
              }))
            })

    }
}

