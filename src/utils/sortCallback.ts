import { StockEntity } from "../stocks/entities/stockDto"

export const sortCallbackFunction = (a: StockEntity,b: StockEntity)=>{
    if(a.name > b.name) return 1
    else{
        if(a.name > b.name) return -1
        return 0
    }
}

