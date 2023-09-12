export class StockEntity {
    name:string
    price:number
    date:Date
    constructor(partial: Partial<StockEntity>) {
        Object.assign(this, partial);
      }
}