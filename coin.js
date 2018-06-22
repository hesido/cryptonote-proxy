'use strict'
const axios = require('axios');
const urljoin = require('url-join');


var CoinMethods = {
/**
 * @typedef { {symbol: string, name: string, login: string, url: string, api: string, active: boolean, network: object, ticker: string, coinunit: number, marketvalue: number, rewardperday:number} } Coin
 * @typedef { {hashrate: number, difficulty: number, blockreward: number, poolblockheight: number, blockheight: number, pooleffort: number, lastblockdatetime: Date, hasError: boolean } } CoinNetwork
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
      this.ticker = ticker || {};
      this.coinunit = 1000000000;
      this.marketvalue = 0;
      this.rewardperday = 0;
    }

    async FetchMarketValue() {
      if (!this.ticker || !this.ticker.apibaseurl || !this.ticker.marketname) return false;
      try {
        this.ticker.hasError = false;

        let response = await axios.get(urljoin(this.ticker.apibaseurl, this.ticker.marketname));

        if(response.data.error) {throw new Error("API response error")};

        return this.marketvalue = response.data[this.ticker.jsonpath];
      }
      catch(error) {
        console.log(error);
        this.ticker.hasError = true;
        this.marketvalue = 0;
      }
    }

    async FetchNetworkDetails() {
      try {
        this.network.hasError = false;
        let response = await axios.get(urljoin(this.api, "stats"));
        let hashrate = 1;

        if(response.data.error) {throw new Error("API response error")};

        this.network.difficulty = response.data.network.difficulty;
        this.network.blockheight = response.data.network.height;
        this.network.lastblockdatetime = response.data.network.timestamp;
        this.coinunit = response.data.config.coinUnits || this.coinunit;
        this.network.reward = (response.data.network.reward - (response.data.network.devfee || 0) - (response.data.network.coinbase || 0)) / this.coinunit;
        this.rewardperday = (hashrate * 86400 / this.network.difficulty) * this.network.reward;
      }
      catch(error) {
        console.log(error);
        this.network.hasError = true;
      }
    }
  },

}

  module.exports = CoinMethods;