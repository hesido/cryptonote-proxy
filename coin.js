'use strict'
const axios = require('axios');
const urljoin = require('url-join');

const assumestaleafterxseconds = 8;

var CoinMethods = {
/**
 * @typedef { {symbol: string, isdefault: boolean, name: string, algo: string, login: string, url: string, api: string, network: object, ticker: string, coinunit: number, marketvalue: number, rewardperday: number, mergewith:Coin, mergedreward: number} } Coin
 * @typedef { {hashrate: number, difficulty: number, blockreward: number, poolblockheight: number, blockheight: number, pooleffort: number, lastblockdatetime: Date, coindifficultytarget: number, hasError: boolean, apiType: string, updatetime: number } } CoinNetwork
 * @typedef { {priceapi: string, pricetype: string, marketname: string, converttobtc: string, price: number, hasError: boolean, updatetime: number} } Ticker
 */

 /**
 * @param {Coin[]} coins - Array of coins
 * @param {Coin} activeCoin - actively mined coin
 * @param {number} [algoswitchmultiplier] - Algo Switch Penalty Multiplier
 * @returns {Coin}
 */
getPreferredCoin : async function(coins, activeCoin = null, algoswitchmultiplier = 1) {
  let now = (new Date().getTime()) / 1000;
  let promisechain = [];
  let activeAlgo = activeCoin && activeCoin.algo;
  algoswitchmultiplier = (activeAlgo && algoswitchmultiplier) || 1;

  for(let mergedcoin of coins) {
    let coin = mergedcoin;
    while(coin) {
      if(!coin.network.updatetime || (now - coin.network.updatetime) > assumestaleafterxseconds) promisechain.push(coin.FetchNetworkDetails());
      if(!coin.ticker.updatetime || (now - coin.ticker.updatetime) > assumestaleafterxseconds) promisechain.push(coin.FetchMarketValue());
      coin = coin.mergewith;
    }
  }
  
  /**
   * @type Coin
   */
  let maxRewardCoin = await Promise.all(promisechain).then(()=> {
    let targetCoin;
    coins.map((c) => {
      targetCoin = targetCoin || c;
      let targetCoinHandicap = (targetCoin.algo == activeAlgo) && 1 || algoswitchmultiplier;
      let testedCoinHandicap = (c.algo == activeAlgo) && 1 || algoswitchmultiplier;
      targetCoin = ((c.mergedreward * testedCoinHandicap * (c.hashrate || 1)) > (targetCoin.mergedreward * targetCoinHandicap * targetCoin.hashrate || 1)) ? c : targetCoin;
    });
    return targetCoin;
  });

  return maxRewardCoin;
},


Coin: class { 
/**
 * @param {string} symbol
 * @param {string} name
 * @param {string} walletaddress
 * @param {string} [url]
 * @param {string} [api]
 * @param {Ticker} [ticker]
 * @param {number} hashrate
 * @param {boolean} isdefault
 * @param {Coin} mergewith
 */
    constructor(symbol, name, algo, walletaddress, url, api, ticker, isdefault, hashrate, mergewith) {
      this.symbol = symbol;
      this.name = name || symbol;
      this.login = walletaddress;
      this.algo = algo,
      this.url = url;
      this.isdefault = isdefault;
      this.hashrate = hashrate;
      /** @type {boolean} */
      this.minersupport = true;
      this.api = api;
      /** @type {CoinNetwork} */
      this.network = {};
      this.ticker = ticker || {};
      this.coinunit = 1000000000;
      this.marketvalue = 0;
      this.rewardperday = 0;
      this.mergewith = mergewith;
    
      this.networkAPIS = {
        genericCryptonote: async () => {
          try {
            this.network.hasError = "";
            let response = await axios.get(urljoin(this.api, "stats")).catch(() => {throw new Error("URL failed to load")});
            if(response.data.error) {throw new Error("API response error")};
  
            this.network.difficulty = response.data.network.difficulty;

            if(!(this.network.blockheight = response.data.network.height))  {throw new Error("Wrong api type")};
            
            this.network.lastblockdatetime = response.data.pool.stats.lastBlockFound / 1000;
            this.coinunit = response.data.config.coinUnits || this.coinunit;
            //this.network.reward = (response.data.network.reward - (response.data.network.devfee || 0) - (response.data.network.coinbase || 0)) / this.coinunit;
            if(!(this.network.reward = response.data.network.reward)) {throw new Error("Wrong api type")};
            this.network.reward /= this.coinunit;
            this.rewardperday = (86400000 / this.network.difficulty) * this.network.reward;
            this.network.coindifficultytarget = response.data.config.coinDifficultyTarget;
            this.network.updatetime = ((new Date).getTime())/1000;
          }
          catch(error) {
            if (!this.network.apiType == "__detecting") console.log("Network API response error for coin:" + this.symbol + "/n" + error);
            this.network.hasError = error;
          }
        },
  
        fairpool: async () => {
          try {
            this.network.hasError = "";
            let response = await axios.get(urljoin(this.api, "stats")).catch(() => {throw new Error("URL failed to load")});
            if(response.data.error) {throw new Error("API response error")};
    
            this.network.difficulty = response.data.network.difficulty;

            this.network.lastblockdatetime = response.data.pool.stats.lastBlockFound / 1000;
            this.coinunit = response.data.config.coinUnits || this.coinunit;

            this.network.coindifficultytarget = response.data.config.coinDifficultyTarget

            response = await axios.get(urljoin(this.api, "network")).catch(() => {throw new Error("URL failed to load")});
            if(!(this.network.blockheight = response.data.blockchainHeight)) {throw new Error("Wrong api type")};
            //Note: Not sure fair pool api supports dev fees or coinbase fees.
            this.network.reward = response.data.reward / this.coinunit;
            this.rewardperday = (86400000 / this.network.difficulty) * this.network.reward;
            this.network.updatetime = ((new Date).getTime())/1000;
          }
          catch(error) {
            if (!this.network.apiType == "__detecting") console.log("Network API response error for coin:" + this.symbol + "/n" + error);
            this.network.hasError = error;
          }
        },

        cryptonoteHashvault: async () => {
          try {
            this.network.hasError = "";
            let response = await axios.get(urljoin(this.api, "stats")).catch(() => {throw new Error("URL failed to load")});
            if(response.data.error) {throw new Error("API response error")};
    
            if(!response.data.network_statistics || !response.data.pool_statistics || !response.data.pool_statistics.lastPoolBlock || !(this.network.difficulty = response.data.network_statistics.difficulty)) {throw new Error("Wrong api type")};
            this.network.blockheight = response.data.network_statistics.height;
            this.coinunit = response.data.config.sigDivisor || this.coinunit;
           
            this.network.reward = (response.data.pool_statistics.lastPoolBlock.value || response.data.network_statistics.value) / this.coinunit;

            this.network.lastblockdatetime = response.data.pool_statistics.lastBlockFoundTime;
            if(!(this.network.coindifficultytarget = response.data.config.coinDiffTarget)) {throw new Error("Wrong api type")};
            this.rewardperday = (86400000 / this.network.difficulty) * this.network.reward;
            this.network.updatetime = ((new Date).getTime())/1000;
          }
          catch(error) {
            if (!this.network.apiType == "__detecting") console.log("Network API response error for coin:" + this.symbol + "/n" + error);
            this.network.hasError = error;
          }
        },

        cryptonotepool: async () => {
          try {
            this.network.hasError = "";
            let response = await axios.get(urljoin(this.api, "network/stats")).catch(() => {throw new Error("URL failed to load")});
            if(response.data.error) {throw new Error("API response error")};
    
            if(!(this.network.difficulty = response.data.difficulty) || !(this.network.blockheight = response.data.height))  {throw new Error("Wrong api type")};
            //Note: coin unit is not supported by this api. Assuming default cryptonote coin unit.
            //this.coinunit = response.data.config.coinUnits || this.coinunit;
           
            this.network.reward = response.data.value / this.coinunit;
            //this.network.blockheight = response.data.height;

            response = await axios.get(urljoin(this.api, "pool/stats")).catch(() => {throw new Error("URL failed to load")});;

            this.network.lastblockdatetime = response.data.pool_statistics.lastBlockFoundTime;
            //Note: coin difficulty target is not supported by this api. Pool effort cannot be calculated independently in future if this is not set.
            this.network.coindifficultytarget = 0;
            this.rewardperday = (86400000 / this.network.difficulty) * this.network.reward;
            this.network.updatetime = ((new Date).getTime())/1000;
          }
          catch(error) {
            if (!this.network.apiType == "__detecting") console.log("Network API response error for coin:" + this.symbol + "/n" + error);
            this.network.hasError = error;
          }
        },

        bombapi: async () => {
          try {
            this.network.hasError = "";
            let response = await axios.get(this.api).catch(() => {throw new Error("URL failed to load")});
            if(response.data.error) {throw new Error("API response error")};
    
            if(!(this.network.difficulty = response.data.netStats && response.data.netStats.difficulty))  {throw new Error("Wrong api type")};
            this.coinunit = response.data.sigDivisor || this.coinunit;
           
            this.network.reward = response.data.lastBlockReward / this.coinunit;
            this.network.blockheight = response.data.netStats.height;

            this.network.lastblockdatetime = response.data.stats.lastBlockFoundTime;
            this.network.coindifficultytarget = response.data.coinDiffTarget;
            this.rewardperday = (86400000 / this.network.difficulty) * this.network.reward;
            this.network.updatetime = ((new Date).getTime())/1000;
          }
          catch(error) {
            if (!this.network.apiType == "__detecting") console.log("Network API response error for coin:" + this.symbol + "/n" + error);
            this.network.hasError = error;
          }
        },

        cryptonoteNodejs: async () => {
          try {
            this.network.hasError = "";
            let response = await axios.get(urljoin(this.api, "stats")).catch(() => {throw new Error("URL failed to load")});
            if(response.data.error) {throw new Error("API response error")};
    
            if(!(this.network.difficulty = response.data.network.difficulty))  {throw new Error("Wrong api type")};
            this.coinunit = response.data.config.coinUnits || this.coinunit;
            this.network.reward = (response.data.pool.averageReward || response.data.lastblock.reward) / this.coinunit;
            this.network.blockheight = response.data.network.height;

            this.network.lastblockdatetime = response.data.pool.lastBlockFound / 1000;
            this.network.coindifficultytarget = response.data.config.coinDifficultyTarget;
            this.rewardperday = (86400000 / this.network.difficulty) * this.network.reward;
            this.network.updatetime = ((new Date).getTime())/1000;
          }
          catch(error) {
            if (!this.network.apiType == "__detecting") console.log("Network API response error for coin:" + this.symbol + "/n" + error);
            this.network.hasError = error;
          }
        }

  
      };

      this.priceAPIS = {
        tradeogre: async() => {
          let pricetypes = {
            buy: "ask",
            sell: "bid",
            market: "price"
          }

          if (!this.ticker || !this.ticker.marketname) return false;
          try {
            this.ticker.hasError = false;
    
            let response = await axios.get(urljoin("https://tradeogre.com/api/v1/ticker/", this.ticker.marketname)).catch((error) => {throw new Error(error);});
            let btcconvertresponse = (this.ticker.converttobtc) ? await axios.get(urljoin("https://tradeogre.com/api/v1/ticker/", this.ticker.converttobtc)).catch((error) => {throw new Error(error);}) : null;
  
            if(response.data.error || (btcconvertresponse && btcconvertresponse.data.error)) {throw new Error("API response error")};
            let btcconvertmultiplier = btcconvertresponse && btcconvertresponse.data[pricetypes.buy] || 1;
            this.ticker.updatetime = ((new Date).getTime())/1000;
    
            return this.marketvalue = response.data[pricetypes[this.ticker.pricetype]] * btcconvertmultiplier;
          }
          catch(error) {
            this.ticker.hasError = true;
            console.log("Ticker API response failed for coin:" + this.symbol + "/n" + error);
            this.marketvalue = 0;
          }
        },
        cryptopia: async() => {
          let pricetypes = {
            buy: "BidPrice",
            sell: "AskPrice",
            market: "LastPrice"
          }

          if (!this.ticker || !this.ticker.marketname) return false;
          try {
            this.ticker.hasError = false;
    
            let response = await axios.get(urljoin("https://www.cryptopia.co.nz/api/GetMarket/", this.ticker.marketname)).catch((error) => {throw new Error(error);});
            let btcconvertresponse = (this.ticker.converttobtc) ? await axios.get(urljoin("https://www.cryptopia.co.nz/api/GetMarket/", this.ticker.converttobtc)).catch((error) => {throw new Error(error);}) : null;

            if(response.data.Error || (btcconvertresponse && btcconvertresponse.data.Error)) {throw new Error("API response error")};

            let btcconvertmultiplier = btcconvertresponse && btcconvertresponse.data.Data[pricetypes.buy] || 1;
            this.ticker.updatetime = ((new Date).getTime())/1000;
    
            return this.marketvalue = response.data.Data[pricetypes[this.ticker.pricetype]] * btcconvertmultiplier;
          }
          catch(error) {
            this.ticker.hasError = true;
            console.log("Ticker API response failed for coin:" + this.symbol + "/n" + error);
            this.marketvalue = 0;
          }
        }
        
      }
  
      this.FetchNetworkDetails = async () => (this.networkAPIS[await this.getApiType()] && this.networkAPIS[this.network.apiType]()) || (async () => {})
      this.FetchMarketValue = (this.ticker && !this.ticker.price && this.priceAPIS[this.ticker.priceapi]) || (async () => (this.marketvalue = this.ticker.price) || false);
    }

    get mergedreward() {

      let valuereward = 0;
      if (!this.mergewith) { valuereward = (this.rewardperday || 0) * (this.marketvalue || 0); }
      else  {
        let coin = this;
        while (coin) {
          valuereward += (coin.rewardperday || 0) * (coin.marketvalue || 0);
          coin = coin.mergewith;
        }
      }

      return valuereward;
    }

    async getApiType() {
      if (this.network.apiType) return this.network.apiType;
      if (!this.api) return "__apinotset"
      this.network.apiType = "__detecting";
      for(var apiname in this.networkAPIS) {
        await this.networkAPIS[apiname]();
        if(!this.network.hasError) return this.network.apiType = apiname;
      }
      console.log("Failed api detection for coin: " + this.symbol);
      return this.network.apiType = "__failed";
    }

  }

}

  module.exports = CoinMethods;