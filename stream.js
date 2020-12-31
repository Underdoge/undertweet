'use strict';

const { get } = require('request');

const
    writableStream = require('stream'),
    irc = require('./irc'),
    colors = require('irc-colors'),
    config = require('./config'),
    nedb = require('nedb'),
	dateOptions = {
        'timeZone':'America/Mexico_City',
        'weekday': 'long', 'year': 'numeric', 'month': 'short',
        'day': 'numeric', 'hour': '2-digit', 'minute': '2-digit',
    },
    htmlMap ={
        '&amp;': '&', '&lt;':'<', '&gt;':'>',
    },
    htmlKeys = ['&amp;', '&lt;', '&gt;'];

var
    request = require('request'),
    STATUS_CODE = '',
    wait = 60000,
    following_ids = [],
    channels = [],
    stream = null,
    pipe = null,
    message='',
    json='',
    ids='',
    buffer='',
    bufferLength=0;

class streamReader extends writableStream.Writable {
    constructor(options) {
        super(options);
        this.result = '';
    }
    _write (data,encoding,callback) {
        if (data.indexOf('\n') != -1 && (data.indexOf('\n') != data.length-1)) {
            bufferLength = parseInt(data.slice(0,data.indexOf('\n')));
            buffer = data.slice(data.indexOf('\n') + 1);
        } else {
            buffer+=data;
        }
        if (buffer.length == bufferLength) {
            try {
                json = JSON.parse(buffer);
                if (json.text && !json.in_reply_to_screen_name) {
                    channels.forEach(function (chan) {
                        ids = chan[1].toString().split(',');
                        ids.forEach(function (id) {
                            if (id == json.user.id_str) {
                                if (json.retweeted_status) {
                                    if (json.retweeted_status.truncated){
                                        json.text = `RT @${json.retweeted_status.user.screen_name}: ${json.retweeted_status.extended_tweet.full_text}`;
                                    } else {
                                        json.text = `RT @${json.retweeted_status.user.screen_name}: ${json.retweeted_status.text}`;
                                    }
                                    json.favorite_count = json.retweeted_status.favorite_count;
                                    json.retweet_count = json.retweeted_status.retweet_count;
                                    
                                }
                                if (json.truncated){
                                    json.text = json.extended_tweet.full_text.replace(/\n/g,' ');    
                                } else {
                                    json.text = json.text.replace(/\n/g,' ');
                                }
                                htmlKeys.forEach( curr => {
                                    json.text = json.text.replace(new RegExp(curr,'g'),unescape(curr));
                                });
                                if (json.quoted_status) {
                                    if (json.quoted_status.truncated){
                                        json.quoted_status.text = json.quoted_status.extended_tweet.full_text.replace(/\n/g,' ');    
                                    } else {
                                        json.quoted_status.text = json.quoted_status.text.replace(/\n/g,' ');
                                    }
                                    json.text = json.text.replace(/https:\/\/t\.co\/.+$/i,'').trimRight();
                                    htmlKeys.forEach( curr => {
                                        json.quoted_status.text = json.quoted_status.text.replace(new RegExp(curr,'g'),unescape(curr));
                                    });
                                    message = `${colors.teal(json.text)} · by ${json.user.name} (@${json.user.screen_name}) \
on ${new Date(json.created_at).toLocaleDateString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.favorite_count.toLocaleString('en-us')}`)} \
Quoting @${json.quoted_status.user.screen_name}: ${colors.teal(json.quoted_status.text)}`;
                                    // check if message too long for IRC
                                    if (message.length > 350) {
                                        irc.sayToChannel(chan[0],`${colors.teal(json.text)}`);
                                        irc.sayToChannel(chan[0],`by ${json.user.name} (@${json.user.screen_name}) \
on ${new Date(json.created_at).toLocaleDateString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.favorite_count.toLocaleString('en-us')}`)}`);
                                        irc.sayToChannel(chan[0],`Quoting @${json.quoted_status.user.screen_name}: ${colors.teal(json.quoted_status.text)}`);
                                        return;
                                    } else {
                                        irc.sayToChannel(chan[0],message);
                                    }
                                } else {
                                    message = `${colors.teal(json.text)} · by ${json.user.name} (@${json.user.screen_name}) \
on ${new Date(json.created_at).toLocaleTimeString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.favorite_count.toLocaleString('en-us')}`)}`;
                                    if (message.length > 350) {
                                        irc.sayToChannel(chan[0],`${colors.teal(json.text)}`);
                                        irc.sayToChannel(chan[0],`by ${json.user.name} (@${json.user.screen_name}) \
on ${new Date(json.created_at).toLocaleTimeString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.favorite_count.toLocaleString('en-us')}`)}`);
                                        return;
                                    } else {
                                        irc.sayToChannel(chan[0],message);
                                    }
                                }
                            }                                        
                        });
                    });
                }
                // limit notices
                if (json.limit) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Limit notice: ${JSON.stringify(json.limit,null,'    ')}`);
                }
                // Withheld content notices
                if (json.status_withheld) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Withheld content notice: ${JSON.stringify(json.status_withheld,null,'    ')}`);
                }
                if (json.user_withheld) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] User withheld notice: ${JSON.stringify(json.user_withheld,null,'    ')}`);
                }
                // Disconnect message
                if (json.disconnect) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Disconnect notice: ${JSON.stringify(json.disconnect,null,'    ')}`);
                }
                // Stall warning
                if (json.warning) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stall warning: ${JSON.stringify(json.warning,null,'    ')}`);
                }
            } catch (e) {
                if (e instanceof SyntaxError) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Syntax Error trying JSON.parse buffer: ${buffer}`);
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error: ${e}`);
                } else {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Unexpected Error trying JSON.parse buffer: ${buffer}`);
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error: ${e}`);
                }
            }
            bufferLength = 0;
            buffer = '';
        }
        callback();
    }
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

function getStream() {
    return stream;
}

function setStream(val) {
    stream = val;
}

function getPipe() {
    return pipe;
}

function setPipe(val) {
    return pipe = val;
}

function getStatusCode() {
    return STATUS_CODE;
}

function setStatusCode(code) {
    STATUS_CODE = code;
}

exports.endStream = function() {
    if (getStream()){
        getStream().abort();
        getPipe().destroy();
    }
};

exports.startStream = function(db) {
    db.find({}, function (err, following) {
        channels = [];
        following.forEach(function (channel,index) {
            channels.push([channel.channel]);
            channels[index].push(channel.ids);
            channel.ids.forEach(function (id) {
                if (following_ids.indexOf(id) === -1)
                    following_ids.push(id);
            });
        });
        if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret && following_ids.length > 0) {
            let
                oauth = {
                    'consumer_key': config.twitter.consumerKey,
                    'consumer_secret': config.twitter.consumerSecret,
                    'token': config.twitter.token,
                    'token_secret': config.twitter.token_secret,
                },
                url = 'https://stream.twitter.com/1.1/statuses/filter.json',
                qs = {
                    'follow': following_ids.toString(),
                    'delimited': 'length',
                    'tweet_mode': 'extended',
                    'filter_level': 'none',
                },
                gzip = true,
                forever = true,
                r='',
                p = new streamReader();
            if (getStream()){
                getStream().abort();
                getPipe().destroy();
                getStream().removeAllListeners();
                getStream().destroy();
            }
            r = request.post({url, oauth, qs, gzip, forever});
            r.on('error', function (error) {
                console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}]Error Code:${error.code} \n Error:${error}`);
                irc.sayToChannel('#testing',`Error Code:${error.code} \n Error:${error}`);
            })
            .on('timeout', function() {
                console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Connection Timeout.`);
                irc.sayToChannel('#testing','Connection Timeout.');
            })
            .on('response', function(response) {
                if (response.statusCode != 200){
                    irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error in response, status code: ${response.statusCode}`);
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error in response, status code: ${response.statusCode}`);
                } else {
                    irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stream started. Response OK, status code: ${response.statusCode}`);
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stream started. Response OK, status code: ${response.statusCode}`);
                    setWait(60000);
                }
                setStatusCode(response.statusCode);
            })
            .on('end', function() {
                if (getStatusCode() == 200) {
                    irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Connection ended, restarting.`);
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Connection ended, restarting.`);
                    exports.startStream(new nedb(config.nedb));
                } else
                if (getStatusCode() == 406) {
                    irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Not following any accounts yet.`);
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Not following any accounts yet.`);
                } else
                if (getStatusCode() == 420) {
                    irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] The client has connected too frequently or is reconnecting too fast. Retrying in ${getWait()/1000} seconds.`);
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] The client has connected too frequently or is reconnecting too fast. Retrying in ${getWait()/1000} seconds.`);
                    setTimeout(function() { exports.startStream(new nedb(config.nedb));},getWait());
                    setWait(2*getWait());
                } else
                if (getStatusCode() == 503) {
                    irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Service Unavailable. A streaming server is temporarily overloaded. Retrying in 5 minutes`);
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Service Unavailable. A streaming server is temporarily overloaded. Retrying in 5 minutes`);
                    setTimeout(function() { exports.startStream(new nedb(config.nedb));},300000);
                } else
                if (getStatusCode() == 500) {
                    irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Server Error 500. Retrying in ${getWait()/1000} seconds.`);
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Server Error 500. Retrying in ${getWait()/1000} seconds.`);
                    setTimeout(function() { exports.startStream(new nedb(config.nedb));},getWait());
                    setWait(2*getWait());
                } 

            })
            .pipe(p);
            setPipe(p);
            setStream(r);
        } else {
            if (following_ids > 0) {
                console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stream not started. No auth info.`);
            } else
                console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stream not started. Not following any accounts yet.`);
        }
    });
};
