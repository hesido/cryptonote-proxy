'use strict'
const pushbullet = require('pushbullet');

class pushnotify {
/**
 * @param {string} apiTokenString
 * @param {number} [maxMessagesPerTimeFrame]
 * @param {number} [timeFrameMinutes]
 */
    constructor(apiTokenString, MaxMessagesPerTimeFrame = 0, TimeFrameMinutes = 60) {
        /* type pushbullet */
        this.pusher = null;
        this.apiToken = apiTokenString;
        /**
         * @type string[]
         */
        this.messages = [];
        this.pushrestricttimeout = null;
        this.maxMessagesPerTimeFrame = MaxMessagesPerTimeFrame;
        this.messagesentduringtimeframe = 0;
        this.timeFrameMins = TimeFrameMinutes;
    }

    /**
     * @param {string} title
     * @param {string} message 
     */
    pushnote(title, message) {
        if (!this.pusher) return;
        if (this.pushrestricttimeout == null || this.messagesentduringtimeframe < this.maxMessagesPerTimeFrame) {
            this.pusher.note({}, title, message, (error, response) => {if(error) console.log(`Pushbullet API: ${error}`)});
            console.log(message);
            if (this.maxMessagesPerTimeFrame) {
                ++this.messagesentduringtimeframe;
                this.pushrestricttimeout = this.pushrestricttimeout || setTimeout(() => this.pushAllQueuedMessages(), this.timeFrameMins * 60 * 1000);
            }
        } else {
            this.messages.push({ "title": title, "body": message });
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

    pushAllQueuedMessages() {
        if(this.messages.length == 0) {
            this.messagesentduringtimeframe = 0;            
            return;
        }
        let message, combinedMessage = "", title = `${this.messages.length} messages since last notification`;
        while(message = this.messages.shift())
            combinedMessage += message.title + "\n" + message.body +"\n\n";
        this.pushrestricttimeout = null;
        this.pusher.note({}, title, combinedMessage, (error, response) => {if(error) console.log(`Pushbullet API: ${error}`)});
        this.messagesentduringtimeframe = 1;
    }

    get apiToken() {return this._apiToken;}
    /**
     * @param {string} [token]
     */   
    set apiToken(token) {this.pusher = (token && this.apiToken !== token) ? new pushbullet(token) : null; this._apiToken = token;}
}

module.exports = pushnotify;