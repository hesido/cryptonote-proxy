# CryptoNote Switching Relay Proxy v4.2.3
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
