'use strict';

const
    packageInf = require('./package'),
    IRC = require('irc-framework'),
    colors = require('irc-colors'),
    config = require('./config'),
	stream = require('./stream'),
    nedb = require('nedb'),
    host = config.irc.host,
    port = config.irc.port,
    nick = config.irc.nick,
    tls = config.irc.tls,
    pass = config.irc.pass,
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
    commands = [],
    bot = new IRC.Client();
    
bot.on('error', function(err) {
    console.log(err);
});

bot.on('connected', function() {
    let db = new nedb(config.nedb);
    config.irc.channels.forEach( channel => {
        bot.join(channel);
    });
    stream.startStream(db);
});

function unescape(char) {
    return htmlMap[char];
}

function sendTweet(to,text,username,date,retweets,favorites,isQuote,quotedUsername,quotedText){
    let message = null;
    if ( !isQuote ) {
        message = `\
${colors.teal(text)} · by ${username} \
on ${new Date(date).toLocaleTimeString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${retweets.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${favorites.toLocaleString('en-us')}`)}`;
        if (message.length > 350){
            bot.say(to,`${colors.teal(text)}`);
            bot.say(to,`by ${username} on ${new Date(date).toLocaleTimeString('en-us', dateOptions)} ·${colors.green(` ♻ ${retweets.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${favorites.toLocaleString('en-us')}`)}`);
        } else {
            bot.say (to,message);
        }
    } else {
        message = `\
${colors.teal(text)} · by ${username} \
on ${new Date(date).toLocaleDateString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${retweets.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${favorites.toLocaleString('en-us')}`)} \
Quoting @${quotedUsername}: ${colors.teal(quotedText)}`;
        if (message.length > 350) {
            bot.say(to,`${colors.teal(text)}`);
            bot.say(to,`by ${username} \
on ${new Date(date).toLocaleDateString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${retweets.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${favorites.toLocaleString('en-us')}`)}`);
            bot.say(to,`Quoting @${quotedUsername}: ${colors.teal(quotedText)}`);
        } else {
            bot.say(to,message);
        }
    }
}

exports.sayToChannel = function(channel,message) {
    bot.say(channel,message);
};

function follow (event) {
    let
        removeIndex = null,
        handle = null,
        to = null,
        oauth = {
            'consumer_key': config.twitter.consumerKey,
            'consumer_secret': config.twitter.consumerSecret,
            'token': config.twitter.token,
            'token_secret': config.twitter.token_secret,
        },
        url = 'https://api.twitter.com/1.1/users/show.json',
        db = new nedb(config.nedb);

    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            handle = command.handle;
            let qs = { "screen_name" : handle };
            to = command.channel;
            removeIndex = index;
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '@' || event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(event.host) != -1 )) {
                // IRC USER HAS OPER OR MORE                 
                    request.get({url, oauth, qs, 'json':true}, function(err, r, result) {
                        if ( err ) {
                            bot.say(to,`Error: ${err}`);
                            throw Error(err);
                        }
                        if ( !result.errors && result ) {
                            // add twitter ID
                            // see if it doesn't exist already
                            let doc = { 'channel': to, 'ids': [ result.id_str ] };
                            db.find({ 'channel': to }, function (err, following) {
                                if (!following[0]) {
                                    db.insert(doc, function(err) {
                                        if (err) {
                                            bot.say(to,err);
                                        }
                                        bot.say(to,`Now following ${result.name} in ${to}!`);
                                        stream.endStream();
                                    });
                                } else {
                                    if (following[0].ids && following[0].ids.indexOf(result.id_str) == -1) {
                                        following[0].ids.push(result.id_str);
                                        db.update({ 'channel': to }, { $set : { 'ids': following[0].ids } }, function(err) {
                                            if (err) {
                                                bot.say(to,err);
                                            }
                                            bot.say(to,`Now following ${result.name} in ${to}`);
                                            stream.endStream();
                                        });
                                    } else {
                                        bot.say(to,`Already following ${result.name} in ${to}!`);
                                    }
                                }
                            });
                        } else {
                            bot.say(to,'Tweeter handle not found!.');
                        }
                    });
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.say(event.nick, 'You need AOP (@) access or more to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function unfollow (event) {
    let
        removeIndex = null,
        handle = null,
        to = null,
        oauth = {
            'consumer_key': config.twitter.consumerKey,
            'consumer_secret': config.twitter.consumerSecret,
            'token': config.twitter.token,
            'token_secret': config.twitter.token_secret,
        },
        url = 'https://api.twitter.com/1.1/users/show.json',
        db = new nedb(config.nedb);

    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            handle = command.handle;
            let qs = { "screen_name" : handle };
            to = command.channel;
            removeIndex = index;
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '@' || event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(event.host) != -1 )) {
                // IRC USER HAS OPER OR MORE
                request.get({url, oauth, qs, 'json':true}, function(err, r, result) {
                    if (err) {
                        bot.say(to,`Error: ${err}`);
                        throw Error(err);
                    }
                    if (!result.errors && result) {
                        db.find({ 'channel': to }, function (err, following) {
                            if (following[0] && following[0].ids.indexOf(result.id_str) != -1) {
                                following[0].ids.splice(following[0].ids.indexOf(result.id_str),1);
                                db.update({ 'channel': to }, { $set : { 'ids': following[0].ids } }, function(err) {
                                    if (err) {
                                        bot.say(to,err);
                                    }
                                    bot.say(to,`Unfollowed ${result.name} in ${to}!`);
                                    stream.endStream();
                                });
                            } else {
                                bot.say(to,`Not following ${result.name} in ${to}!`); 
                            }
                        });
                    } else {
                        bot.say(to,'Twitter handle not found!.');
                    }
                });
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.say(event.nick, 'You need AOP (@) access or more to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

bot.on('message', function(event) {
    let
        from=event.nick,
        ident=event.ident,
        hostname=event.hostname,
        message=event.message,
        to=event.target;
    // if message is a valid .ut XXXXX string
    if (config.irc.ignoreHostnames.indexOf(hostname) ===-1 && config.irc.ignoreNicks.indexOf(from) === -1 && config.irc.ignoreIdents.indexOf(ident) === -1) {
        if (message.match(/^\.ut\s.+$/)) {
            // if message is .ut info
            if (message.match(/^\.ut\sinfo$/)) {

                if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                    let
                        oauth = {
                            'consumer_key': config.twitter.consumerKey,
                            'consumer_secret': config.twitter.consumerSecret,
                            'token': config.twitter.token,
                            'token_secret': config.twitter.token_secret,
                        },
                        url = 'https://api.twitter.com/1.1/users/show.json',
                        qs = {
                            'screen_name': 'underdoge_',
                            'user_id': '238260357',
                        };

                    request.get({url, oauth, qs, 'json':true}, function(err, r, user) {
                        if (err) {
                            bot.say(to,`Error: ${err}`);
                            throw Error(err);
                        }
                        bot.say(to,`Auth working! User: ${user.name} | Description: ${user.description}`);
                    });

                } else // No auth data, ask user to authenticate bot
                    bot.say(to,'No auth data.');

            } else
            // if message is .ut @useraccount
            if (message.match(/^\.ut\s@\w+$/)) {
                // get that account's last tweet
                if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                    let
                        oauth = {
                            'consumer_key': config.twitter.consumerKey,
                            'consumer_secret': config.twitter.consumerSecret,
                            'token': config.twitter.token,
                            'token_secret': config.twitter.token_secret,
                        },
                        account = message.slice(message.search(/@/)+1),
                        url = 'https://api.twitter.com/1.1/statuses/user_timeline.json',
                        qs = {
                            'screen_name': account,
                            'count': 1,
                            'tweet_mode': 'extended',
                        };
                    
                    request.get({url, oauth, qs, 'json':true}, function(err, r, result) {
                        if (err) {
                            bot.say(to,`Error: ${err}`);
                            throw Error(err);
                        }
                        if (result[0]) {
                            // remove \n from text result
                            if (result[0].retweeted_status) {
                                result[0].favorite_count = result[0].retweeted_status.favorite_count;
                                result[0].full_text = `RT @${result[0].retweeted_status.user.screen_name}: ${result[0].retweeted_status.full_text}`;
                            }
                            result[0].text = result[0].full_text.replace(/\n/g, ' ');
                            htmlKeys.forEach( curr => {
                                result[0].text = result[0].text.replace(new RegExp(curr,'g'),unescape(curr));
                            });
                            sendTweet(to,result[0].text,result[0].user.name,result[0].created_at,result[0].retweet_count,result[0].favorite_count,false,null,null);
                        } else
                            bot.say(to,`No results for @${account}!.`);
                    });

                } else // No auth data, ask user to authenticate bot
                    bot.say(to,'No auth data.');
            } else
            // general search
            if (message.match(/^\.ut\s.+$/)) {
                if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                    let
                        oauth = {
                            'consumer_key': config.twitter.consumerKey,
                            'consumer_secret': config.twitter.consumerSecret,
                            'token': config.twitter.token,
                            'token_secret': config.twitter.token_secret,
                        },
                        sq = message.slice(4),
                        url = 'https://api.twitter.com/1.1/search/tweets.json',
                        qs = {
                            'q': sq,
                            'lang': 'en',
                            'count': 1,
                            'tweet_mode': 'extended',
                            // mixed results if no result_type is specified
                        };
                    request.get({url, oauth, qs, 'json':true}, function(err, r, result) {
                        if (err) {
                            bot.say(to,`Error: ${err}`);
                            throw Error(err);
                        }
                        if (result.statuses[0]) {
                            if (result.statuses[0].retweeted_status) {
                                result.statuses[0].favorite_count = result.statuses[0].retweeted_status.favorite_count;
                                result.statuses[0].full_text = `RT @${result.statuses[0].retweeted_status.user.screen_name}: ${result.statuses[0].retweeted_status.full_text}`;
                            }
                            result.statuses[0].text = result.statuses[0].full_text.replace(/\n/g, ' ');
                            htmlKeys.forEach( curr => {
                                result.statuses[0].text = result.statuses[0].text.replace(new RegExp(curr,'g'),unescape(curr));
                            });
                            sendTweet(to,result.statuses[0].text,result.statuses[0].user.screen_name,result.statuses[0].created_at,result.statuses[0].retweet_count,result.statuses[0].favorite_count,false,null,null);
                        } else {
                            // no results found by mixed search, searching now by popular tweets
                            qs.result_type='popular';
                            request.get({url, oauth, qs, 'json':true}, function(err, r, result) {
                                if (err) {
                                    bot.say(to,`Error: ${err}`);
                                    throw Error(err);
                                }
                                if (result.statuses[0]) {
                                    if (result.statuses[0].retweeted_status) {
                                        result.statuses[0].favorite_count = result.statuses[0].retweeted_status.favorite_count;
                                        result.statuses[0].full_text = `RT @${result.statuses[0].retweeted_status.user.screen_name}: ${result.statuses[0].retweeted_status.full_text}`;
                                    }
                                    result.statuses[0].text = result.statuses[0].full_text.replace(/\n/g, ' ');
                                    htmlKeys.forEach( curr => {
                                        result.statuses[0].text = result.statuses[0].text.replace(new RegExp(curr,'g'),unescape(curr));
                                    });
                                    sendTweet(to,result.statuses[0].text,result.statuses[0].user.screen_name,result.statuses[0].created_at,result.statuses[0].retweet_count,result.statuses[0].favorite_count,false,null,null);
                                } else
                                    bot.say(to,`No results for ${sq}!.`);
                            });
                        }
                    });
                } else // No auth data, ask user to authenticate bot
                        bot.say(to,'No auth data.');
            } else
                bot.say(to,'Invalid command.');
        } else
        // get twitter.com or t.co link
        if (message.match(/twitter\.com\/\w+\/status\/\d+/) || message.match(/twitter\.com\/i\/web\/status\/\d+/) || message.match(/t\.co\/\w+/)) {
            

            if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                if (message.match(/t\.co\/\w+/)) {
                    // message contains a t.co link
                    message=`https://${message.match(/t\.co\/\w+/)[0]}`;
                    request({'url':message,'headers': {'User-Agent': 'request'}},function(err,response) {
                        message=response.request.uri.href;
                        if (message.match(/twitter\.com\/\w+\/status\/\d+/)) {
                            // it is a valid twitter status url
                            let
                                id = message.slice(message.search(/\/\d+/)+1),
                                oauth = {
                                    'consumer_key': config.twitter.consumerKey,
                                    'consumer_secret': config.twitter.consumerSecret,
                                    'token': config.twitter.token,
                                    'token_secret': config.twitter.token_secret,
                                },
                                url = 'https://api.twitter.com/1.1/statuses/show.json',
                                qs = {
                                    id,
                                    'tweet_mode': 'extended',
				                };
                            
                            request.get({url, oauth, qs, 'json':true}, function(err, r, result) {
                                if (err) {
                                    bot.say(to,`Error: ${err}`);
                                    throw Error(err);
                                }
                                if (!result.errors && result) {
                                    result.text = result.full_text.replace(/\n/g, ' ');
                                    htmlKeys.forEach( curr => {
                                        result.text = result.text.replace(new RegExp(curr,'g'),unescape(curr));
                                    });
                                    sendTweet(to,result.text,result.user.name,result.created_at,result.retweet_count,result.favorite_count,false,null,null);
                                } else {
                                    bot.say(to,'No results for that tweet!.');
                                    
                                }
                            });
                        }
                    });
                    return;
                } else
                // message contains twitter.com status link
                if (message.match(/twitter\.com\/\w+\/status\/\d+/))
                    message=message.match(/twitter\.com\/\w+\/status\/\d+/)[0];
                else   
                    message=message.match(/twitter\.com\/i\/web\/status\/\d+/)[0];
                let
                    id = message.slice(message.search(/\/status\/\d+/)+8),
                    oauth = {
                        'consumer_key': config.twitter.consumerKey,
                        'consumer_secret': config.twitter.consumerSecret,
                        'token': config.twitter.token,
                        'token_secret': config.twitter.token_secret,
                    },
                    url = 'https://api.twitter.com/1.1/statuses/show.json',
                    qs = {
                        id,
                        'tweet_mode': 'extended',
                    };
                    
                request.get({url, oauth, qs, 'json':true}, function(err, r, result) {
                    if (err) {
                        bot.say(to,`Error: ${err}`);
                        throw Error(err);
                    }
                    if (!result.errors && result) {
                        result.text = result.full_text.replace(/\n/g, ' ');
                        htmlKeys.forEach( curr => {
                            result.text = result.text.replace(new RegExp(curr,'g'),unescape(curr));
                        });
                        if (result.quoted_status) {
                            result.quoted_status.text = result.quoted_status.full_text.replace(/\n/g,' ');
                            result.text = result.text.replace(/https:\/\/t\.co\/.+$/i,'').trimRight();
                            htmlKeys.forEach( curr => {
                                result.quoted_status.text = result.quoted_status.text.replace(new RegExp(curr,'g'),unescape(curr));
                            });
                            sendTweet(to,result.text,result.user.name,result.created_at,result.retweet_count,result.favorite_count,true,result.quoted_status.user.screen_name,result.quoted_status.text);
                        } else {
                            sendTweet(to,result.text,result.user.name,result.created_at,result.retweet_count,result.favorite_count,false,null,null);
                        }
                    } else {
                        bot.say(to,'No results for that tweet!.');
                    }
                });
                    
            } else // No auth data, ask user to authenticate bot
                    bot.say(to,'No auth data.');
        } else
        // if message is .help
        if (message.match(/^\.help$/)) {
            bot.say(from,'Usage:');
            setTimeout(function() { bot.say(from,'.ut @twitter_handle - retrieves the last tweet from that account.');},500);
            setTimeout(function() { bot.say(from,'.ut <search terms> - search for one or more terms including hashtags.');},500);
            setTimeout(function() { bot.say(from,'.following - show currently followed accounts in channel.');},500);
            setTimeout(function() { bot.say(from,'.follow @twitter_handle - follows the account in the channel.');},500);
            setTimeout(function() { bot.say(from,'.unfollow @twitter_handle - unfollows the account in the channel.');},500);
            setTimeout(function() { bot.say(from,'.help - this help message.');},500);
        } else
        if (message.match(/^\.bots$/)) {
            bot.say(to,`${config.irc.nick} [NodeJS], a Twitter bot for irc. Do .help for usage.`);
        } else
        if (message.match(/^\.source$/)) {
            bot.say(to,`${config.irc.nick} [NodeJS] :: ${colors.white.bold('Source ')} ${packageInf.repository}`);
        } else
        if ( message.match(/^\.follow\s@?\w+$/)) {
            // .follow command - add user ID to stream
            if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                var handle = null;
                if (message.match(/^\.follow\s@\w+$/))
                    handle = message.slice(message.search(/@\w+$/)+1);
                else
                    handle = message.slice(message.search(/\s\w+$/)+1);
                commands.push({'nick': from, 'handle': handle, 'channel': to});
                bot.whois(from,follow);
            } else // No auth data, ask user to authenticate bot
                bot.say(to,'No auth data.');
        } else
        if ( message.match(/^\.unfollow\s@?\w+$/)) {
            // .unfollow command - remove user ID from stream
            if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                var handle=null;
                if (message.match(/^\.unfollow\s@\w+$/))
                    handle = message.slice(message.search(/@\w+$/)+1);
                else
                    handle = message.slice(message.search(/\s\w+$/)+1);
                // add command to commands queue
                commands.push({'nick': from, 'handle': handle, 'channel': to});
                bot.whois(from, unfollow);
            } else // No auth data, ask user to authenticate bot
                bot.say(to,'No auth data.');
        } else
        if (message.match(/^\.following$/)) {
            let db = new nedb(config.nedb);

            if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {

                db.find({ 'channel': to }, function (err, following) {
                    if (following[0] && following[0].ids) {
                        let
                            following_ids = following[0].ids.toString(),
                            oauth = {
                                'consumer_key': config.twitter.consumerKey,
                                'consumer_secret': config.twitter.consumerSecret,
                                'token': config.twitter.token,
                                'token_secret': config.twitter.token_secret,
                            },
                            url = 'https://api.twitter.com/1.1/users/lookup.json',
                            qs = {
                                'user_id': following_ids,
                            };
                        request.post({url, oauth, qs, 'json':true}, function(err, r, result) {
                            if (err) {
                                bot.say(to,`Error: ${err}`);
                                throw Error(err);
                            }
                            if (!result.errors && result) {
                                let accounts=`${result[0].name} (@${result[0].screen_name})`;
                                result.forEach( function (current,index) {
                                    if (index>0)
                                        accounts+=`, ${current.name} (@${current.screen_name})`;
                                });
                                bot.say(to,`Following: ${accounts}.`);
                            } else {
                                bot.say(to,`Not following anyone in ${to} yet!.`);
                            }
                        });

                    } else {
                        bot.say(to,`Not following anyone in ${to} yet!.`); 
                    }
                });
            } else // No auth data, ask user to authenticate bot
                bot.say(to,'No auth data.');
        }
    }
});

bot.on('registered', function (){
    bot.say('nickserv','identify '+ pass);
})

bot.connect({host,port,tls,nick});
