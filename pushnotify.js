'use strict'
const pushbullet = require('pushbullet');

class pushnotify {
/**
 * @param {string} apiTokenString
 * @param {number} [maxMessagesPerHour]
 */
    constructor(apiTokenString, maxMessagesPerHour = 0) {
        /* type pushbullet */
        this.pusher = null;
        this.apiToken = apiTokenString;
        /**
         * @type string[]
         */
        this.messages = [];
        this.pushrestricttimeout = null;
        this.maxmessagesperhour = maxMessagesPerHour;
        this.messagesentduringhour = 0;
    }

    /**
     * @param {string} title
     * @param {string} message 
     */
    pushnote(title, message) {
        if(this.pusher) {
            if(this.pushrestricttimeout == null || !this.maxmessagesperhour || this.messagesentduringhour < this.maxmessagesperhour) {
                this.pusher.note({}, title, message, (error, response) => {if(error) console.log(`Pushbullet API: ${error}`)});
                if(this.maxmessagesperhour) {
                    ++this.messagesentduringhour;
                    this.pushrestricttimeout = this.pushrestricttimeout || setTimeout(this.pushAllQueuedMessages, 60 * 60 * 1000);
                }
            } else {
                this.messages.push({title: title, message: message});
            }

        }
    }

    /**
     * @param {string} title
     * @param {string} message 
     */
    warn(title, message) {
        if(this.pusher) {
            this.pusher.note({}, title, message, (error, response) => {if(error) console.log(`Pushbullet API: ${error}`)});
        }
    }

    get apiToken() {return _apiToken;}
    /**
     * @param {string} [token]
     */   
    set apiToken(token) {_apiToken = token; this.pusher = (apiToken) ? new pushbullet(apiToken) : null;}
}