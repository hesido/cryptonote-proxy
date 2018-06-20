 'use strict'
const axios = require('axios');


var CoinMethods = {
/**
 * @typedef { {symbol: string, name: string, login: string, url: string, active: boolean, network: object, ticker: string, coinunit: number, marketvalue: number} } Coin
 * @typedef { {hashrate: number, difficulty: number, blockreward: number, poolblockheight: number, blockheight: number, effort: number, lastblockdatetime: Date } } CoinNetwork
 * @typedef { {apibaseurl: string, jsonpath: string, marketname: string, hasError: boolean} } Ticker
 */

 /**
 * @param {Coin[]} [coins] - Array of coins
 */
getPreferredCoin : function(coins) {

},


Coin: class { 
/**
 * @param {string} [symbol]
 * @param {string} [name]
 * @param {string} [walletaddress]
 * @param {string} [url]
 * @param {string} [api]
 * @param {Ticker} [ticker]
 */
    constructor(symbol, name, walletaddress, url, api, ticker) {
      this.symbol = symbol;
      this.name = name || symbol;
      this.login = walletaddress;
      this.url = url;
      this.active = false;
      this.api = api;
      /**
      * @type {CoinNetwork}
      */
      this.network = {};
      this.ticker = ticker;
      this.coinunit = 10000000;
      this.marketvalue = 0;
    }

    async FetchMarketValue() {
      try {
        this.ticker.hasError = false;
        console.log(this.ticker.apibaseurl + this.ticker.marketname);
        
        let response = await axios.get(this.ticker.apibaseurl + this.ticker.marketname);

        console.log(response.data.error);

        if(response.data.error) {throw new Error("API response error")};

        return this.marketvalue = response.data[this.ticker.jsonpath];
      }
      catch(error) {
        console.log(error);
        this.ticker.hasError = true;
        this.marketvalue = 0;
      }
    }
  },

}

  module.exports = CoinMethods;