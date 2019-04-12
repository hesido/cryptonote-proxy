# CryptoNote Switching Relay Proxy v4.4.0
***
Forked from repository: https://github.com/sebseb7/cryptonote-proxy
![CryoptonoteUI](https://images2.imgbox.com/7d/3e/A8slRmiN_o.png)

## Basic Instructions
https://nodejs.org/
1. install node.js version 8 as the minimum
1. install libraries with "npm i ."
1. adjust config.json
1. start with "node proxy.js"
1. don't open index.html from this repo, to control the switch point your browser to the "httpport" as in config.json

[Windows Installation Guide for pre-fork version by Seb](https://github.com/sebseb7/cryptonote-proxy/wiki/Installation-guide-for-cryptonote-proxy)
The installation guide provides the basics for running the proxy. There are small configuration details that the Switching Relay Proxy requires. For this, please see the *config.json_commented* file. The proxy needs you to create *config.json* and you can edit either the plain example file, or the commented config file, and rename it to *config.json*.

[Basic Configuration Guide for Switching Relay Proxy](https://github.com/hesido/cryptonote-switching-relay-proxy/wiki/Basic-Configuration)

[Multi Algo Configuration Guide for use with SRBMiner](https://github.com/hesido/cryptonote-switching-relay-proxy/wiki/Multi-Algo-switching-setup-using-SRBMiner)

Support: <hesido@yahoo.com>

Contact me at the support mail or at [hesido.com contact page](http://www.hesido.com/base.php?page=general&sub=contact) **if you want to sponsor a feature**.

For BTC donations: `3LhbnGPZ3YUTjWicDi1M3YwRTpGD8f3wWr`

## Version History
### Changes in 4.4.0
* Added merged mining earning display and profitability support
* Added sanity check that prevents wrong values when switching between users in UI
### Changes in 4.3.6
* Added new mappings for Graft cn/rwz and WowNero cn/wow.
* Added new pool api (HashVault).
* Detected pool api is now displayed in "More Info" dropdown.
### Changes in 4.3.5
* Added new mappings for Monero cn/r.
* Added new pool api (BombApi).
### Changes in 4.3.4
* Added new mappings for new algos for those using algo switching.
### Changes in 4.3.3
* Fix for cases when a single TCP message contained multiple stratum messages.
### Changes in 4.3.2
* Added Monero's new algo to algo map list.
* Added a new pool api type for a total of 4 types of pool apis (all pool api's are auto detected)
* Added Cryptopia and MapleChange Ticker Api's, on top of the default TradeOgre api
### Changes in 4.3.1
* You can now select price-type for each coin: "sell", "market", and "buy" price. "sell" price is default, this is the price that you can sell the coin.
* You can now set a custom price for each coin - this allows you to profit-switch to coin based on difficulty without being affected by market movements, or include coins that are not yet on exchanges to auto-switching based on the price you speculate/intend to sell the coin.
* Made proxy nicehash friendly again, fixed regression caused by killing sockets using duplicate passwords when multi-algo mode is not active.
* Each user defined in config.json can have a unique default coin
* Made ticker api extensible like the miner api

### Changes in 4.2.3
* Config.json now understands SRBMiner style namings for the `algo` property.
* Fix MultiAlgo on some pools that does not communicate with the latest algo negotiation standards, or pools that have poorly interpreted the latest standards.
* Workers can now request difficulties individually:
    * In `config.json` You need to set a default difficulty using pool's preferred syntax, like before.
        * e.g. `"name": "mywalletaddresskekehUCmgZTisn9i7fhUCmgZT+5000.myself@mail.com"`,
    * In miner's pool settings, set the username like before, and add ".difficulty" at the end.
        * e.g.: `"UserA.200000"` or `"UserA+200000"`
### Changes in 4.2.2
* Kill obsolete tcp sockets not properly ended by miner during algo changes
* Fix bug getting hashrates from miner when miner supports algo-perf extension
### Changes in 4.2.1
* Added **multi algo switch support** through xmrig stratum extensions. At the time of release **SRBMiner** and **XMRig CPU** supports native algo-switching
* UI changes for a leaner look
* Fixed miner reward amount when there's coinbase fee involved (This fixes Bittube miner reward problem which showed lower earnings compared to actual earnings)
* Fixed a bug causing the coin evalulation to be called multiple times.
### Changes in 4.1.1:
* Added aggregate push notifications (Aggregate all messages within time span set in configuration)
* Minor bug fixes
* Config.json now can have comments
