import Big from 'big.js';
import * as bigInt from 'big-integer';

import { Amount, Memo, brtdAmount, brtMemo, BRTURI }  from './brt-types';

export class BRTUtil {

    static brtToUnixTimestamp(rpepoch: number): number {
        return (rpepoch + 0x386D4380) * 1000
    }

    static unixTobrtTimestamp(timestamp: number): number {
        return Math.round(timestamp / 1000) - 0x386D4380
    }

    static brtTimeToISO8601(brtTime: number): string {
        return new Date(this.brtToUnixTimestamp(brtTime)).toISOString()
    }

    static iso8601TobrtTime(iso8601: string): number {
        return this.unixTobrtTimestamp(Date.parse(iso8601))
    }

    static brtTimeNow(): number {
        return this.unixTobrtTimestamp(Date.now());
    }

    static dropsToBrt(drops: string): string {
        try{
            let bigDrops = new Big(drops);
            if(bigDrops > 0){
                return (bigDrops).div(1000000.0).toString();
            } else {
                return "0.00";
            }
        } catch {
            return "0.00";
        }

    }

    static brtToDrops(brt: string): string {
        let brt_drops = (new Big(brt)).times(1000000.0);
        return brt_drops.toString();
    }

    static tobrtdAmount(amount: Amount): brtdAmount {
        if (amount.currency === 'BRT') {
            let brt_drops = this.brtToDrops(amount.value);
            return brt_drops;
        }
        let default_object: brtdAmount = {
            currency: amount.currency,
            issuer: amount.counterparty ? amount.counterparty :  undefined,
            value: amount.value
        };
        return default_object;
    }

    static decodeMemos(memos: Array<brtMemo>) : Array<Memo> {
        function removeUndefined(obj: Object): Object {
            // return _.omit(obj, _.isUndefined)
            Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
            return obj;
        }
        function hexToString(hex: string) : string {
            return hex ? new Buffer(hex, 'hex').toString('utf-8') : undefined;
        }

        if (!Array.isArray(memos) || memos.length === 0) {
            return undefined;
        }
        return memos.map(m => {
            let memoObject = { memo:
                removeUndefined({
                    memoType: hexToString(m['Memo'].MemoType),
                    memoFormat: hexToString(m['Memo'].MemoFormat),
                    memoData: hexToString(m['Memo'].MemoData)
                })
            };
            return memoObject;
        });
    }

    static encodeMemo(inputMemo: Memo): brtMemo {
        function removeUndefined(obj: Object): Object {
            // return _.omit(obj, _.isUndefined)
            Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
            return obj;
        }
        function stringToHex(string: string) : string {
            // limit data to 256 bytes
            return string ? (new Buffer(string.substring(0,256), 'utf8')).toString('hex').toUpperCase() : undefined;
        }
        return {
            Memo: removeUndefined({
                MemoData: stringToHex(inputMemo.memo.memoData),
                MemoType: stringToHex(inputMemo.memo.memoType),
                MemoFormat: stringToHex(inputMemo.memo.memoFormat)
            })
        };
    }

    static decodeInvoiceID(hex: string) : string {
        // remove start padding
        function removePadStart(string, padString){
            // hex encoding -> remove every "00"
            let resultString = string;
            while(resultString.startsWith(padString)){
                resultString = resultString.substring(2);
            }
            return resultString;
        }
        let unpaddedString = removePadStart(hex, "00");
        return (unpaddedString ? new Buffer(unpaddedString, 'hex').toString('utf-8') : "");
    }

    static encodeInvoiceID(string: string) : string {
        // limit data to 32 bytes (256 bit) left padded with 0 to 64 length for double digit hex
        function padStart(string, padString) {
            let targetLength = 64;
            targetLength = targetLength>>0; //floor if number or convert non-number to 0;
            padString = String(padString || ' ');
            if (string.length > targetLength) {
                return string;
            }
            else {
                targetLength = targetLength-string.length;
                if (targetLength > padString.length) {
                    padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
                }
                return padString.slice(0,targetLength) + string;
            }
        }
        // encode
        let encoded = string ? (new Buffer(string.substring(0,32), 'utf8')).toString('hex').toUpperCase() : "";
        encoded = padStart(encoded, "0");
        return encoded;
    }

    private bytesToHex(byteArray) {
        return Array.from(byteArray, function(byte: number) {
          return ('0' + (byte & 0xFF).toString(16).toUpperCase()).slice(-2);
        }).join('')
    }

    static validateAccountID(accountID: string): boolean {
        // prepare position lookup table with brt alphabet
        var vals = 'brtshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2pcdeCg65jkm8oFqi1uvAxyz';
        // check if address starts with lowercase 'b'
        if(!accountID.startsWith('b')){
            return false;
        }
        // decode the the address
        var positions = {};
        for (var i=0 ; i < vals.length ; ++i) {
            positions[vals[i]] = i;
        }
        var base = 58;
        var length = accountID.length;
        var num = bigInt(0);
        var leading_zero = 0;
        var seen_other = false;
        for (var i=0; i<length ; ++i) {
            var char = accountID[i];
            var p = positions[char];

            // if we encounter an invalid character, decoding fails
            if (p === undefined) {
                return false;
            }
            num = num.multiply(base).add(p);
            if (char == '1' && !seen_other) {
                ++leading_zero;
            }
            else {
                seen_other = true;
            }
        }
        var hex = num.toString(16);
        // num.toString(16) does not have leading 0
        if (hex.length % 2 !== 0) {
            hex = '0' + hex;
        }
        // strings starting with only ones need to be adjusted
        // e.g. '1' should map to '00' and not '0000'
        if (leading_zero && !seen_other) {
            --leading_zero;
        }
        while (leading_zero-- > 0) {
            hex = '00' + hex;
        }
        // addresses should always be 48 positions long
        if(hex.length == 48){
            return true;
        } else {
            return false;
        }
    }

    static convertStringVersionToNumber(version:string): bigInt.BigInteger {
        // remove points
        let dotlessVersion = version.split(".").join("");
        return bigInt(dotlessVersion);
    }

    static generateCXXQRCodeURI(address: string){
        return "brt:" + address + "?label=" + encodeURI("Swap Deposit");
    }

    static generateBRTQRCodeURI(input: BRTURI){
        let uri = "https://brt.network/send?to=" + input.address;
        if(input.amount){
            uri = uri + "&amount=" + input.amount;
        }
        if(input.destinationTag){
            uri = uri + "&dt=" + input.destinationTag;
        }
        if(input.label){
            uri = uri + "&label=" + input.label;
        }
        return uri;
    }
}
