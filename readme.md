# CryptoNote Switching Relay Proxy v4.2.1
Forked from repository: https://github.com/sebseb7/cryptonote-proxy

## Basic Instructions
https://nodejs.org/
1. install node.js version 8 as the minimum
1. install libraries with "npm i ."
1. adjust config.json
1. start with "node proxy.js"
1. don't open index.html from this repo, to control the switch point your browser to the "httpport" as in config.json

[Windows Installation Guide for pre-fork version by Seb](https://github.com/sebseb7/cryptonote-proxy/wiki/Installation-guide-for-cryptonote-proxy)
The installation guide provides the basics for running the proxy. There are small configuration details that the Switching Relay Proxy requires. For this, please see the *config.json_commented* file. The proxy needs you to create *config.json* and you can edit either the plain example file, or the commented config file, and rename it to *config.json*.
Support: hesido@yahoo.com

## Version History
### Changes from 4.1.1
* Added **multi algo switch support** through xmrig stratum extensions. At the time of release **SRBMiner** and **XMRig CPU** supports native algo-switching
* UI changes for a leaner look
* Fixed miner reward amount when there's coinbase fee involved (This fixes Bittube miner reward problem which showed lower earnings compared to actual earnings)
* Fixed a bug causing the coin evalulation to be called multiple times.

### Changes from 4.1.0:
* Added aggregate push notifications (Aggregate all messages within time span set in configuration)
* Minor bug fixes
* Config.json now can have comments
