'use strict'
const axios = require('axios');
const urljoin = require('url-join');

const assumestaleafterxseconds = 8;

var CoinMethods = {
/**
 * @typedef { {symbol: string, name: string, login: string, url: string, api: string, active: boolean, network: object, ticker: string, coinunit: number, marketvalue: number, rewardperday:number} } Coin
 * @typedef { {hashrate: number, difficulty: number, blockreward: number, poolblockheight: number, blockheight: number, pooleffort: number, lastblockdatetime: Date, coindifficultytarget: number, hasError: boolean, apiType: string, updatetime: number } } CoinNetwork
 * @typedef { {apibaseurl: string, jsonpath: string, marketname: string, hasError: boolean, updatetime: number} } Ticker
 */

 /**
 * @param {Coin[]} [coins] - Array of coins
 * @param {number} [hashrate] - Hash rate
 * @returns {Coin}
 */
getPreferredCoin : async function(coins, hashrate = 1) {
  let now = (new Date().getTime()) / 1000;
  let promisechain = []
  for(let coin of coins.filter((c)=> !c.network.updatetime || (now - c.network.updatetime) > assumestaleafterxseconds)) {
    promisechain.push(coin.FetchNetworkDetails());
  }
  for(let coin of coins.filter((c)=> !c.ticker.updatetime || (now - c.ticker.updatetime) > assumestaleafterxseconds)) {
    promisechain.push(coin.FetchMarketValue());
  }
  
  let maxRewardCoin = await Promise.all(promisechain).then(()=> {
    let targetCoin;
    coins.filter((c) => !c.ticker.hasError && !c.network.hasError).map((c) => {
      targetCoin = targetCoin || c;
      targetCoin = ((c.rewardperday * c.marketvalue * hashrate) > (targetCoin.rewardperday * targetCoin.marketvalue * hashrate)) ? c : targetCoin;
    });
    return targetCoin;
  });

  return maxRewardCoin;
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
    
      this.networkAPIS = {
        genericCryptonote: async () => {
          try {
            this.network.hasError = "";
            let response = await axios.get(urljoin(this.api, "stats")).catch(() => {throw new Error("URL failed to load")});
            let hashrate = 1000;
    
            if(response.data.error) {throw new Error("API response error")};
    
            this.network.difficulty = response.data.network.difficulty;

            if(!(this.network.blockheight = response.data.network.height))  {throw new Error("Wrong api type")};;
            this.network.lastblockdatetime = response.data.network.timestamp;
            this.coinunit = response.data.config.coinUnits || this.coinunit;
            this.network.reward = (response.data.network.reward - (response.data.network.devfee || 0) - (response.data.network.coinbase || 0)) / this.coinunit;
            this.rewardperday = (hashrate * 86400 / this.network.difficulty) * this.network.reward;
            this.network.coindifficultytarget = response.data.config.coinDifficultyTarget;
            this.network.updatetime = ((new Date).getTime())/1000;
          }
          catch(error) {
            console.log(error);
            this.network.hasError = error;
          }
        },
  
        fairpool: async () => {
          try {
            this.network.hasError = "";
            let response = await axios.get(urljoin(this.api, "stats")).catch(() => {throw new Error("URL failed to load")});;
            let hashrate = 1000;
    
            if(response.data.error) {throw new Error("API response error")};
    
            this.network.difficulty = response.data.network.difficulty;

            //This is actually pool block found time, instead of networks last block.
            //to do: this will be handled differently.
            this.network.lastblockdatetime = response.data.pool.stats.lastBlockFound / 1000;
            this.coinunit = response.data.config.coinUnits || this.coinunit;

            this.network.coindifficultytarget = response.data.config.coinDifficultyTarget

            response = await axios.get(urljoin(this.api, "network")).catch(() => {throw new Error("URL failed to load")});;
            this.network.blockheight = response.data.blockchainHeight;
            //Note: Not sure fair pool api supports dev fees or coinbase fees.
            this.network.reward = response.data.reward / this.coinunit;
            this.rewardperday = (hashrate * 86400 / this.network.difficulty) * this.network.reward;
            this.network.updatetime = ((new Date).getTime())/1000;
          }
          catch(error) {
            console.log(error);
            this.network.hasError = error;
          }
        }
  
      };
  
      this.FetchNetworkDetails = async () => (this.networkAPIS[await this.getApiType()] && this.networkAPIS[this.network.apiType]()) || (async () => {})
    }

    async FetchMarketValue() {
      if (!this.ticker || !this.ticker.apibaseurl || !this.ticker.marketname) return false;
      try {
        this.ticker.hasError = false;

        let response = await axios.get(urljoin(this.ticker.apibaseurl, this.ticker.marketname)).catch((error) => {throw new Error(error);});

        if(response.data.error) {throw new Error("API response error")};

        return this.marketvalue = response.data[this.ticker.jsonpath];
      }
      catch(error) {
        console.log(error);
        this.ticker.hasError = true;
        this.ticker.updatetime = ((new Date).getTime())/1000;
        this.marketvalue = 0;
      }
    }

    async getApiType() {
      if (this.network.apiType) return this.network.apiType;
      if (!this.api) return "__apinotset"
      this.network.apiType = "__detecting";
      for(var apiname in this.networkAPIS) {
        await this.networkAPIS[apiname]();
        if(!this.network.hasError) return this.network.apiType = apiname;
      }
      console.log("failed api detection");
      return this.network.apiType = "__failed";
    }

  }

}

  module.exports = CoinMethods;