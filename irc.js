'use strict';

const
    joinImages = require("join-images"),
    needle = require('needle'),
    fs = require("fs"),
    packageInf = require('./package'),
    IRC = require('irc-framework'),
    colors = require('irc-colors'),
    config = require('./config'),
    stream = require('./streamv3'),
    path = require('path'),
    nedb = require('nedb'),
    host = config.irc.host,
    port = config.irc.port,
    nick = config.irc.nick,
    username = config.irc.nick,
    gecos = config.irc.nick,
    tls = config.irc.tls,
    password = config.irc.pass,
    dalleUrl = config.dalle.api_url,
    ghettyUrl = config.ghetty.url,
    twitterUrl = 'https://api.twitter.com/1.1/users/show.json',
    openAIAPIGenerationsUrl = config.openAI.api_generations_url,
    openAIAPIVariationsUrl = config.openAI.api_variations_url,
    openAIAPIToken = config.openAI.api_key,
    dateOptions = {
        'timeZone':'America/Mexico_City',
        'weekday': 'long', 'year': 'numeric', 'month': 'short',
        'day': 'numeric', 'hour': '2-digit', 'minute': '2-digit',
    },
    htmlMap ={
        '&amp;': '&', '&lt;':'<', '&gt;':'>',
    },
    htmlKeys = ['&amp;', '&lt;', '&gt;'],
    token = config.twitter.bearer_token,
    channels = [],
    options_horizontal = {
        direction:"horizontal",
        color: 0x00000000,
        align: 'left', 
        offset: 5
    },
    options_vertical = {
        direction:"vertical",
        color: 0x00000000,
        align: 'left', 
        offset: 5
    };

var
    commands = [],
    bot = new IRC.Client();

exports.sayToChannel = function(channel,message) {
    bot.say(channel,message);
};
    
function getEnabledModulesInChannel (channel) {
    return new Promise(resolve => {
        let db = new nedb(config.nedb);
        db.find({ 'channel': channel }, function (err, channels) {
            if (channels[0] && channels[0].modules)
                resolve(channels[0].modules);
            else
                resolve(false);
        });
    });
}

function isModuleEnabledInChannel (channel, module) {
    return new Promise(resolve => {
        let db = new nedb(config.nedb);
        db.find({ 'channel': channel }, function (err, channels) {
            if (channels[0] && channels[0].modules && channels[0].modules.indexOf(module) != -1)
                resolve(true);
            else
                resolve(false);
        });
    });
}

function unescape(char) {
    return htmlMap[char];
}

function sendSpace(to,title,state,started_at,host_ids,participant_count){
    let message = null;
    if (state == "live") {
    message = `\
Twitter Space "${colors.teal(title)}" is now live 🔴, \
started on ${new Date(started_at).toLocaleDateString('en-us', dateOptions)} \
and has ${colors.teal(`${participant_count.toLocaleString('en-us')}`)} participants.`;
    } else { 
    message = `\
Twitter Space "${colors.teal(title)}" has ended, \
started on ${new Date(started_at).toLocaleDateString('en-us', dateOptions)} \
and had ${colors.teal(`${participant_count.toLocaleString('en-us')}`)} participants.`;
    }
    bot.say (to,message);
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

function deleteImages(to){
    if(fs.existsSync(path.join(__dirname,'images',to,'dall-e_result_0.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'dall-e_result_0.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'dall-e_result_1.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'dall-e_result_1.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'dall-e_result_2.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'dall-e_result_2.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'dall-e_result_3.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'dall-e_result_3.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'dall-e_result_4.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'dall-e_result_4.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'dall-e_result_5.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'dall-e_result_5.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'dall-e_result_6.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'dall-e_result_6.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'dall-e_result_7.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'dall-e_result_7.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'dall-e_result_8.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'dall-e_result_8.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'row1.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'row1.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'row2.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'row2.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'row3.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'row3.jpg'));
    if(fs.existsSync(path.join(__dirname,'images',to,'dalle.jpg')))
        fs.unlinkSync(path.join(__dirname,'images',to,'dalle.jpg'));
}

function deleteOpenAIImage(to){
    if(fs.existsSync(path.join(__dirname,'openaiimages',to,'variation.png')))
    fs.unlinkSync(path.join(__dirname,'openaiimages',to,'variation.png'));
    if(fs.existsSync(path.join(__dirname,'openaiimages',to,'openaidalle_0.png')))
    fs.unlinkSync(path.join(__dirname,'openaiimages',to,'openaidalle_0.png'));
    if(fs.existsSync(path.join(__dirname,'openaiimages',to,'openaidalle_1.png')))
    fs.unlinkSync(path.join(__dirname,'openaiimages',to,'openaidalle_1.png'));
    if(fs.existsSync(path.join(__dirname,'openaiimages',to,'openaidalle_2.png')))
    fs.unlinkSync(path.join(__dirname,'openaiimages',to,'openaidalle_2.png'));
    if(fs.existsSync(path.join(__dirname,'openaiimages',to,'openaidalle.jpg')))
    fs.unlinkSync(path.join(__dirname,'openaiimages',to,'openaidalle.jpg'));
}

function postImage(to,from,prompt){
    let data = {
            image:{
                file: path.join(__dirname,'images',to,'dalle.jpg'),
                content_type: 'image/jpeg'
            }
        },
        options = {
            multipart:true,
            json:true
        };
    needle.post(ghettyUrl, data, options, function(error, response, body) {
        if (!error && response.statusCode == 200){
            bot.say(to,`@${from} here you go: "${prompt}" ${body.href}`);
        } else {
            bot.say(to,`Ghetty error ${response.statusCode}: ${error}!.`);
        }
    });
    channels[to].running = false;
}

function getImageURL (data,options) {
    return new Promise ( resolve => {
        needle.post(ghettyUrl, data, options, function(error, response, body) {
            if (!error && response.statusCode == 200){
                resolve(body.href);
            } else {
                bot.say(to,`Ghetty error ${response.statusCode}: ${error}!.`);
            }
        });
    });
}

async function postOpenAIImage(to,from,prompt){
    let data = null,
        url = "",
        options = {
            multipart:true,
            json:true
        };
    data = {
        image:{
            file: path.join(__dirname,'openaiimages',to,`openaidalle.jpg`),
            content_type: 'image/jpg'
        }
    };
    url = await getImageURL(data, options);
    bot.say(to,`@${from} here you go "${prompt}": ${url}`);
    channels[to].openairunning = false;
}

async function postOpenAIImageVariation(to,from){
    let data = null,
        url = "",
        options = {
            multipart:true,
            json:true
        };
    data = {
        image:{
            file: path.join(__dirname,'openaiimages',to,`openaidalle.jpg`),
            content_type: 'image/jpg'
        }
    };
    url = await getImageURL(data, options);
    bot.say(to,`@${from} here you go: ${url}`);
    channels[to].openairunning = false;
}

function modules (event) {
    let
        removeIndex = null,
        to = null;
    commands.forEach ( async function ( command, index ) {
        if ( command.nick == event.nick ) {
            to = command.channel;
            removeIndex = index;
            console.log(JSON.stringify(event));
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(event.host) != -1 )) {
                let modules = await getEnabledModulesInChannel(to);
                if (modules && modules.length > 0){
                    bot.say(event.nick, `Enabled modules in ${to}: ${modules}.`);
                } else {
                    bot.say(event.nick, `No modules enabled in ${to}.`);
                }
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.say(event.nick, 'You must be OWNER (~) or bot admin to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function enable (event) {
    let
        removeIndex = null,
        module = null,
        to = null,
        db = new nedb(config.nedb);
    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            module = command.module;
            to = command.channel;
            removeIndex = index;
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(event.host) != -1 )) {
                let doc = { 'channel': to, 'handles':[], 'modules': [ module ] };
                db.find({ 'channel': to }, function (err, channels) {
                    if (!channels[0]) {
                        db.insert(doc, function(err) {
                            if (err) {
                                bot.say(event.nick,err);
                            }
                            bot.say(event.nick,`Enabled '${module}' module in ${to}!`);
                        });
                    } else {
                        if (channels[0].modules && channels[0].modules.indexOf(module) == -1) {
                            channels[0].modules.push(module);
                            db.update({ 'channel': to }, { $set : { 'modules': channels[0].modules } }, function(err) {
                                if (err) {
                                    bot.say(event.nick,err);
                                }
                                bot.say(event.nick,`Enabled '${module}' module in ${to}`);
                            });
                        } else {
                            if (channels[0] && !channels[0].modules) {
                                db.update({ 'channel': to }, { $set : { 'modules': [module] } }, function(err) {
                                    if (err) {
                                        bot.say(event.nick,err);
                                    }
                                    bot.say(event.nick,`Enabled '${module}' module in ${to}`);
                                });
                            } else {
                                bot.say(event.nick,`Module '${module}' already enabled in ${to}!`);
                            }
                        }
                    }
                });
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.say(event.nick, 'You must be OWNER (~) or bot admin to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function disable (event) {
    let
        removeIndex = null,
        module = null,
        to = null,
        db = new nedb(config.nedb);
    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            module = command.module;
            to = command.channel;
            removeIndex = index;
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(event.host) != -1 )) {
                db.find({ 'channel': to }, function (err, channels) {
                    if (channels[0] && channels[0].modules && channels[0].modules.indexOf(module) != -1) {
                        channels[0].modules.splice(channels[0].modules.indexOf(module),1);
                        db.update({ 'channel': to }, { $set : { 'modules': channels[0].modules } }, function(err) {
                            if (err) {
                                bot.say(event.nick,err);
                            }
                            bot.say(event.nick,`Disabled '${module}' module in ${to}`);
                        });
                    } else {
                        bot.say(event.nick,`Module '${module}' not enabled in ${to}!`); 
                    }
                });
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.say(event.nick, 'You must be OWNER (~) or bot admin to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function follow (event) {
    let
        removeIndex = null,
        handle = null,
        to = null,
        db = new nedb(config.nedb);

    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            handle = command.handle;
            let data = { "screen_name" : handle };
            to = command.channel;
            removeIndex = index;
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '@' || event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(event.host) != -1 )) {
                // IRC USER HAS OPER OR MORE
                needle.request('get', twitterUrl, data, { headers: { "authorization": `Bearer ${token}`}}, function(err, r, result) {
                    if ( err ) {
                        bot.say(event.nick,`Error: ${err}`);
                        throw Error(err);
                    }
                    if ( !result.errors && result ) {
                        // add twitter ID
                        // see if it doesn't exist already
                        let doc = { 'channel': to, 'handles': [ result.screen_name ], 'modules': [] };
                        db.find({ 'channel': to }, function (err, following) {
                            if (!following[0]) {
                                db.insert(doc, function(err) {
                                    if (err) {
                                        bot.say(event.nick,err);
                                    }
                                    bot.say(event.nick,`Now following ${result.name} in ${to}!`);
                                    stream.endStream();
                                });
                            } else {
                                if (following[0].handles && following[0].handles.indexOf(result.screen_name) == -1) {
                                    following[0].handles.push(result.screen_name);
                                    db.update({ 'channel': to }, { $set : { 'handles': following[0].handles } }, function(err) {
                                        if (err) {
                                            bot.say(event.nick,err);
                                        }
                                        bot.say(event.nick,`Now following ${result.name} in ${to}`);
                                        stream.endStream();
                                    });
                                } else {
                                    bot.say(event.nick,`Already following ${result.name} in ${to}!`);
                                }
                            }
                        });
                    } else {
                        bot.say(event.nick,'Tweeter handle not found!.');
                    }
                });
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.say(event.nick, 'You must be OWNER (~) or bot admin to perform that action in this channel.');
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
        db = new nedb(config.nedb);

    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            handle = command.handle;
            let data = { "screen_name" : handle };
            to = command.channel;
            removeIndex = index;
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '@' || event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(event.host) != -1 )) {
                // IRC USER HAS OPER OR MORE
                needle.request('get', twitterUrl, data, { headers: { "authorization": `Bearer ${token}`}}, function(err, r, result) {
                    if (err) {
                        bot.say(event.nick,`Error: ${err}`);
                        throw Error(err);
                    }
                    if (!result.errors && result) {
                        db.find({ 'channel': to }, function (err, following) {
                            if (following[0] && following[0].handles.indexOf(result.screen_name) != -1) {
                                following[0].handles.splice(following[0].handles.indexOf(result.screen_name),1);
                                db.update({ 'channel': to }, { $set : { 'handles': following[0].handles } }, function(err) {
                                    if (err) {
                                        bot.say(event.nick,err);
                                    }
                                    bot.say(event.nick,`Unfollowed ${result.name} in ${to}!`);
                                    stream.endStream();
                                });
                            } else {
                                bot.say(event.nick,`Not following ${result.name} in ${to}!`); 
                            }
                        });
                    } else {
                        bot.say(event.nick,'Twitter handle not found!.');
                    }
                });
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.say(event.nick, 'You must be OWNER (~) or bot admin to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function joinChannels(db){
    return new Promise ( resolve => {
        db.find({}, function (err, allRecords) {
            allRecords.forEach( record => {
                bot.join(record.channel);
                channels[record.channel] = { running: false };
                channels[record.channel] = { openairunning: false };
            });
            resolve(channels);
        });
    });
}

JSON.safeStringify = (obj, indent = 2) => {
    let cache = [];
    const retVal = JSON.stringify(
      obj,
      (key, value) =>
        typeof value === "object" && value !== null
          ? cache.includes(value)
            ? undefined // Duplicate reference found, discard key
            : cache.push(value) && value // Store value in our collection
          : value,
      indent
    );
    cache = null;
    return retVal;
};

bot.on('error', function(err) {
    console.log(err);
});

bot.on('invite', function(event) {
    let from=event.nick,
        ident=event.ident,
        hostname=event.hostname,
        to=event.channel;
    if ( config.irc.ignoreChannels.indexOf(to) === -1 && config.irc.ignoreHostnames.indexOf(hostname) === -1 && config.irc.ignoreNicks.indexOf(from) === -1 && config.irc.ignoreIdents.indexOf(ident) === -1 && event.channel.indexOf(to) >= 0 ) {
        channels.push(event.channel);
        channels[event.channel] = { running: false };
        channels[event.channel] = { openairunning: false };
        bot.join(event.channel);
    }
});

bot.on('connected', async function() {
    let db = new nedb(config.nedb);
    if (process.env.TESTING == "true") {
        config.irc.channels.forEach( channel => {
            bot.join(channel);
            channels[channel] = { running: false };
            channels[channel] = { openairunning: false };
        });
    } else {
        await joinChannels(db);
    }
    stream.startStream(db);
});

bot.on('message', async function(event) {
    let
        from=event.nick,
        ident=event.ident,
        hostname=event.hostname,
        message=event.message,
        to=event.target;
    // if message is a valid .ut XXXXX string
    if (config.irc.ignoreHostnames.indexOf(hostname) ===-1 && config.irc.ignoreNicks.indexOf(from) === -1 && config.irc.ignoreIdents.indexOf(ident) === -1) {
        if (message.match(/^\.ut\s.+$/)) {
            if (await isModuleEnabledInChannel(to,"twitter search")) {
                // if message is .ut @useraccount
                if (message.match(/^\.ut\s@\w+$/)) {
                    // get that account's last tweet
                    if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                        let
                            account = message.slice(message.search(/@/)+1),
                            url = 'https://api.twitter.com/1.1/statuses/user_timeline.json',
                            data = {
                                'screen_name': account,
                                'count': 1,
                                'tweet_mode': 'extended',
                            };
                        
                        needle.request('get', url, data, { headers: { "authorization": `Bearer ${token}`}}, function(err, r, result) {
                                if (err) {
                                bot.say(from,`Error: ${err}`);
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
                        bot.say(from,'No auth data.');
                } else
                // general search
                if (message.match(/^\.ut\s.+$/)) {
                    if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                        let
                            sq = message.slice(4),
                            url = 'https://api.twitter.com/1.1/search/tweets.json',
                            data = {
                                'q': sq,
                                'lang': 'en',
                                'count': 1,
                                'tweet_mode': 'extended',
                                // mixed results if no result_type is specified
                            };
                        needle.request('get', url, data, { headers: { "authorization": `Bearer ${token}`}}, function(err, r, result) {
                                if (err) {
                                bot.say(from,`Error: ${err}`);
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
                                data.result_type='popular';
                                needle.request('get', url, data, { headers: { "authorization": `Bearer ${token}`}}, function(err, r, result) {
                                    if (err) {
                                        bot.say(from,`Error: ${err}`);
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
                            bot.say(from,'No auth data.');
                } else
                    bot.say(from,'Invalid command.');
            } else {
                bot.say(from,`The 'twitter search' module is not enabled in ${to}.`);
            }
        } else
        // get twitter.com or t.co link
        if (message.match(/twitter\.com\/\w+\/status\/\d+/) || message.match(/twitter\.com\/i\/web\/status\/\d+/) || message.match(/t\.co\/\w+/)) {
            if (await isModuleEnabledInChannel(to,"twitter expand")) {
                if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                    if (message.match(/t\.co\/\w+/)) {
                        // message contains a t.co link
                        message=`https://${message.match(/t\.co\/\w+/)[0]}`;
                        needle.head(message, function(err,res) {
                            message=res.headers.location;
                            if (message.match(/twitter\.com\/\w+\/status\/\d+/)) {
                                // it is a valid twitter status url
                                let
                                    id = message.slice(message.search(/\/\d+/)+1),
                                    url = 'https://api.twitter.com/1.1/statuses/show.json',
                                    data = {
                                        id,
                                        'tweet_mode': 'extended',
                                    };
                                needle.request('get', url, data, { headers: { "authorization": `Bearer ${token}`}}, function(err, r, result) {
                                        if (err) {
                                        bot.say(from,`Error: ${err}`);
                                        throw Error(err);
                                    }
                                    if (!result.errors && result) {
                                        result.text = result.full_text.replace(/\n/g, ' ');
                                        htmlKeys.forEach( curr => {
                                            result.text = result.text.replace(new RegExp(curr,'g'),unescape(curr));
                                        });
                                        sendTweet(to,result.text,result.user.name,result.created_at,result.retweet_count,result.favorite_count,false,null,null);
                                    }
                                });
                            } else {
                                
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
                        url = 'https://api.twitter.com/1.1/statuses/show.json',
                        data = {
                            id,
                            'tweet_mode': 'extended',
                        };
                        
                    needle.request('get', url, data, { headers: { "authorization": `Bearer ${token}`}}, function(err, r, result) {
                            if (err) {
                            bot.say(from,`Error: ${err}`);
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
                        }
                    });
                }
            }
        } else
        if (message.match(/twitter\.com\/i\/spaces\/\w+/)) {
            if (await isModuleEnabledInChannel(to,"twitter expand")) {
                if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                    let
                        id = message.slice(message.search(/\/spaces\/\w+/)+8),
                        url = `https://api.twitter.com/2/spaces/${id}`,
                        data = {
                            'space.fields': 'participant_count,started_at,state,title,host_ids',
                        };
                    needle.request('get', url, data, { headers: { "authorization": `Bearer ${token}`}}, function(err, r, result) {
                            if (err) {
                            bot.say(from,`Error: ${err}`);
                            throw Error(err);
                        }
                        if (!result.errors && result) {
                            htmlKeys.forEach( curr => {
                                result.data.title = result.data.title.replace(new RegExp(curr,'g'),unescape(curr));
                            });
                            sendSpace(to,result.data.title,result.data.state,result.data.started_at,result.data.host_ids,result.data.participant_count);
                        }
                    });
                }
            }
        } else
        // any non-twitter url and ignore youtube urls and files
        if (message.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/)) {
            if (await isModuleEnabledInChannel(to,"url read")) {
                let url=message.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/)[0];
                if(!(url.match(/youtu.be/)) && !(url.match(/youtube\.com/))){
                    let options = { follow_max: 5, headers: {"User-Agent": 'needle'}};
                    needle.get(url,options,function(err,r,body) {
                        if (!(body instanceof Buffer)) {
                            console.log(body);
                            let title = body.match(/<title>(.*?)<\/title>/)[1];
                            htmlKeys.forEach( curr => {
                                title = title.replace(new RegExp(curr,'g'),unescape(curr));
                            });
                            bot.say(to,`Title: ${title}`);
                        }
                    });
                }
            }
        } else
        if (message.match(/^\.modules$/)) {
            commands.push({'nick': from, 'channel': to});
            bot.whois(from,modules);
        } else
        if ( message.match(/^\.enable\s\w+(\s\w+)*$/)) {            
            let module = null;
            if (message.match(/^\.enable\s\w+(\s\w+)*$/))
                module = message.slice(message.search(/\s\w+(\s\w+)*$/)+1);
            if (module == "twitter expand" || module == "dalle" || module == "twitter follow" || module == "twitter search" || module == "url read" || module == "openai"){
                commands.push({'nick': from, 'module': module, 'channel': to});
                bot.whois(from,enable);
            } else {
                bot.say(from,`Module '${module}' not found`);
            }
        } else
        if ( message.match(/^\.disable\s\w+(\s\w+)*$/)) {
            // .disable command - disable module on a channel
            let module = null;
            if (message.match(/^\.disable\s\w+(\s\w+)*$/))
                module = message.slice(message.search(/\s\w+(\s\w+)*$/)+1);
            if (module == "twitter expand" || module == "dalle" || module == "twitter follow" || module == "twitter search" || module == "url read" || module == "openai"){
                commands.push({'nick': from, 'module': module, 'channel': to});
                bot.whois(from,disable);
            } else {
                bot.say(from,`Module '${module}'not found`);
            }
        }else
        if (message.match(/^\.follow\s@?\w+$/)) {
            // .follow command - add user ID to stream
            if (await isModuleEnabledInChannel(to,"twitter follow")) {
                if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
                    var handle = null;
                    if (message.match(/^\.follow\s@\w+$/))
                        handle = message.slice(message.search(/@\w+$/)+1);
                    else
                        handle = message.slice(message.search(/\s\w+$/)+1);
                    commands.push({'nick': from, 'handle': handle, 'channel': to});
                    bot.whois(from,follow);
                } else // No auth data, ask user to authenticate bot
                    bot.say(from,'No auth data.');
            } else {
                bot.say(from,`The 'twitter follow' module is not enabled in ${to}.`);
            }
        } else
        if (message.match(/^\.unfollow\s@?\w+$/)) {
            // .unfollow command - remove user ID from stream
            if (await isModuleEnabledInChannel(to,"twitter follow")) {
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
                    bot.say(from,'No auth data.');
            } else {
                bot.say(from,`The 'twitter follow' module is not enabled in ${to}.`);
            }
        } else
        if (message.match(/^\.following$/)) {
            if (await isModuleEnabledInChannel(to,"twitter follow")) {
                let db = new nedb(config.nedb);

                if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {

                    db.find({ 'channel': to }, function (err, following) {
                        if (following[0] && following[0].handles) {
                            let
                                following_handles = following[0].handles.toString(),
                                url = 'https://api.twitter.com/1.1/users/lookup.json',
                                data = {
                                    'screen_name': following_handles,
                                };
                            needle.request('post',url, data, { headers: { "authorization": `Bearer ${token}`}}, function(err, r, result) {
                                if (err) {
                                    bot.say(from,`Error: ${err}`);
                                    throw Error(err);
                                }
                                if (!result.errors && result) {
                                    let accounts=`${result[0].name} (@${result[0].screen_name})`;
                                    result.forEach( function (current,index) {
                                        if (index>0)
                                            accounts+=`, ${current.name} (@${current.screen_name})`;
                                    });
                                    bot.say(from,`Following: ${accounts} in ${to}.`);
                                } else {
                                    bot.say(from,`Not following anyone in ${to} yet!.`);
                                }
                            });

                        } else {
                            bot.say(from,`Not following anyone in ${to} yet!.`); 
                        }
                    });
                } else // No auth data, ask user to authenticate bot
                    bot.say(from,'No auth data.');
            } else {
                bot.say(from,`The 'twitter follow' module is not enabled in ${to}.`);
            }
        } else
        if (message.match(/\.dalle\s.+$/)) {
            if (await isModuleEnabledInChannel(to,"dalle")) {
                let prompt = message.slice(message.match(/\.dalle\s.+$/).index+7).trim();
                // check if bot is not handling another call
                if (!channels[to].running){
                    channels[to].running = true;
                    bot.say(to,`Generating from "${prompt}" prompt...`);
                    deleteImages(to);
                    needle.post(dalleUrl, {prompt: prompt},{json: true}, function(error, response) {
                        if (!error && response.statusCode == 200){
                            // save 9 images
                            if (!fs.existsSync(path.join(__dirname,'images',to))){
                                fs.mkdirSync(path.join(__dirname,'images',to), { recursive: true });
                            }
                            let buffer = null;
                            for (let i=0; i < response.body.images.length ; i++){
                                buffer = Buffer.from(response.body.images[i], "base64");
                                fs.writeFileSync(path.join(__dirname,'images',to,`dall-e_result_${i}.jpg`), buffer);
                            }
                            try {
                                // join 9 images into a single 3x3 grid image
                                joinImages.joinImages([path.join(__dirname,'images',to,'dall-e_result_0.jpg'), path.join(__dirname,'images',to,'dall-e_result_1.jpg'),path.join(__dirname,'images',to,'dall-e_result_2.jpg')],options_horizontal).then((img) => {
                                    img.toFile(path.join(__dirname,'images',to,'row1.jpg'),(err,info) =>{
                                        joinImages.joinImages([path.join(__dirname,'images',to,'dall-e_result_3.jpg'), path.join(__dirname,'images',to,'dall-e_result_4.jpg'),path.join(__dirname,'images',to,'dall-e_result_5.jpg')],options_horizontal).then((img) => {
                                            img.toFile(path.join(__dirname,'images',to,'row2.jpg'),(err,info) => {
                                                joinImages.joinImages([path.join(__dirname,'images',to,'dall-e_result_6.jpg'), path.join(__dirname,'images',to,'dall-e_result_7.jpg'),path.join(__dirname,'images',to,'dall-e_result_8.jpg')],options_horizontal).then((img) => {
                                                    img.toFile(path.join(__dirname,'images',to,'row3.jpg'),(err,info) => {
                                                        joinImages.joinImages([path.join(__dirname,'images',to,'row1.jpg'),path.join(__dirname,'images',to,'row2.jpg'),path.join(__dirname,'images',to,'row3.jpg')],options_vertical).then((img) => {
                                                            img.toFile(path.join(__dirname,'images',to,'dalle.jpg'),(err,info) => {
                                                                postImage(to,from,prompt);
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            } catch (error) {
                                channels[to].running = false;
                                bot.say(to,`Error joining dalle images into final image: ${error}`);
                            }
                        } else {
                            if (response.statusCode == 524){
                                bot.say(from,`@${from} Dall-E Service is too Busy. Please try again later...`);
                            } else {
                                bot.say(to,`Dall-E Error ${response.statusCode}: ${response.statusMessage}`);
                            }
                            channels[to].running = false;
                        }
                    });
                } else {
                    bot.say(from,`@${from} please wait for the current Dall-E request to complete.`);
                }
            } else {
                bot.say(from,`The 'dalle' module is not enabled in ${to}.`);
            }
        } else
        if (message.match(/\.openai\s.+$/)) {
            if (await isModuleEnabledInChannel(to,"openai")) {
                if (message.match(/\.openai\shttps?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,5}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)\.png/)){
                    let url = message.slice(message.match(/\.openai\shttps?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,5}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)\.png/).index+8).trim();
                    if (!channels[to].openairunning){
                        channels[to].openairunning = true;
                        bot.say(to,`Generating variations...`);
                        deleteOpenAIImage(to);
                        needle.get(url, (err, res) => {
                            if (!err && res.statusCode == 200) {
                                fs.writeFileSync(path.join(__dirname,'openaiimages',to,'variation.png'), res.raw);
                                let data = {
                                    image: {
                                        file: path.join(__dirname,'openaiimages',to,'variation.png'),
                                        content_type: "image/png"
                                    },
                                    "n": 3,
                                    "response_format": "b64_json",
                                    "size": "512x512"
                                }
                                needle.post(openAIAPIVariationsUrl, data, {headers: {"Authorization": `Bearer ${openAIAPIToken}`}, multipart: true },function (error,response){
                                    if (!error && response.statusCode == 200){
                                        if (!fs.existsSync(path.join(__dirname,'openaiimages',to))){
                                            fs.mkdirSync(path.join(__dirname,'openaiimages',to), { recursive: true });
                                        }
                                        let buffer = null;
                                        for (let i=0; i < response.body.data.length ; i++){
                                            buffer = Buffer.from(response.body.data[i].b64_json, "base64");
                                            fs.writeFileSync(path.join(__dirname,'openaiimages',to,`openaidalle_${i}.png`), buffer, "base64");
                                        }
                                        try {
                                            // join 3 images into a single row
                                            joinImages.joinImages([path.join(__dirname,'openaiimages',to,'openaidalle_0.png'), path.join(__dirname,'openaiimages',to,'openaidalle_1.png'),path.join(__dirname,'openaiimages',to,'openaidalle_2.png')],options_horizontal).then((img) => {
                                                img.toFile(path.join(__dirname,'openaiimages',to,'openaidalle.jpg'),(err,info) =>{
                                                    postOpenAIImageVariation(to,from);
                                                });
                                            });
                                        } catch (error) {
                                            channels[to].openairunning = false;
                                            bot.say(to,`Error joining dalle images into final image: ${error}`);
                                        }
                                    } else {
                                        if (response.statusCode == 524){
                                            bot.say(from,`@${from} OpenAI Dall-E Service is too Busy. Please try again later...`);
                                        } else {
                                            bot.say(to,`OpenAI Dall-E Error: ${JSON.stringify(response.body.error.message)}`);
                                        }
                                        channels[to].openairunning = false;
                                    }
                                });
                            } else {
                                bot.say(from,`@${from} Error downloading variation image.`);
                                channels[to].openairunning = false;
                            }
                        });
                    } else {
                        bot.say(from,`@${from} please wait for the current OpenAI Dall-E request to complete.`);
                    }
                } else 
                    if (message.match(/\.openai\shttps?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,5}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/)){
                        bot.say(from,`@${from} Variation image must be a valid PNG file, less than 4MB, and square.`);
                    } else {
                        //generate image variation by preview image number
                        if (message.match(/\.openai\s[1-3]$/)){
                            let imageNumber = message.match(/[1-3]$/)[0];
                            if (fs.existsSync(path.join(__dirname,'openaiimages',to,`openaidalle_${imageNumber-1}.png`))){
                                // check if bot is not handling another call
                                if (!channels[to].openairunning){
                                    channels[to].openairunning = true;
                                    switch (imageNumber) {
                                        case "1": bot.say(to,`Generating variations of first image...`); break;
                                        case "2": bot.say(to,`Generating variations of second image...`); break;
                                        case "3": bot.say(to,`Generating variations of third image...`); break;
                                    }
                                    let data = {
                                        image: {
                                            file: path.join(__dirname,'openaiimages',to,`openaidalle_${imageNumber-1}.png`),
                                            content_type: "image/png"
                                        },
                                        "n": 3,
                                        "response_format": "b64_json",
                                        "size": "512x512"
                                    }
                                    needle.post(openAIAPIVariationsUrl, data, {headers: {"Authorization": `Bearer ${openAIAPIToken}`}, multipart: true },function (error,response){
                                        if (!error && response.statusCode == 200){
                                            if (!fs.existsSync(path.join(__dirname,'openaiimages',to))){
                                                fs.mkdirSync(path.join(__dirname,'openaiimages',to), { recursive: true });
                                            }
                                            let buffer = null;
                                            for (let i=0; i < response.body.data.length ; i++){
                                                buffer = Buffer.from(response.body.data[i].b64_json, "base64");
                                                fs.writeFileSync(path.join(__dirname,'openaiimages',to,`openaidalle_${i}.png`), buffer, "base64");
                                            }
                                            try {
                                                // join 3 images into a single row
                                                joinImages.joinImages([path.join(__dirname,'openaiimages',to,'openaidalle_0.png'), path.join(__dirname,'openaiimages',to,'openaidalle_1.png'),path.join(__dirname,'openaiimages',to,'openaidalle_2.png')],options_horizontal).then((img) => {
                                                    img.toFile(path.join(__dirname,'openaiimages',to,'openaidalle.jpg'),(err,info) =>{
                                                        postOpenAIImageVariation(to,from);
                                                    });
                                                });
                                            } catch (error) {
                                                channels[to].openairunning = false;
                                                bot.say(to,`Error joining dalle images into final image: ${error}`);
                                            }
                                        } else {
                                            if (response.statusCode == 524){
                                                bot.say(from,`@${from} OpenAI Dall-E Service is too Busy. Please try again later...`);
                                            } else {
                                                bot.say(to,`OpenAI Dall-E Error: ${JSON.stringify(response.body.error.message)}`);
                                            }
                                            channels[to].openairunning = false;
                                        }
                                    });
                                } else {
                                    bot.say(from,`@${from} please wait for the current OpenAI Dall-E request to complete.`);
                                }
                            } else {
                                bot.say(from,`@${from} Selected image no longer exists.`);
                            }
                        } else {
                            let prompt = message.slice(message.match(/\.openai\s.+$/).index+8).trim(),
                                data = {
                                "prompt": prompt,
                                "n": 3,
                                "response_format": "b64_json",
                                "size": "512x512"
                            }
                            // check if bot is not handling another call
                            if (!channels[to].openairunning){
                                channels[to].openairunning = true;
                                bot.say(to,`Generating from "${prompt}" prompt...`);
                                deleteOpenAIImage(to);
                                needle.post(openAIAPIGenerationsUrl, data, {headers: {"Content-Type": "application/json","Authorization": `Bearer ${openAIAPIToken}`}},function (error,response){
                                    if (!error && response.statusCode == 200){
                                        if (!fs.existsSync(path.join(__dirname,'openaiimages',to))){
                                            fs.mkdirSync(path.join(__dirname,'openaiimages',to), { recursive: true });
                                        }
                                        let buffer = null;
                                        for (let i=0; i < response.body.data.length ; i++){
                                            buffer = Buffer.from(response.body.data[i].b64_json, "base64");
                                            fs.writeFileSync(path.join(__dirname,'openaiimages',to,`openaidalle_${i}.png`), buffer, "base64");
                                        }
                                        try {
                                            // join 3 images into a single row
                                            joinImages.joinImages([path.join(__dirname,'openaiimages',to,'openaidalle_0.png'), path.join(__dirname,'openaiimages',to,'openaidalle_1.png'),path.join(__dirname,'openaiimages',to,'openaidalle_2.png')],options_horizontal).then((img) => {
                                                img.toFile(path.join(__dirname,'openaiimages',to,'openaidalle.jpg'),(err,info) =>{
                                                    postOpenAIImage(to,from,prompt);
                                                });
                                            });
                                        } catch (error) {
                                            channels[to].openairunning = false;
                                            bot.say(to,`Error joining dalle images into final image: ${error}`);
                                        }
                                    } else {
                                        if (response.statusCode == 524){
                                            bot.say(from,`@${from} OpenAI Dall-E Service is too Busy. Please try again later...`);
                                        } else {
                                            bot.say(to,`OpenAI Dall-E Error: ${JSON.stringify(response.body.error.message)}`);
                                        }
                                        channels[to].openairunning = false;
                                    }
                                });
                            } else {
                                bot.say(from,`@${from} please wait for the current OpenAI Dall-E request to complete.`);
                            }
                        }
                    }
            } else {
                bot.say(from,`The 'openai' module is not enabled in ${to}.`);
            }
        } else
        // if message is .help
        if (message.match(/^\.help$/)) {
            bot.say(from,'Usage:');
            setTimeout(function() { bot.say(from,'.enable <module name> - enables module in channel - must be OWNER (~) or bot admin.');},1000);
            setTimeout(function() { bot.say(from,'.disable <module name> - disable module in channel - must be OWNER (~) or bot admin.');},1000);
            setTimeout(function() { bot.say(from,'.modules - get enabled modules in channel - must be OWNER (~) or bot admin.');},1000);
            setTimeout(function() { bot.say(from,`Available modules (case sensitive): 'twitter search', 'twitter follow', 'twitter expand', 'dalle', 'url read', 'openai'.`);},1000);
            setTimeout(function() { bot.say(from,'.ut @twitter_handle - retrieves the last tweet from that account.');},1000);
            setTimeout(function() { bot.say(from,'.ut <search terms> - search for one or more terms including hashtags.');},1000);
            setTimeout(function() { bot.say(from,'.following - show twitter accounts followed in the channel.');},1000);
            setTimeout(function() { bot.say(from,'.follow @twitter_handle - follows the account in the channel - must be OWNER (~) or bot admin.');},1000);
            setTimeout(function() { bot.say(from,'.unfollow @twitter_handle - unfollows the account in the channel - must be OWNER (~) or bot admin.');},1000);
            setTimeout(function() { bot.say(from,'.dalle <prompt> - request dall-e images from prompt');},1000);
            setTimeout(function() { bot.say(from,'.help - this help message.');},1000);
        } else
        if (message.match(/^\.bots$/)) {
            bot.say(from,`${config.irc.nick} [NodeJS], a Twitter bot for irc. Do .help for usage.`);
        } else
        if (message.match(/^\.source$/)) {
            bot.say(from,`${config.irc.nick} [NodeJS] :: ${colors.white.bold('Source ')} ${packageInf.repository}`);
        }
    }
});

bot.on('registered', function (){
    bot.say('nickserv','identify '+ password);
})

bot.connect({host,port,tls,nick,username,gecos,password});
