'use strict'
const net = require("net");
const events = require('events');
const fs = require('fs');
const basicAuth = require('express-basic-auth')
const app = require('express')();
const http = require('http');
const https = require('https');
const path = require('path');
const winston = require('winston');
const BN = require('bignumber.js');
//const pushbullet = require('pushbullet');
const diff2 = BN('ffffffff', 16);
const stripjson = require('strip-json-comments');
const coinMethods = require('./coin.js');
const pushNotify = require('./pushnotify.js');


const server = http.createServer(app);
const io = require('socket.io').listen(server);
const bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const logger = new (winston.Logger)({
	transports: [
		new winston.transports.Console({timestamp:(new Date()).toLocaleTimeString(),colorize:true,level:'info'}),
		new winston.transports.File({name:'a',json:false,filename:'logfile.txt',timestamp:(new Date()).toLocaleTimeString(),level:'debug'}),
	]
});

const switchEmitter = new events.EventEmitter();
switchEmitter.setMaxListeners(200);

process.on("uncaughtException", function(error) {
	logger.error(error);
});

const runTimeSettings = {userList: []};
const workerSettings = {};
const workerResponders = {};
const workerhashrates = {};
var config, algomapping, pools;
EvaluateConfig();

var pusher = new pushNotify(config.pushbulletApiToken, 1 , config.joinpushmessageswithinXminutes);

InitializeCoins();
const localport = config.workerport;

if(config.httpuser && config.httppassword) {
	logger.info("Activating basic http authentication.");
	app.use(
		basicAuth({
		users: { [config.httpuser]: config.httppassword },
		challenge: true,
		realm: "minerproxy"
	}));
	if(pusher.apiToken) {
		https.get({'host': 'api.ipify.org', 'path': '/'}, function(resp) {
		resp.on('data', function(externalip) {
			/* ToDo: put a wrapper in pushnotify class*/
			pusher.pusher.link({}, "Miner Proxy", "http://"+ externalip + ":" + config.httpexternalport || config.httpport, "Link to Miner Proxy", function(error, response) {});
		});
	});
	}
}

app.get('/', function(req, res) {
	res.sendFile(path.resolve(__dirname+'/index.html'));
});

logger.info("start http interface on port %d ", config.httpport);
server.listen(config.httpport,'::');

function attachPool(localsocket,coin,firstConn,setWorker,user,pass,diffRequest) {
	var idx;

	for (var pool in pools[user]) idx = (pools[user][pool].symbol === coin) ? pool : (idx || pool);
	coin = pools[user][idx].symbol;

	workerSettings[user].activeCoin = workerSettings[user].coins.filter((c) => c.symbol === coin)[0];

	logger.info('connect to %s %s ('+pass+')',pools[user][idx].host, pools[user][idx].port);
	
	var remotesocket = new net.Socket();
	remotesocket.connect(pools[user][idx].port, pools[user][idx].host);

	var poolDiff=0;
	const connectTime = ((new Date).getTime())/1000;
	var shares=0;

	if(workerSettings[user].UIset.autoCoinSwitch && config.EvaluateSwitchEveryXMinutes > 0) {
		if(workerSettings[user].coinswitchtimeout) clearTimeout(workerSettings[user].coinswitchtimeout);
		workerSettings[user].coinswitchtimeout = setTimeout(EvaluateCoinSwitch, (config.MineCoinForAtLeastXMinutes || config.EvaluateSwitchEveryXMinutes) * 60 * 1000, user)
	}

	remotesocket.on('connect', function (data) {
		if(data) logger.debug('received from pool ('+coin+') on connect:'+data.toString().trim()+' ('+pass+')');
				
		let passTemplate = pools[user][idx]["passwordtemplate"],
			poolLogin = pools[user][idx].name;

		if(diffRequest) poolLogin = poolLogin.replace(/(.+)([.+])(\d+)(([.+].*)|$)/, "$1$2"+diffRequest+"$4");

		logger.info('new login to '+coin+' ('+pass+')');
		let request = {"id":1,"method":"login","params":{"login":poolLogin,"pass": (passTemplate) ? passTemplate.replace("{%1}", pass) : pass,"agent":"SRBMiner Cryptonight AMD GPU miner/1.6.8"}};
		remotesocket.write(JSON.stringify(request)+"\n");
		workerSettings[user].connected = true;
	});
	
	remotesocket.on('data', function(data) {

		if(data)logger.debug('received from pool ('+coin+'):'+data.toString().trim()+' ('+pass+')');

		let messages = data.toString().split('\n');
		let n = messages.length;
		for(let i = 0; i<n; i++) {
			if(messages[i].length == 0) continue;
			let request = JSON.parse(messages[i]);
			if(request.result && request.result.job)
			{
				if (!request.result.job.algo && workerSettings[user].algoList && workerSettings[user].activeCoin && workerSettings[user].activeCoin.algo) {
					request.result.job.algo = workerSettings[user].activeCoin.algo;
					if(firstConn && !request.result.extensions) request.result.extensions = [];
					if(request.result.extensions && Array.isArray(request.result.extensions) && !request.result.extensions.includes("algo")) request.result.extensions.push("algo"); 
				}

				//modernize algo negotiation during pass through
				//may disable and replace pass through if we encounter further problems
				if(request.result.job.algo && request.result.job.variant) {
					if(request.result.job.variant != "-1" && request.result.job.algo.indexOf("/") == -1) request.result.job.algo = request.result.job.algo + "/" + request.result.job.variant;
					delete (request.result.job.variant)
				}

				var mybuf = new  Buffer(request.result.job.target, "hex");
				poolDiff = diff2.div(BN(mybuf.reverse().toString('hex'),16)).toFixed(0);
				logger.info('login reply from '+coin+' ('+pass+') (diff: '+poolDiff+')');
				setWorker(request.result.id);
				if(!firstConn)
				{
					logger.info('  new job from login reply ('+pass+')');
					var job = request.result.job;
					request = {
									"jsonrpc":"2.0",
									"method":"job",
									"params":job
								};
				}
				firstConn=false;
			}
			else if(request.result && request.result.status === 'OK')
			{
				logger.info('    share delivered to '+coin+' '+request.result.status+' ('+pass+')');
			}
			else if(request.method && request.method === 'job')
			{
				var mybuf = new  Buffer(request.params.target, "hex");
				poolDiff = diff2.div(BN(mybuf.reverse().toString('hex'),16)).toFixed(0);
			
				if (!request.params.algo && workerSettings[user].algoList && workerSettings[user].activeCoin && workerSettings[user].activeCoin.algo) {
					request.params.algo = workerSettings[user].activeCoin.algo;
				}

				//modernize pass through - see notes above
				if(request.params.algo && request.params.variant) {
					if(request.params.variant != "-1" && request.params.algo.indexOf("/") == -1) request.params.algo = request.params.algo + "/" + request.params.variant;
					delete (request.params.variant)
				}

				logger.info('New Job from pool '+coin+' ('+pass+') (diff: '+poolDiff+')');
			}
			else if(request.method) 
			{
				logger.info(request.method+' (?) from pool '+coin+' ('+pass+')');
			}else{
				logger.info(data+' (else) from '+coin+' '+JSON.stringify(request)+' ('+pass+')');
			}

			localsocket.write(JSON.stringify(request)+"\n");
		}

	});
	
	remotesocket.on('close', function(had_error,text) {
		logger.info("pool conn to "+coin+" ended ("+pass+')');
		if(workerhashrates[user]) delete workerhashrates[user][pass];
		//to do: the following doesn't take into account that multipler workers can connect to a "user"
		workerSettings[user].connected = false;
		if(had_error) logger.error(' --'+text);
	});
	remotesocket.on('error', function(text) {
		logger.error("pool error "+coin+' ('+pass+')',text);
		
		//set pool dirty of happens multiple times
		//send share reject
		//switchEmitter.emit('switch',coin);
	});

	var poolCB = function(type,data){

		if(type === 'stop')
		{
			if(remotesocket) remotesocket.end();
			logger.info("stop pool conn to "+coin+' ('+pass+')');
		}
		else if(type === 'push')
		{
			if(data.method && data.method === 'submit') 
			{
				shares+=poolDiff/1000;
				
				const now = ((new Date).getTime())/1000;
				const rate = shares / (now-connectTime);

				if(!workerhashrates[user]) workerhashrates[user]={};

				workerhashrates[user][pass]={time:now,hashrate:rate};

				logger.info('   HashRate:'+((rate).toFixed(2))+' kH/s');
			}
			remotesocket.write(JSON.stringify(data)+"\n");
		}
	}

	return poolCB;
};

function createResponder(localsocket,user,pass,diffRequest,algoList,algoPerf){

	if(!workerSettings[user]) {
		logger.error(user + " configuration not found.");
		return;
	}

	var myWorkerId;

	var connected = false;
	var suppressErrors = false;
	//ToDo: The following needs to be re-considered for proper assessment of active connection
	workerSettings[user].connected = false;

	var idCB = function(id){
		logger.info(' set worker response id to '+id+' ('+pass+')');
		myWorkerId=id;
		connected = true;
	};

	workerSettings[user].algoList = algoList;
	workerSettings[user].algoPerf = algoPerf;

	ProcessAlgoList(user);

	var poolCB;

	var switchCB = function(newcoin,newuser,auto,firstTime = false){
		if (user!==newuser) return;

		logger.info('-- ' + (auto ? "Auto " : "") + 'switch '+user+' to '+newcoin+' ('+pass+')');

		connected = false;
		workerSettings[user].connected = false;
		
		if (poolCB) poolCB('stop');
		poolCB = attachPool(localsocket,newcoin,firstTime,idCB,user,pass,diffRequest);

		if(!firstTime && workerSettings[user].UIset.usePushMessaging)
			pusher.pushnote(`${user} ${auto ? "auto" : ""} coin switch`, `Switched to ${newcoin}\n${(new Date()).toLocaleString()}`);
	};
	let activeCoin = workerSettings[user].activeCoin || workerSettings[user].coins.filter((c) => c.isdefault)[0];
	switchCB(activeCoin && activeCoin.symbol || config.default,user,false,true);

	switchEmitter.on('switch',switchCB);

	var callback = function(type,request){
	
		if(type === 'kill')
		{
			poolCB('stop');
			logger.info('kill local socket and disconnect from pool ('+pass+')');
			switchEmitter.removeListener('switch', switchCB);
			suppressErrors = true;
			let responderIndex = workerResponders[user][pass].indexOf(callback);
			if (responderIndex > -1) workerResponders[user][pass].splice(responderIndex, 1);
			localsocket.destroy();
		} else if(type === 'stop')
		{
			poolCB('stop');
			logger.info('disconnect from pool ('+pass+')');
			let responderIndex = workerResponders[user][pass].indexOf(callback);
			if (responderIndex > -1) workerResponders[user][pass].splice(responderIndex, 1);
			switchEmitter.removeListener('switch', switchCB);
		} else if(type === 'state') {
			return {"suppressErrors": suppressErrors}
		}
		else if(request.method && request.method === 'submit') 
		{
			request.params.id=myWorkerId;
			logger.info('  Got share from worker ('+pass+')');
			
			//var mybuf = new  Buffer(request.params.result, "hex");


			//logger.warn(mybuf);
			//var hashArray = mybuf;
			//var hashNum = bignum.fromBuffer(hashArray.reverse());
			//var hashDiff = diff1.div(hashNum);
			//logger.warn(hashDiff);


			if(connected) poolCB('push',request);
		}else{
			logger.info(request.method+' from worker '+JSON.stringify(request)+' ('+pass+')');
			if(connected) poolCB('push',request);
		}
	}

	return callback;
};

const workerserver = net.createServer(function (localsocket) {
	
	workerserver.getConnections(function(err,number){
		logger.info(">>> connection #%d from %s:%d",number,localsocket.remoteAddress,localsocket.remotePort);
	});

	var responderCB;

	localsocket.on('data', function (data) {
		
		if(data) logger.debug('received from worker ('+localsocket.remoteAddress+':'+localsocket.remotePort+'):'+data.toString().trim());
		var request = JSON.parse(data);


		if(request.method === 'login')
		{
			logger.info('got login from worker %s %s',request.params.login,request.params.pass);
			let existingResponder, matchDiffPattern, diffRequest = null,
				login = request.params.login,
				pass = request.params.pass || "unspecified";

			if (matchDiffPattern = login.match(/(.+)([.+])(\d+)(([.+].*)|$)/)) {
				login = matchDiffPattern[1];
				diffRequest = matchDiffPattern[3];
			}

			if(!workerResponders[login]) workerResponders[login] = {};
			if(!workerResponders[login][pass])  workerResponders[login][pass] = []
		
			if(workerSettings[login].algoList && workerSettings[login].algoList.length > 1 && (existingResponder = workerResponders[login][pass].pop())) {
				logger.warn('Existing connection for the same worker detected - worker:' + pass);
				logger.warn('Killing old connection for '+ pass +' - if this is a separate worker, please specify a different password in miner\'s pool settings');
				existingResponder('kill');
			}
			workerResponders[login][pass].push(responderCB = createResponder(localsocket, login, pass, diffRequest, request.params.algo || null, request.params["algo-perf"] || null));
		}else{
			if(!responderCB)
			{
				logger.warn('something before login '+JSON.stringify(request));
			}
			else
			{
				responderCB('push',request);
			}
		}
	});
	
	localsocket.on('error', function(text) {
		let suppressErrors = responderCB && responderCB("state").suppressErrors;

		if(!suppressErrors) logger.error("worker error ",text);

		if(!responderCB)
		{
			logger.error('error before login');
		}
		else
		{
			responderCB('stop');
		}
	});

	localsocket.on('close', function(had_error) {
		let suppressErrors = responderCB && responderCB("state").suppressErrors;
		if(had_error && !suppressErrors) {
			logger.error(had_error);
		} else {
			workerserver.getConnections(function(err,number){
				logger.info("worker connection ended - connections left:"+number);
			});
		} 
	
		if(!responderCB)
		{
			logger.warn('close before login');
		}
		else
		{
			responderCB('stop');
		}
	});

});

workerserver.listen(localport);

logger.info("start mining proxy on port %d ", localport);

io.on('connection', function(socket){
	
	//var timeoutObj;

	socket.on('reload',function(user) {
		EvaluateConfig();
		InitializeCoins();

		pusher.apiToken = config.pushbulletApiToken;
		pusher.timeFrameMins = config.joinpushmessageswithinXminutes;

		socket.emit('uiupdate', {runtimesettings: runTimeSettings});

		if(user) respondToUser(user);

		logger.info("pool config reloaded");
	});

	socket.on('getruntimesettings',function(user) {
		socket.emit('uiupdate', {runtimesettings: runTimeSettings});
		if(pools[user]) respondToUser(user);
	});

	socket.on('user',respondToUser);

	socket.on('requestupdate', updateUI);

	function respondToUser(user) {
		//if(timeoutObj) clearTimeout(timeoutObj);

		if(workerSettings[user]) {
			socket.emit('uiupdate', {
				user: user,
				coins: workerSettings[user].coins,
				active: workerSettings[user].activeCoin && workerSettings[user].activeCoin.symbol,
				workers: {
					list: workerhashrates[user]||{},
					servertime:	((new Date).getTime())/1000
					},
				uiset: workerSettings[user].UIset
			});

			if(workerSettings[user].activeCoin) {
				logger.info('-> current for '+user+': ' + workerSettings[user].activeCoin.symbol);
			} else {
				logger.info('-> current for '+user+': not set');
			}


			var promiseChain = [];
			for (let coin of workerSettings[user].coins) {
				let mergedcoin = coin;
				while (mergedcoin) {
					promiseChain.push(mergedcoin.FetchMarketValue(), mergedcoin.FetchNetworkDetails());
					mergedcoin = mergedcoin.mergewith;
				}
			}
			Promise.all(promiseChain).then(() => socket.emit('uiupdate', {user: user, coinsupdate: workerSettings[user].coins})).catch((error) => (console.log(error)));
			
			//timeoutObj = setTimeout(updateUI, 4000, user);
		} else {
			logger.info(user + ': Not found!');
			socket.emit('usererror', "User Not Found!");
		}
	}

	async function updateUI(user) {
		var promiseChain = [];
		for (let coin of workerSettings[user].coins) {
			promiseChain.push(coin.FetchMarketValue(), coin.FetchNetworkDetails());
		}
		await Promise.all(promiseChain).catch((error) => console.log(error));

		let activeCoin = workerSettings[user].activeCoin || workerSettings[user].coins.filter((c) => c.isdefault)[0];
	
		socket.emit('uiupdate', {
			user: user,
			active: activeCoin && activeCoin.symbol || config.default,
			connectionstatus: (workerSettings[user].connected) ? "Connected" : "Disconnected",
			workers: {
				list: workerhashrates[user]||{},
				servertime:	((new Date).getTime())/1000
				},
			coinsupdate: workerSettings[user].coins
		});
	}


	socket.on('switch', function(user, coinidx) {
		let targetCoin = workerSettings[user].coins.filter(c => c.symbol == coinidx)[0];
		if (workerSettings[user].activeCoin && targetCoin && targetCoin.symbol == workerSettings[user].activeCoin.symbol) return;
		if (!targetCoin.minersupport) {
			socket.emit('usererror', `Miner does not support algo for coin ${targetCoin.symbol}.`);
			return;
		}
		workerSettings[user].activeCoin = workerSettings[user].coins.filter((c) => c.symbol === coinidx)[0];

		switchEmitter.emit('switch',coinidx, user, false);
	});

	socket.on('disconnect', function(reason){
		//if(timeoutObj) clearTimeout(timeoutObj);
	});

	socket.on('setruntimesetting', function(settingproperty, value, user) {
		workerSettings[user].UIset[settingproperty] = value;
		logger.info(user + " setting " + settingproperty + " changed to " + value);

		switch(settingproperty) {
			case "autoCoinSwitch":
				if (workerSettings[user].coinswitchtimeout) clearTimeout(workerSettings[user].coinswitchtimeout);
				if (workerSettings[user].UIset.autoCoinSwitch && config.EvaluateSwitchEveryXMinutes > 0) {
					workerSettings[user].coinswitchtimeout = setTimeout(EvaluateCoinSwitch, (config.MineCoinForAtLeastXMinutes || config.EvaluateSwitchEveryXMinutes) * 60 * 1000, user)
				};
				break;
		}
	} );

});


function EvaluateConfig() {
	config = JSON.parse(stripjson(fs.readFileSync('config.json',"utf8")));
	algomapping = JSON.parse(stripjson(fs.readFileSync('algomapping.json',"utf8")));
	pools = config.pools;
}

function InitializeCoins() {
	runTimeSettings.userList = Object.keys(pools),
	runTimeSettings.userList.map((username) => {
		let activeCoinIDX = null, existingAlgoList = null, existingAlgoPerf = null;
		
		if(workerSettings[username]) {
			activeCoinIDX = workerSettings[username] && workerSettings[username].activeCoin && workerSettings[username].activeCoin.symbol;
			existingAlgoList =  workerSettings[username].algoList;
			existingAlgoPerf =  workerSettings[username].algoPerf;
			if (workerSettings[username].coinswitchtimeout) clearTimeout(workerSettings[username].coinswitchtimeout);
		}

		workerSettings[username] = {
			coins: [],
			activeCoin: null,
			algoList: existingAlgoList,
			algoPerf: existingAlgoPerf,
			UIset: {autoCoinSwitch: false}
		};

		// This is separately handled as a missing key will hide the setting in UI, by design
		if (config.pushbulletApiToken) {
			workerSettings[username].UIset.usePushMessaging = true;
		};

		for (var poolid in pools[username]) {
			let mergecoin = pools[username][poolid], merged, topcoin, coin;

			while (mergecoin) {
				merged = new coinMethods.Coin(mergecoin.symbol, mergecoin.coinname || mergecoin.symbol, (topcoin && topcoin.algo) || mergecoin.algo || null, mergecoin.name.split(/[.+]/)[0], mergecoin.url, mergecoin.api, mergecoin.ticker && {
					priceapi: mergecoin.ticker.priceapi || "tradeogre",
					marketname: mergecoin.ticker.marketname,
					converttobtc: mergecoin.ticker.converttobtc,
					pricetype: mergecoin.ticker.pricetype || "sell",
					price: mergecoin.ticker.price,
				}, (topcoin) ? false : mergecoin.isdefault, (topcoin && topcoin.hashrate) || mergecoin.hashrate || 0);

				if (!topcoin) { topcoin = coin = merged; } else { coin.mergewith = merged; coin = merged} 

				mergecoin = mergecoin.mergewith;
			}

			workerSettings[username].coins.push(topcoin);
		}

		workerSettings[username].activeCoin = activeCoinIDX && workerSettings[username].coins.filter(c => c.symbol == activeCoinIDX)[0] || null;

		ProcessAlgoList(username);
	});

	pusher.ApiToken = config.pushbulletApiToken;
	
}

async function EvaluateCoinSwitch(user) {
	if (workerSettings[user].coinswitchtimeout) clearTimeout(workerSettings[user].coinswitchtimeout);
	let switchpenaltymultiplier = (config.EvaluateSwitchEveryXMinutes > 0)
			? 1 - (config.AlgoSwitchDownTimeSeconds || 0) / ((config.MineCoinForAtLeastXMinutes || config.EvaluateSwitchEveryXMinutes) * 60)
			: 1;

	let candidateCoin = await coinMethods.getPreferredCoin(workerSettings[user].coins.filter((c)=> c.minersupport), workerSettings[user].activeCoin, switchpenaltymultiplier);

	if (workerSettings[user].UIset.autoCoinSwitch && candidateCoin) {
		if (!workerSettings[user].activeCoin || candidateCoin.symbol !== workerSettings[user].activeCoin.symbol) {
			switchEmitter.emit('switch', candidateCoin.symbol, user, true);
			workerSettings[user].coinswitchtimeout = setTimeout(EvaluateCoinSwitch, (config.MineCoinForAtLeastXMinutes || config.EvaluateSwitchEveryXMinutes) * 60 * 1000, user);
		} else {
			workerSettings[user].coinswitchtimeout = setTimeout(EvaluateCoinSwitch, config.EvaluateSwitchEveryXMinutes * 60 * 1000, user);
			logger.info("Evaluated coins, " + workerSettings[user].activeCoin.symbol + "still optimal for mining.");
		}
	}
}

function ProcessAlgoList(username) {
	let algoList, algoPerf;
	if (algoList = workerSettings[username].algoList) {
		for (let coin of workerSettings[username].coins) {
			/* normalize user configurations */
			coin.algo = coin.algo && algomapping[coin.algo] || coin.algo;
			coin.minersupport = false;
		}
		for (let algo of algoList)
			{
				/* Re-adjust algo names in coins to miner's standard so proxy can talk back the way miner understands */
				workerSettings[username].coins.filter((c) => c.algo && c.algo == algomapping[algo]).map((c)=> c.algo = algo);
				workerSettings[username].coins.filter((c) => c.algo == algo).map((c) => c.minersupport = true);
			}
	}

	/* User MoneroOcean/SRB hashrate stratum extension to fill hashrates if not defined by user - Fixed*/
	if(algoPerf = workerSettings[username].algoPerf) {
		for (let algo of Object.keys(algoPerf)) workerSettings[username].coins.filter((c) => c.algo == algo).map((c) => c.hashrate = c.hashrate || algoPerf[algo] || 1);
	}
}
