
import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';

export type StockDocument = Stock & Document;
@Schema()
export class Stock {
  @Prop({required:true})
  name: string
  @Prop({required:true})
  price: number
  @Prop({required:true})
  date: Date
   
   
}
const StockSchema = SchemaFactory.createForClass(Stock);
export {StockSchema}
