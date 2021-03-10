import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { BRTUtil } from './domain/brt-util';

/*
 * Transform BRT date to indicated format
 * Usage:
 *   value | brtDate:"date_format"
*/
@Pipe({name: 'brtDate'})
export class BRTDatePipe implements PipeTransform {
    constructor(private datePipe: DatePipe){}

    transform(value: number, format: string): string {
        let unixTimestamp = BRTUtil.brtToUnixTimestamp(value);
        return this.datePipe.transform(unixTimestamp, format);
    }
}

@Pipe({name: 'brtAmount'})
export class BRTAmountPipe implements PipeTransform {
    constructor(private numberPipe: DecimalPipe){}

    transform(value, includeCurrency: boolean, numberFormat: boolean): string {
        if(value == null){
            return "";
        } else if(isNaN(value)){
            let amount = BRTUtil.dropsToBrt(value);
            if(numberFormat != null && numberFormat){
                amount = this.numberPipe.transform(amount, "1.2-8");
            }
            if(includeCurrency){
                amount = amount + " BRT";
            }
            return amount;
        } else {
            let amount = BRTUtil.dropsToBrt(value.toString());
            if(numberFormat != null && numberFormat){
                amount = this.numberPipe.transform(amount, "1.2-8");
            }
            if(includeCurrency){
                amount = amount + " BRT";
            }
            return amount;
        }
    }
}

@Pipe({ name: 'toNumber'})
export class ToNumberPipe implements PipeTransform {
    transform(value: string):any {
        let retNumber = Number(value);
        return isNaN(retNumber) ? 0 : retNumber;
    }
}
