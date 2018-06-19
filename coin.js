
var CoinMethods = {

/**
 * @param {Coin[]} [coins] - Array of coins
 */
getPreferredCoin : function(coins) {

},

/**
 * @typedef { {symbol: string, name: string, login: string, url: string, active: boolean, network: object, ticker: string, marketvalue: object} } Coin
 */


Coin: class { 
/**
 * @param {string} [symbol]
 * @param {string} [name]
 * @param {string} [walletaddress]
 * @param {string} [url]
 * @param {string} [api]
 * @param {string} [ticker]
 */
    constructor(symbol, name, walletaddress, url, api, ticker) {
      this.symbol = symbol;
      this.name = name || symbol;
      this.login = walletaddress;
      this.url = url;
      this.active = false;
      this.api = api;
      this.network = {
          hashrate : 0,
          lastblockdatetime : 0,
          difficulty : 0,
          poolblockheight : 0,
          blockheight : 0,
          effort : 0,
      };
      this.ticker = ticker;
      this.marketvalue = {
        btc: 0
      };
    }

  }

}

  module.exports = CoinMethods;