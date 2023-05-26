'use strict';

const
    needle = require('needle'),
    colors = require('irc-colors'),
    config = require('./config'),
    twitter = require('./lib/twitter'),
	dateOptions = {
        'timeZone':'America/Mexico_City',
        'weekday': 'long', 'year': 'numeric', 'month': 'short',
        'day': 'numeric', 'hour': '2-digit', 'minute': '2-digit',
    },
    longDateOptions = {
        'timeZone':'America/Mexico_City',
        'weekday': 'long', 'year': 'numeric', 'month': 'short',
        'day': 'numeric', 'hour': '2-digit', 'minute': '2-digit', 'second': '2-digit'
    },
    htmlMap ={
        '&amp;': '&', '&lt;':'<', '&gt;':'>',
    },
    htmlKeys = ['&amp;', '&lt;', '&gt;'],
    rulesURL = config.twitter.rulesURL,
    streamURL = config.twitter.streamURL,
    token = config.twitter.bearer_token;

var
    STATUS_CODE = '',
    longwait = 960000,
    wait = 60000,
    channels = [],
    stream = null,
    message='',
    screen_names='',
    last_keepalive = null;

function getUnixTimeDifferenceKeepAlive(unixTime){
    let difference = Math.floor(Date.now()/1000) - unixTime;    
    return Math.floor(difference);
}

function getUnixTimeDifference(unixTime){
    let difference = unixTime - Math.floor(Date.now()/1000);    
    return Math.floor(difference/60);
}

function getLastKeepAlive () {
    return last_keepalive;
}

function setLastKeepAlive (keepalive) {
    last_keepalive = keepalive;
}

function unescape(char) {
    return htmlMap[char];
}

function getWait(){
    return wait;
}

function setWait(val){
    wait = val;
}

function getLongWait(){
    return longwait;
}

function setLongWait(val){
    longwait = getUnixTimeDifference(val);
}

function getStream() {
    return stream;
}

function setStream(val) {
    stream = val;
}

function getStatusCode() {
    return STATUS_CODE;
}

function setStatusCode(code) {
    STATUS_CODE = code;
}

function deleteFolowingRules (data){
    return new Promise (resolve => {
        needle.post(rulesURL, data, {headers: {"content-type": "application/json","authorization": `Bearer ${token}`}},(error,response) => {
           if (response.statusCode !== 200) {
                resolve(`No rules to delete`);
            } else {
                resolve(`Rules deleted successfully`);
            }
        });
    });
}

exports.endStream = () => {
    if (getStream()){
        getStream().end();
        getStream().abort();
    }
};

exports.updateChannels = (db) => {
    const allChannels = db.prepare("select * from channels");
    const arrayChannels = [];
    for (const channel of allChannels.iterate()){
        arrayChannels.push(channel.t_channel_name);
    }
    let following_nicks = [];
    channels = [];
    arrayChannels.forEach( (channel,index) => {
        channels.push([channel]);
        const following = db.prepare("select * from handles where t_channel_name = ?");
        let following_handles = [];
        for (const handle of following.iterate(channel)){
            following_handles.push(handle.t_handle_name);
        }
        channels[index].push(following_handles);
        if (following_handles.length > 0){
            following_handles.forEach((nick) => {
                if (following_nicks.indexOf(nick) === -1)
                    following_nicks.push(nick);
            });
        }
    });
}

exports.startStream = async (db,bot) => {
    //Get following rules
    console.log('Starting stream');
    let response = await needle('get', rulesURL, { headers: { "authorization": `Bearer ${token}`}});
    if (response.statusCode !== 200) {
        bot.say('#testing',`Get All Rules Error Code:${response.statusCode} \n Error:${response.body}`);
    } else { 
        let ids = null;
        if (response.body.meta.result_count == 0) {
            console.log("No rules to delete.");
        } else {
            console.log("Found some rules to delete");
            bot.say('#testing',`-Old following rules: ${JSON.stringify(response.body.data[0].value)} `);
            ids = response.body.data.map(rule => rule.id);
        }
        let data = {
            "delete": {
                "ids": ids
            }
        }
        //Delete following rules
        let rules = null;
        if (ids) {
                rules = await deleteFolowingRules(data);
        }
        const allChannels = db.prepare("select * from channels");
        const arrayChannels = [];
        for (const channel of allChannels.iterate()){
            arrayChannels.push(channel.t_channel_name);
        }
        let following_nicks = [],
            following_rule = null;
        channels = [];
        arrayChannels.forEach( (channel,index) => {
            channels.push([channel]);
            const following = db.prepare("select * from handles where t_channel_name = ?");
            let following_handles = [];
            for (const handle of following.iterate(channel)){
                following_handles.push(handle.t_handle_name);
            }
            channels[index].push(following_handles);
            if (following_handles.length > 0){
                following_handles.forEach((nick) => {
                    if (following_nicks.indexOf(nick) === -1)
                        following_nicks.push(nick);
                });
            }
        });
        if(following_nicks.length > 0){
            following_nicks.forEach( (nick,i)=> {
                if (i === 0){
                    following_rule = `from:${nick}`;
                } else {
                    following_rule = following_rule + ` OR from:${nick}`;
                }
            });
            const rules = [{
                'value': following_rule,
                'tag': 'following nicks'
            }];
            const data = {
                "add": rules
            };
            //Set following rules
            bot.say('#testing',`+New following rules: ${JSON.stringify(data.add[0].value)} `);
            response = await needle('post',rulesURL, data, { headers: {"content-type": "application/json","authorization": `Bearer ${token}`}});
            if (response.statusCode !== 201) {
                bot.say('#testing',`Set Rules Error Code:${response.statusCode} \n Error:${response.body}`);
            } else {
                let stream = null;
                console.log(`Following rule set: ${following_rule}`);
                if (getStream()){
                    getStream().abort();
                    getStream().removeAllListeners();
                    getStream().destroy();
                }
                setTimeout(() => {
                    stream = needle.get(streamURL, {
                        headers: {
                            "User-Agent": "v2FilterStreamJS",
                            "Authorization": `Bearer ${token}`
                        },
                        timeout: 20000
                    }).on('error', (error) => {
                        setLastKeepAlive(Math.floor(Date.now()/1000));
                        if (error.code == "ECONNRESET") {
                            setLongWait(response.headers["x-rate-limit-reset"]);
                            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error Code:${error.code} \n Error:${error}. Headers: x-rate-limit-limit=${ response.headers["x-rate-limit-limit"] } x-rate-limit-remaining=${response.headers[ "x-rate-limit-remaining"] } x-rate-limit-reset=${response.headers["x-rate-limit-reset"] }`);
                            bot.say('#testing',`Error in connection: "${error.code}". Headers: x-rate-limit-limit=${ response.headers["x-rate-limit-limit"] } x-rate-limit-remaining=${response.headers[ "x-rate-limit-remaining"] } x-rate-limit-reset=${response.headers["x-rate-limit-reset"] }.`);
                            exports.endStream(); 
                            exports.startStream(db,bot);
                        } else {
                            setLongWait(response.headers["x-rate-limit-reset"]);
                            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error Code:${error.code} \n Error:${error}. Headers: x-rate-limit-limit=${ response.headers["x-rate-limit-limit"] } x-rate-limit-remaining=${response.headers[ "x-rate-limit-remaining"] } x-rate-limit-reset=${response.headers["x-rate-limit-reset"] }. Next rate limit reset in ${getLongWait()} minutes.`);
                            bot.say('#testing',`Error in connection: "${error.code}". Headers: x-rate-limit-limit=${ response.headers["x-rate-limit-limit"] } x-rate-limit-remaining=${response.headers[ "x-rate-limit-remaining"] } x-rate-limit-reset=${response.headers["x-rate-limit-reset"] }. Restarting in ${getLongWait()} minutes.`);
                            exports.endStream();
                            setTimeout(() => { exports.startStream(db,bot)},(getLongWait()+2)*60*1000);
                        }
                    })
                    .on('timeout', () => {
                        console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Connection Timeout.`);
                        bot.say('#testing','Connection Timeout.');
                    })
                    .on('response', (response) => {
                        setLongWait(response.headers["x-rate-limit-reset"]);
                        if (response.statusCode != 200){
                            bot.say('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error in response, status code: ${response.statusCode}. Headers: x-rate-limit-limit=${ response.headers["x-rate-limit-limit"] } x-rate-limit-remaining=${response.headers[ "x-rate-limit-remaining"] } x-rate-limit-reset=${response.headers["x-rate-limit-reset"] }.`);
                            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error in response, status code: ${response.statusCode}. Headers: x-rate-limit-limit=${ response.headers["x-rate-limit-limit"] } x-rate-limit-remaining=${response.headers[ "x-rate-limit-remaining"] } x-rate-limit-reset=${response.headers["x-rate-limit-reset"] }.`);
                            exports.endStream();
                        } else {
                            bot.say('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stream started. Response OK, status code: ${response.statusCode}. Headers: x-rate-limit-limit=${ response.headers["x-rate-limit-limit"] } x-rate-limit-remaining=${response.headers[ "x-rate-limit-remaining"] } x-rate-limit-reset=${response.headers["x-rate-limit-reset"] }. Next rate limit reset in ${getLongWait()} minutes.`);
                            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stream started. Response OK, status code: ${response.statusCode}. Headers: x-rate-limit-limit=${ response.headers["x-rate-limit-limit"] } x-rate-limit-remaining=${response.headers[ "x-rate-limit-remaining"] } x-rate-limit-reset=${response.headers["x-rate-limit-reset"] }. Next rate limit reset in ${getLongWait()} minutes.`);
                            setWait(60000);
                        }
                        setStatusCode(response.statusCode);
                    })
                    .on('end', () => {
                        if (getStatusCode() == 200) {
                            bot.say('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Connection ended, restarting.`);
                            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Connection ended, restarting.`);
                            exports.endStream();
                            setTimeout(() => {exports.startStream(db,bot)},5*1000);
                        } else
                        if (getStatusCode() == 406) {
                            bot.say('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Not following any accounts yet.`);
                            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Not following any accounts yet.`);
                        } else
                        if (getStatusCode() == 420) {
                            bot.say('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] The client has connected too frequently or is reconnecting too fast. Retrying in ${getWait()/1000} seconds.`);
                            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] The client has connected too frequently or is reconnecting too fast. Retrying in ${getWait()/1000} seconds.`);
                            exports.endStream();
                            setTimeout(() => { exports.startStream(db,bot);},getWait());
                            setWait(2*getWait());
                        } else 
                        if (getStatusCode() == 429) {
                            bot.say('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] We are being rate limited. Retrying in ${ getLongWait()+1 } minutes.`);
                            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] We are being rate limited. Retrying in ${ getLongWait()+1 } minutes.`);
                            exports.endStream();
                            setTimeout(() => { exports.startStream(db,bot);},(getLongWait()+1)*60*1000);
                        } else
                        if (getStatusCode() == 503) {
                            bot.say('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Service Unavailable. A streaming server is temporarily overloaded. Retrying in 5 minutes`);
                            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Service Unavailable. A streaming server is temporarily overloaded. Retrying in 5 minutes`);
                            exports.endStream();
                            setTimeout(() => { exports.startStream(db,bot);},300000);
                        } else
                        if (getStatusCode() == 500) {
                            bot.say('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Server Error 500. Retrying in ${getWait()/1000} seconds.`);
                            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Server Error 500. Retrying in ${getWait()/1000} seconds.`);
                            exports.endStream();
                            setTimeout(() => { exports.startStream(db,bot);},getWait());
                            setWait(2*getWait());
                        } 

                    })
                    .on('data', async chunk => {
                        if (chunk != "\r\n") {
                            let tweet = JSON.parse(chunk);
                            if (tweet && tweet.data) {
                                let
                                    id = tweet.data.id,
                                    json = await twitter.getTweetById(id,bot);
                                if (json) {
                                    let author = await twitter.getTweetAuthorById(json.author_id,bot);
                                    channels.forEach((chan) => {
                                        try{
                                            screen_names = chan[1].toString().split(',');
                                        } catch (e) {
                                            console.log(`Channel: ${chan}`);
                                            console.log(`Error: ${e}`);
                                            screen_names = [];
                                        }
                                        screen_names.forEach(async (screen_name) => {
                                            //need to make call to make call to get tweet and insert in json variable
                                            if (screen_name == author.username) {
                                                htmlKeys.forEach( curr => {
                                                    json.text = json.text.replace(new RegExp(curr,'g'),unescape(curr));
                                                });
                                                if (json.referenced_tweets && json.referenced_tweets[0].type == "quoted") {
                                                    let quotted_tweet = await twitter.getTweetById(json.referenced_tweets[0].id,bot),
                                                        quotted_tweet_author = await twitter.getTweetAuthorById(quotted_tweet.author_id,bot);
                                                    json.text = json.text.replace(/https:\/\/t\.co\/.+$/i,'').trimRight();
                                                    htmlKeys.forEach( curr => {
                                                        quotted_tweet.text = quotted_tweet.text.replace(new RegExp(curr,'g'),unescape(curr));
                                                    });
                                                    message = `${colors.teal(json.text)} · by ${author.name} (@${author.username}) \
on ${new Date(json.created_at).toLocaleDateString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.public_metrics.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.public_metrics.like_count.toLocaleString('en-us')}`)} \
Quoting @${quotted_tweet_author.username}: ${colors.teal(quotted_tweet.text)}`;
                                            // check if message too long for IRC
                                                    if (message.length > 350) {
                                                        bot.say(chan[0],`${colors.teal(json.text)}`);
                                                        bot.say(chan[0],`by ${author.name} (@${author.username}) \
on ${new Date(json.created_at).toLocaleDateString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.public_metrics.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.public_metrics.like_count.toLocaleString('en-us')}`)}`);
                                                        bot.say(chan[0],`Quoting @${quotted_tweet_author.name}: ${colors.teal(quotted_tweet.text)}`);
                                                        return;
                                                    } else {
                                                        bot.say(chan[0],message);
                                                    }
                                                } else {
                                                    message = `${colors.teal(json.text)} · by ${author.name} (@${author.username}) \
on ${new Date(json.created_at).toLocaleTimeString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.public_metrics.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.public_metrics.like_count.toLocaleString('en-us')}`)}`;
                                                    if (message.length > 350) {
                                                        bot.say(chan[0],`${colors.teal(json.text)}`);
                                                        bot.say(chan[0],`by ${author.name} (@${author.username}) \
on ${new Date(json.created_at).toLocaleTimeString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.public_metrics.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.public_metrics.like_count.toLocaleString('en-us')}`)}`);
                                                return;
                                                    } else {
                                                        bot.say(chan[0],message);
                                                    }
                                                }
                                            }                                        
                                        });
                                    });
                                }
                            } else {
                                console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Non tweet data: ${tweet}}`);
                            }
                            // limit notices
                            if (tweet && tweet.limit) {
                                console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Limit notice: ${JSON.stringify(tweet.limit,null,'    ')}`);
                            }
                            // Withheld content notices
                            if (tweet && tweet.status_withheld) {
                                console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Withheld content notice: ${JSON.stringify(tweet.status_withheld,null,'    ')}`);
                            }
                            if (tweet && tweet.user_withheld) {
                                console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] User withheld notice: ${JSON.stringify(tweet.user_withheld,null,'    ')}`);
                            }
                            // Disconnect message
                            if (tweet && tweet.disconnect) {
                                console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Disconnect notice: ${JSON.stringify(tweet.disconnect,null,'    ')}`);
                            }
                            // Stall warning
                            if (tweet && tweet.warning) {
                                console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stall warning: ${JSON.stringify(tweet.warning,null,'    ')}`);
                            }
                        } else {
                            setLastKeepAlive(Math.floor(Date.now()/1000));
                            setTimeout(() => {
                                if (getUnixTimeDifferenceKeepAlive(getLastKeepAlive()) >= 60){
                                    bot.say('#testing',`[${new Date().toLocaleTimeString('en-us', longDateOptions)}] Stream stopped responding for 60 seconds, restarting.`);
                                    console.log(`[${new Date().toLocaleTimeString('en-us', longDateOptions)}] Stream stopped responding for 60 seconds, restarting.`);
                                    exports.endStream();
                                    setTimeout(() => { exports.startStream(db,bot);},1000);
                                } else {
                                    console.log(`[${new Date().toLocaleTimeString('en-us', longDateOptions)}] Keepalive within limits, time difference was ${getUnixTimeDifferenceKeepAlive(getLastKeepAlive())} seconds.`);
                                }
                            }, 60000);
                        }
                    });
                    setLastKeepAlive(Math.floor(Date.now()/1000));
                    setStream(stream);
                },10000);
            }
        } else {
            bot.say('#testing',`Not following anyone, no rules defined yet.`);
        }
    }
};
