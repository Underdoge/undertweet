'use strict';

const
    cheerio = require('cheerio'),
    sharp = require('sharp'),
    Database = require('better-sqlite3'),
    joinImages = require("join-images"),
    needle = require('needle'),
    twitter = require('./lib/twitter'),
    fs = require("fs"),
    packageInf = require('./package'),
    IRC = require('irc-framework'),
    colors = require('irc-colors'),
    config = require('./config'),
    stream = require('./streamv3'),
    path = require('path'),
    host = config.irc.host,
    port = config.irc.port,
    nick = config.irc.nick,
    username = config.irc.nick,
    gecos = config.irc.nick,
    tls = config.irc.tls,
    password = config.irc.pass,
    dalleUrl = config.dalle.api_url,
    ghettyUrl = config.ghetty.url,
    youtubeAPIKey = config.youtube.api_key,
    youtubeVideosURL = config.youtube.videos_url,
    youtubeSearchURL = config.youtube.search_url,
    openAIAPIGenerationsUrl = config.openAI.api_generations_url,
    openAIAPIVariationsUrl = config.openAI.api_variations_url,
    dateOptionsShort = {
        'timeZone':'America/Mexico_City', 'month': 'short', 'weekday': 'short', 'day': 'numeric', 'year': 'numeric','hour': '2-digit', 'minute': '2-digit',
    },
    dateOptionsShorter = {
        'timeZone':'America/Mexico_City', 'month': 'short', 'day': 'numeric', 'year': 'numeric'
    },
    htmlMap ={
        '&amp;': '&', '&lt;':'<', '&gt;':'>',
    },
    htmlKeys = ['&amp;', '&lt;', '&gt;', '&#(\\d+);'],
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
    },
    bot = new IRC.Client();

var
    db = null,
    commands = [];

function getDatabase(){
    return db;
}

function setDatabase(newdb){
    db = newdb;
}

function unescape(char, text) {
    if (char == '&#(\\d+);') {
        return String.fromCharCode(text.match(/(\d+)/g));
    } else {
        return htmlMap[char];
    }
}

function sendSpace(to,title,state,started_at,host_ids,participant_count){
    let message = null;
    if (state == "live") {
    message = `\
Twitter Space "${colors.teal(title)}" is now live 🔴, \
started on ${new Date(started_at).toLocaleDateString('en-us', dateOptionsShort)} \
and has ${colors.teal(`${participant_count.toLocaleString('en-us')}`)} participants.`;
    } else { 
    message = `\
Twitter Space "${colors.teal(title)}" has ended, \
started on ${new Date(started_at).toLocaleDateString('en-us', dateOptionsShort)} \
and had ${colors.teal(`${participant_count.toLocaleString('en-us')}`)} participants.`;
    }
    bot.say (to,message);
}

function sendYouTubevideo(to,title,desc,account,date,likes,views,duration,id) {
    let message = null, hours="", minutes="", seconds="";
    if (parseInt(likes) > 1000000) {
        likes = (Math.round(parseInt(likes)/1000000 * 100) / 100).toString() + "M";
    } else 
    if (parseInt(likes) > 1000) {
        likes = (Math.round(parseInt(likes)/1000 * 100) / 100).toString() + "K";
    }
    if (parseInt(views) > 1000000) {
        views = (Math.round(parseInt(views)/1000000 * 100) / 100).toString() + "M";
    } else 
    if (parseInt(views) > 1000) {
        views = (Math.round(parseInt(views)/1000 * 100) / 100).toString() + "K";
    }
    desc = desc.replaceAll("\n"," ").replaceAll("  "," ");
    hours = (duration.match(/[0-9]{1,2}H/) ? duration.match(/[0-9]{1,2}H/)[0].slice(0,duration.match(/[0-9]{1,2}H/)[0].indexOf("H")) : "");
    minutes = (duration.match(/[0-9]{1,2}M/) ? (parseInt(duration.match(/[0-9]{1,2}M/)[0].slice(0,duration.match(/[0-9]{1,2}M/)[0].indexOf("M"))) < 10 ? ("0" + duration.match(/[0-9]{1,2}M/)[0].slice(0,1)) : duration.match(/[0-9]{1,2}M/)[0].slice(0,2)) : "00");
    seconds = (duration.match(/[0-9]{1,2}S/) ? (parseInt(duration.match(/[0-9]{1,2}S/)[0].slice(0,duration.match(/[0-9]{1,2}S/)[0].indexOf("S"))) < 10 ? ("0" + duration.match(/[0-9]{1,2}S/)[0].slice(0,1)) : duration.match(/[0-9]{1,2}S/)[0].slice(0,2)) : "00");
    if (!id) {
        message = `\
${colors.teal(title.toLocaleString('en-us'))} (${hours != "" ? hours + ":" : ""}${minutes + ":" + seconds}) · ${views.toLocaleString('en-us')} views · ${account} \
· ${new Date(date).toLocaleDateString('en-us', dateOptionsShorter)} ·\
${colors.green(` 👍 ${likes.toLocaleString('en-us')}`)}${desc ? " · \"" + desc.toLocaleString('en-us') + "\"": ""}`;
    } else {
        message = `\
${colors.teal(title.toLocaleString('en-us'))} (${hours != "" ? hours + ":" : ""}${minutes + ":" + seconds}) · ${views.toLocaleString('en-us')} views · ${account} \
· ${new Date(date).toLocaleDateString('en-us', dateOptionsShorter)} ·\
${colors.green(` 👍 ${likes.toLocaleString('en-us')}`)} · https://youtube.com/watch?v=${id} · ${desc ? " · \"" + desc.toLocaleString('en-us') + "\"": ""}`;
    }
    if (message.length > 350)
        message = message.slice(0, 346) + "...\"";
    bot.say (to,message);
}

function sendTweet(to,text,username,date,retweets,favorites,isQuote,quotedUsername,quotedText){
    let message = null;
    if ( !isQuote ) {
        message = `\
${colors.teal(text)} · by ${username} \
on ${new Date(date).toLocaleTimeString('en-us', dateOptionsShort)} ·\
${colors.green(` ♻ ${retweets.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${favorites.toLocaleString('en-us')}`)}`;
        if (message.length > 350){
            bot.say(to,`${colors.teal(text)}`);
            bot.say(to,`by ${username} on ${new Date(date).toLocaleTimeString('en-us', dateOptionsShort)} ·${colors.green(` ♻ ${retweets.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${favorites.toLocaleString('en-us')}`)}`);
        } else {
            bot.say (to,message);
        }
    } else {
        message = `\
${colors.teal(text)} · by ${username} \
on ${new Date(date).toLocaleDateString('en-us', dateOptionsShort)} ·\
${colors.green(` ♻ ${retweets.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${favorites.toLocaleString('en-us')}`)} \
Quoting @${quotedUsername}: ${colors.teal(quotedText)}`;
        if (message.length > 350) {
            bot.say(to,`${colors.teal(text)}`);
            bot.say(to,`by ${username} \
on ${new Date(date).toLocaleDateString('en-us', dateOptionsShort)} ·\
${colors.green(` ♻ ${retweets.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${favorites.toLocaleString('en-us')}`)}`);
            bot.say(to,`Quoting @${quotedUsername}: ${colors.teal(quotedText)}`);
        } else {
            bot.say(to,message);
        }
    }
}

function deleteImages(to){
    fs.access(path.join(__dirname,'images',to,'dall-e_result_0.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'dall-e_result_0.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'dall-e_result_1.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'dall-e_result_1.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'dall-e_result_2.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'dall-e_result_2.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'dall-e_result_3.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'dall-e_result_3.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'dall-e_result_4.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'dall-e_result_4.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'dall-e_result_5.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'dall-e_result_5.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'dall-e_result_6.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'dall-e_result_6.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'dall-e_result_7.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'dall-e_result_7.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'dall-e_result_8.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'dall-e_result_8.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'row1.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'row1.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'row2.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'row2.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'row3.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'row3.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'images',to,'dalle.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'images',to,'dalle.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
}

function deleteOpenAIImage(to){
    fs.access(path.join(__dirname,'openaiimages',to,'variation.png'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'openaiimages',to,'variation.png'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'openaiimages',to,'variation_resized.png'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'openaiimages',to,'variation_resized.png'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'openaiimages',to,'variation_shrinked.png'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'openaiimages',to,'variation_shrinked.png'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'openaiimages',to,'openaidalle_0.png'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'openaiimages',to,'openaidalle_0.png'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'openaiimages',to,'openaidalle_1.png'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'openaiimages',to,'openaidalle_1.png'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'openaiimages',to,'openaidalle_2.png'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'openaiimages',to,'openaidalle_2.png'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
    fs.access(path.join(__dirname,'openaiimages',to,'openaidalle.jpg'), (err) => {
        if (!err){
            fs.unlink(path.join(__dirname,'openaiimages',to,'openaidalle.jpg'), (err) => {
                if(err)
                    console.log(`Error: ${err}`);
            });
        }
    });
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

function getImageURL (data,options,to) {
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
        msg = "",
        options = {
            multipart:true,
            json:true
        };
    for (let i=0; i < 3; i++) {
        data = {
            image:{
                file: path.join(__dirname,'openaiimages',to,`openaidalle_${i}.png`),
                content_type: 'image/png'
            }
        };
        msg += `${i+1}) ${await getImageURL(data, options,to)} `
    }
    data = {
        image:{
            file: path.join(__dirname,'openaiimages',to,`openaidalle.jpg`),
            content_type: 'image/jpg'
        }
    };
    msg += `1+2+3) ${await getImageURL(data, options,to)}`;
    bot.say(to,`@${from} here you go "${prompt}": ${msg}`);
    channels[to].openairunning = false;
}

function resizeImage(imagePath,to,sizeLimit) {
    return new Promise( resolve => {
        const image = sharp(imagePath);
        var requiredDimension = 0;
        image.metadata().then( metadata => {
            if (metadata.width > metadata.height) {
                requiredDimension = metadata.height;
            } else
            if (metadata.width < metadata.height) {
                requiredDimension = metadata.width;
            }
            if (requiredDimension > 0) {
                image.resize( { width: requiredDimension, height: requiredDimension,  fit: "fill"})
                    .toFile(path.join(__dirname, 'openaiimages',to, 'variation_resized.png'), (err, info) => { 
                        if (err) {
                            console.error("An error occurred resizing image:", err);
                            bot.say(to,`Error resizing image ${err}`);
                            resolve(false);
                        } else {
                            fs.stat(path.join(__dirname,'openaiimages',to,'variation_resized.png'), (err,stats) => {
                                console.log(`Resized image from ${metadata.width}x${metadata.height} to ${requiredDimension}x${requiredDimension} format ${metadata.format} Size after resize: ${stats.size}`);
                                if (stats.size >= sizeLimit) {
                                    const image2 = sharp(path.join(__dirname,'openaiimages',to,'variation_resized.png'));
                                    image2.metadata().then( metadata => {
                                        let ratio = (stats.size/(metadata.width*metadata.width)),
                                        newSize = Math.floor(Math.sqrt(sizeLimit/ratio));
                                        console.log(`Ratio: ${ratio} Sqrt ${Math.sqrt(sizeLimit/ratio)} New size: ${newSize}`);
                                        image2.resize( { width: newSize, height: newSize, fit: "inside"} )
                                        .toFile(path.join(__dirname, 'openaiimages',to, 'variation_shrinked.png'), (err, info) => { 
                                            if (err) {
                                                console.error("An error occurred shrinking image:", err);
                                                bot.say(to,`Error resizing image ${err}`);
                                                resolve(false);
                                            } else {
                                                console.log(`Shrinked image from ${metadata.width}x${metadata.height} to ${newSize}x${newSize} format ${metadata.format}`);
                                                resolve('variation_shrinked.png');
                                            }
                                        });
                                    });
                                } else {
                                    console.log(`Didn't need to shrink resized image with dimensions ${metadata.width}x${metadata.width} size ${stats.size} format ${metadata.format}`)
                                    resolve('variation_resized.png');
                                }
                            });
                        }
                    });
            } else {
                fs.stat(path.join(__dirname,'openaiimages',to,'variation.png'), (err, stats) => {
                    console.log(`Didn't resize square image with dimensions ${metadata.width}x${metadata.height} format ${metadata.format} Size after resize: ${stats.size}`);
                    if (stats.size >= sizeLimit) {
                        const image2 = sharp(path.join(__dirname,'openaiimages',to,'variation.png'));
                        image2.metadata().then( metadata => {
                            let ratio = (stats.size/(metadata.width*metadata.width)),
                            newSize = Math.floor(Math.sqrt(sizeLimit/ratio));
                            console.log(`Ratio: ${ratio} Sqrt ${Math.sqrt(sizeLimit/ratio)} New size: ${newSize}`);
                            image2.resize( { width: newSize, height: newSize, fit: "inside"})
                            .toFile(path.join(__dirname, 'openaiimages',to, 'variation_shrinked.png'), (err, info) => { 
                                if (err) {
                                    console.error("An error occurred shrinking image:", err);
                                    bot.say(to,`Error resizing image ${err}`);
                                    resolve(false);
                                } else {
                                    console.log(`Shrinked image from ${metadata.width}x${metadata.height} to ${newSize}x${newSize} format ${metadata.format}`);
                                    resolve('variation_shrinked.png');
                                }
                            });
                        });
                    } else {
                        console.log(`Didn't need to shrink square image with dimensions ${metadata.width}x${metadata.height} and size ${stats.size} format ${metadata.format}`);
                        resolve(false);
                    }
                });
            }
        });
    });
}

async function postOpenAIImageVariation(to,from){
    let data = null,
        msg = "",
        options = {
            multipart:true,
            json:true
        };
    for (let i=0; i < 3; i++) {
        data = {
            image:{
                file: path.join(__dirname,'openaiimages',to,`openaidalle_${i}.png`),
                content_type: 'image/png'
            }
        };
        msg += `${i+1}) ${await getImageURL(data, options,to)} `
    }
    data = {
        image:{
            file: path.join(__dirname,'openaiimages',to,`openaidalle.jpg`),
            content_type: 'image/jpg'
        }
    };
    msg += `1+2+3) ${await getImageURL(data, options,to)}`;
    bot.say(to,`@${from} here you go: ${msg}`);
    channels[to].openairunning = false;
}

function getUserOpenaiAPIKey (nick) {
    return new Promise( resolve => {
        const db = getDatabase();
        const api_key = db.prepare("select t_key from openai_apikeys where t_nick = ? COLLATE NOCASE").get(nick);
        if (api_key != undefined && api_key != "") {
            resolve(api_key.t_key);
        } else {
            resolve(null);
        }
    });
}

function setUserOpenaiAPIKey (nick, key) {
    return new Promise ( resolve => {
        const db = getDatabase();
        const setAPIKey = db.prepare("replace into openai_apikeys (t_nick, t_key) values (?, ?)");
        try {
            const create = db.transaction ( (nick,key) => {
                setAPIKey.run(nick,key);
            });
            create(nick,key);
            resolve(true);
        } catch (err) {
            bot.notice(nick,err);
            resolve(false);
        }
    });
}
function deleteUserOpenaiAPIKey (nick) {
    return new Promise ( resolve => {
        const db = getDatabase();
        const APIKey = db.prepare("select t_key from openai_apikeys where t_nick = ? COLLATE NOCASE").get(nick);
        if (APIKey != undefined && APIKey != "") {
            const deleteAPIKey = db.prepare("delete from openai_apikeys where t_nick = ?");
            try {
                const deletekey = db.transaction ( (nick) => {
                    deleteAPIKey.run(nick);
                });
                deletekey(nick);
                resolve(true);
            } catch (err) {
                bot.notice(nick,err);
                resolve(false);
            }
        } else {
            resolve(false);
        }
    });
}

function getIgnoredChannels () {
    return new Promise(resolve => {
        let db = getDatabase();
        let channels = db.prepare("select t_channel_name from channels where ignore = 1 COLLATE NOCASE");
        let ignoredChannels = [];
        if (channels != undefined) {
            for (const channel of channels.iterate()){
                ignoredChannels.push(channel.t_channel_name);
            }
        }
        if (ignoredChannels.length > 0)
            resolve(ignoredChannels);
        else
            resolve(null);
    });
}

function getEnabledModulesInChannel (channel) {
    return new Promise(resolve => {
        let db = getDatabase();
        let modules = db.prepare("select t_module_name from modules where t_channel_name = ? COLLATE NOCASE");
        let arrayModules = [];
        for (const module of modules.iterate(channel)){
            arrayModules.push(module.t_module_name);
        }
        if (arrayModules.length > 0)
            resolve(arrayModules);
        else
            resolve(null);
    });
}

function isModuleEnabledInChannel (channel, module) {
    return new Promise(resolve => {
        let db = getDatabase();
        const modules = db.prepare("select t_module_name from modules where t_channel_name = ? COLLATE NOCASE");
        let arrayModules = [];
        for (const module of modules.iterate(channel)){
            arrayModules.push(module.t_module_name);
        }
        if (arrayModules.length > 0 && arrayModules.indexOf(module) != -1)
            resolve(true);
        else
            resolve(false);
    });
}

function modules (event) {
    let
        nick = null,
        removeIndex = null,
        hostname = null,
        to = null;
    commands.forEach ( async function ( command, index ) {
        if ( command.nick == event.nick ) {
            nick = event.nick;
            to = command.channel;
            hostname = command.hostname;
            removeIndex = index;
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(hostname) != -1 || config.irc.adminNicks.indexOf(nick) != -1)) {
                let modules = await getEnabledModulesInChannel(to);
                if (modules && modules.length > 0){
                    bot.notice(nick, `Enabled modules in ${to}: ${modules}.`);
                } else {
                    bot.notice(nick, `No modules enabled in ${to}.`);
                }
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.notice(nick, 'You must be OWNER (~) or bot admin to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function ignore_channel (event) {
    let
    removeIndex = null,
    nick = null,
    to = null,
    hostname = null,
    db = getDatabase();
    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            nick = event.nick,
            to = command.channel;
            hostname = command.hostname;
            removeIndex = index;
            if (config.irc.adminHostnames.indexOf(hostname) != -1 ) {
                const ignorechannel = db.prepare('replace into channels (t_channel_name, ignore) values (?, true)');
                try {
                    const ignore = db.transaction( (to) => {
                        ignorechannel.run(to);
                    });
                    ignore(to);
                    bot.notice(nick,`Now ignoring '${to}' channel.`);
                } catch (err) {
                    bot.notice(nick,err);
                }
            } else {
                bot.notice(nick, 'You must be bot admin to perform that action.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function unignore_channel (event) {
    let
    removeIndex = null,
    to = null,
    nick = null,
    hostname = null,
    db = getDatabase();
    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            nick = event.nick,
            to = command.channel;
            hostname = command.hostname;
            removeIndex = index;
            if (config.irc.adminHostnames.indexOf(hostname) != -1 ) {
                const ignorechannel = db.prepare('replace into channels (t_channel_name, ignore) values (?, false)');
                try {
                    const ignore = db.transaction( (to) => {
                        ignorechannel.run(to);
                    });
                    ignore(to);
                    bot.notice(nick,`Removed '${to}' channel ignore.`);
                } catch (err) {
                    bot.notice(nick,err);
                }
            } else {
                bot.notice(nick, 'You must be bot admin to perform that action.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function ignoring (event) {
    let
    removeIndex = null,
    nick = null,
    hostname = null;
    commands.forEach (async function ( command, index ) {
        if ( command.nick == event.nick ) {
            nick = event.nick,
            hostname = command.hostname;
            removeIndex = index;
            if (config.irc.adminHostnames.indexOf(hostname) != -1 ) {
                let channels = await getIgnoredChannels();
                if (channels && channels.length > 0){
                    bot.notice(nick, `Ingored channels: ${channels}.`);
                } else {
                    bot.notice(nick, `No ignored channels.`);
                }
            } else {
                bot.notice(nick, 'You must be bot admin to perform that action.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function enable (event) {
    let
        nick = null,
        removeIndex = null,
        module = null,
        to = null,
        hostname = null,
        db = getDatabase();
    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            nick = event.nick,
            module = command.module;
            to = command.channel;
            hostname = command.hostname,
            removeIndex = index;
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(hostname) != -1 )) {
                const joinedchannels = db.prepare("select * from channels where t_channel_name = ? COLLATE NOCASE").get(to);
                if (joinedchannels == undefined) {
                    const newChannel = db.prepare("insert into channels (t_channel_name) values (?)");
                    const newModule = db.prepare("insert into modules (t_channel_name, t_module_name) values (?, ?)");
                    try {
                        const join = db.transaction( (to,module) => {
                            newChannel.run(to);
                            newModule.run(to,module);
                        });
                        join(to,module);
                        bot.notice(nick,`Enabled new '${module}' module in ${to}.`);
                    } catch (err) {
                        bot.notice(nick,err);
                    }
                } else {
                    const modules = db.prepare("select * from modules where t_channel_name = ? and t_module_name = ? COLLATE NOCASE").get(to,module);
                    if (modules == undefined) {
                        const newModule = db.prepare("insert into modules (t_channel_name, t_module_name) values (?, ?)");
                        try {
                            const join = db.transaction((to,module) => {
                                newModule.run(to,module);
                            });
                            join(to,module);
                            bot.notice(nick,`Enabled '${module}' module in ${to}.`);
                        } catch (err) {
                            bot.notice(nick,err);
                        }
                    } else {
                        bot.notice(nick,`Module '${module}' already enabled in ${to}.`);
                    }
                }
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.notice(nick, 'You must be OWNER (~) or bot admin to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function disable (event) {
    let
        nick = null,
        removeIndex = null,
        module = null,
        to = null,
        hostname = null,
        db = getDatabase();
    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            nick = event.nick,
            module = command.module;
            to = command.channel;
            hostname = command.hostname;
            console.log(`Hostname: ${hostname}`);
            removeIndex = index;
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(hostname) != -1 )) {
                const modules = db.prepare("select * from modules where t_channel_name = ? COLLATE NOCASE").all(to);
                if (modules == undefined && modules.indexOf(module) == -1) {
                    bot.notice(nick,`Module '${module}' not enabled in ${to}.`); 
                        
                } else {
                    const disableModule = db.prepare("delete from modules where t_channel_name = ? and t_module_name = ?");
                    try {
                        const disable = db.transaction((channel,module) => {
                            disableModule.run(channel,module);
                        });
                        disable(to,module);
                        bot.notice(nick,`Disabled '${module}' module in ${to}.`);
                    } catch (err) {
                        bot.notice(nick,err);
                    }
                }
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.notice(nick, 'You must be OWNER (~) or bot admin to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function follow (event) {
    let
        nick = null,
        removeIndex = null,
        handle = null,
        to = null,
        hostname = null,
        db = getDatabase();
    commands.forEach ( async function ( command, index ) {
        if ( command.nick == event.nick ) {
            nick = event.nick,
            handle = command.handle;
            to = command.channel;
            hostname = command.hostname;
            removeIndex = index;
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '@' || event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(hostname) != -1 )) {
                // IRC USER HAS OPER OR MORE
                let result = await twitter.findTwitterUser(handle);
                if (result) {
                    console.log(result);
                    // add twitter ID
                    // see if it doesn't exist already
                    const joinedchannels = db.prepare("select * from channels where t_channel_name = ? COLLATE NOCASE").get(to);
                    if (joinedchannels == undefined) {
                        const newChannel = db.prepare("insert into channels (t_channel_name) values (?)");
                        const newHandle = db.prepare("insert into handles (t_channel_name, t_module_name) values (?, ?)");
                        try {
                            const follow = db.transaction( (to,screen_name) => {
                                newChannel.run(to);
                                newHandle.run(to,screen_name);
                            });
                            follow(to,handle);
                            bot.notice(nick,`Now following ${result.name} in ${to}.`);
                        } catch (err) {
                            bot.notice(nick,err);
                        }
                    } else {
                        const handles = db.prepare("select * from handles where t_channel_name = ? and t_handle_name = ? COLLATE NOCASE").get(to,result.username);
                        if (handles == undefined) {
                            const newHandle = db.prepare("insert into handles (t_channel_name, t_handle_name) values (?, ?)");
                            try {
                                const follow = db.transaction((to,screen_name) => {
                                    newHandle.run(to,screen_name);
                                });
                                follow(to,result.username);
                                bot.notice(nick,`Now following ${result.name} in ${to}.`);
                                stream.endStream();
                            } catch (err) {
                                bot.notice(nick,err);
                            }
                        } else {
                            bot.notice(nick,`Already following ${result.name} in ${to}.`);
                        }
                    }
                } else {
                    bot.notice(nick,'Tweeter handle not found!.');
                }
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.notice(nick, 'You must be OWNER (~) or bot admin to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function unfollow (event) {
    let
        nick = null,
        removeIndex = null,
        handle = null,
        to = null,
        hostname = null,
        db = getDatabase();
    commands.forEach ( function ( command, index ) {
        if ( command.nick == event.nick ) {
            nick = event.nick;
            handle = command.handle;
            to = command.channel;
            hostname = command.hostname;
            removeIndex = index;
            let data = { "screen_name" : handle };
            if ( event.channels.indexOf(to) >= 0 && ( event.channels[event.channels.indexOf(to)-1] == '@' || event.channels[event.channels.indexOf(to)-1] == '&' || event.channels[event.channels.indexOf(to)-1] == '~' || config.irc.adminHostnames.indexOf(hostname) != -1 )) {
                // IRC USER HAS OPER OR MORE
                const following = db.prepare("select t_handle_name from handles where t_channel_name = ? and t_handle_name = ? COLLATE NOCASE").get(to,handle);
                if (following == undefined) {
                    bot.notice(nick,`Not following ${handle} in ${to}.`); 
                } else {
                    const unfollowHandle = db.prepare("delete from handles where t_channel_name = ? and t_handle_name = ?");
                    try {
                        const unfollow = db.transaction((channel,handle) => {
                            unfollowHandle.run(channel,handle);
                        });
                        unfollow(to,handle);
                        bot.notice(nick,`Unfollowed @${handle} in ${to}.`);
                        const remaining = db.prepare("select * from handles where t_handle_name = ? COLLATE NOCASE").get(handle);
                        if (remaining != undefined)
                            stream.updateChannels(db);
                        else
                            stream.endStream();
                    } catch (err) {
                        bot.notice(nick,err);
                    }
                }
            } else {
                // IRC USER DOESN'T HAVE OPER OR MORE
                bot.notice(nick, 'You must be OWNER (~) or bot admin to perform that action in this channel.');
            }
        }
    });
    commands.splice(removeIndex,1);
}

function joinChannels(){
    const db = getDatabase();
    return new Promise ( resolve => {
        const getChannels = db.prepare('select t_channel_name, ignore from channels');
        let arrayChannels = [];
        for (const channel of getChannels.iterate()){
            if (!channel.ignore) {
                arrayChannels.push(channel.t_channel_name);
                bot.join(channel.t_channel_name);
                channels[channel.t_channel_name] = { running: false };
                channels[channel.t_channel_name] = { openairunning: false };
            } else {
                console.log(`Channel ${channel.t_channel_name} was ignored.`);
            }
        }
        if (arrayChannels.length > 0){
            resolve(arrayChannels);
        } else {
            resolve(null);
        }
    });
}

function initDatabase(){
    return new Promise( resolve => {
        if (config?.sqlite3?.filename){
            try {
                const db = new Database(config.sqlite3.filename, { verbose: console.log, fileMustExist: true });
                setDatabase(db);
                resolve(db);
            } catch (e) {
                console.log(`${e}. Creating new database file...`);
                const db = new Database(config.sqlite3.filename, { verbose: console.log });
                fs.readFile('create_db.sql', 'utf8', (err,data) => {
                    db.exec(data);
                    setDatabase(db);
                    resolve(db);
                });
            }
        } else {
            console.log(`No database file ${config?.sqlite3?.filename} found.`);
            bot.say("#testing",`No database file ${config?.sqlite3?.filename} found.`);
            resolve(null);
        }
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
    const db = getDatabase();
    let from=event.nick,
        ident=event.ident,
        hostname=event.hostname,
        to=event.channel,
        isIgnored = true;
    console.log(`Channel: ${to}`);
    const ignored = db.prepare("select ignore from channels where t_channel_name = ? COLLATE NOCASE").get(to);
    if ( ignored == undefined || ignored.ignore == 0) {
        isIgnored = false;
    }
    if ( !isIgnored && config.irc.ignoreHostnames.indexOf(hostname) === -1 && config.irc.ignoreNicks.indexOf(from) === -1 && config.irc.ignoreIdents.indexOf(ident) === -1 && event.channel.indexOf(to) >= 0 ) {
        channels.push(event.channel);
        channels[event.channel] = { running: false };
        channels[event.channel] = { openairunning: false };
        bot.join(event.channel);
    } else {
        bot.notice(from,`Channel '${to}' is server side ignored.`);
    }
});

bot.on('connected', async function() {
    console.log("Bot started and connected");
    db = await initDatabase();
    if (process.env.TESTING == "true") {
        config.irc.channels.forEach( channel => {
            bot.join(channel);
            channels[channel] = { running: false };
            channels[channel] = { openairunning: false };
        });
    } else {
        if (db) {
            let arrayChannels = await joinChannels();
            if (!arrayChannels){
                bot.join("#testing");
                bot.say("#testing",`No channels to join, joined #testing in the meantime...`);
            } else {
                console.log(`Joined channels: '${arrayChannels}'`);
            }
            stream.startStream(db,bot);
        } else {
            bot.say("#testing",`Error initializing database...`);
        }
    }
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
                    if (token) {
                        let username = message.slice(message.search(/@/)+1),
                            result = await twitter.getLastTweetFromUsername(username);
                        if (result) {
                            result[0].text = result[0].text.replace(/\n/g, ' ');
                            htmlKeys.forEach( curr => {
                                result[0].text = result[0].text.replace(new RegExp(curr,'g'),unescape(curr, result[0].text));
                            });
                            sendTweet(to,result[0].text,username,result[0].created_at,result[0].public_metrics.retweet_count,result[0].public_metrics.like_count,false,null,null);
                        } else {
                            bot.say(to,`No results for @${username}!.`);
                        }
                    } else // No auth data, ask user to authenticate bot
                        bot.notice(from,'No auth data.');
                } else
                // general search
                if (message.match(/^\.ut\s.+$/)) {
                    if (token) {
                        let
                            sq = message.slice(4),
                            result = await twitter.seartchTweets(sq);
                        if (result) {
                            let author = await twitter.getTweetAuthorById (result[0].author_id);
                            result[0].text = result[0].text.replace(/\n/g, ' ');
                            htmlKeys.forEach( curr => {
                                result[0].text = result[0].text.replace(new RegExp(curr,'g'),unescape(curr,result[0].text));
                            });
                            sendTweet(to,result[0].text,author.name,result[0].created_at,result[0].public_metrics.retweet_count,result[0].public_metrics.like_count,false,null,null);
                        } else {
                            bot.say(to,`No results for ${sq}!.`);
                        }
                    } else { // No auth data, ask user to authenticate bot 
                        bot.notice(from,'No auth data.');
                    }
                } else
                    bot.notice(from,'Invalid command.');
            } else {
                bot.notice(from,`The 'twitter search' module is not enabled in ${to}.`);
            }
        } else
        // get twitter.com or t.co link
        if (message.match(/twitter\.com\/\w+\/status\/\d+/) || message.match(/twitter\.com\/i\/web\/status\/\d+/) || message.match(/t\.co\/\w+/)) {
            if (await isModuleEnabledInChannel(to,"twitter expand")) {
                if (token) {
                    if (message.match(/t\.co\/\w+/)) {
                        // message contains a t.co link
                        message=`https://${message.match(/t\.co\/\w+/)[0]}`;
                        needle.head(message, async function(err,res) {
                            message=res.headers.location;
                            if (message && message.match(/twitter\.com\/\w+\/status\/\d+/)) {
                                // it is a valid twitter status url
                                let id = message.slice(message.search(/\/\d+/)+1),
                                    tweet = await twitter.getTweetById(id),
                                    author = await twitter.getTweetAuthorById(tweet.author_id);
                                if (tweet) {
                                    sendTweet(to,tweet.text,author.name,tweet.created_at,tweet.retweet_count,tweet.public_metrics.like_count,false,null,null);
                                }
                            }
                        });
                        return;
                    } else
                    // message contains twitter.com status link
                    if (message.match(/twitter\.com\/\w+\/status\/\d+/))
                        message=message.match(/twitter\.com\/\w+\/status\/\d+/)[0];
                    else   
                        message=message.match(/twitter\.com\/i\/web\/status\/\d+/)[0];
                    let id = message.slice(message.search(/\/status\/\d+/)+8),
                        tweet = await twitter.getTweetById(id),
                        author = await twitter.getTweetAuthorById(tweet.author_id);
                    if (tweet && tweet.referenced_tweets && tweet.referenced_tweets[0].type == "quoted") {
                        let quotted_tweet = await twitter.getTweetById(tweet.referenced_tweets[0].id),
                            quotted_tweet_author = await twitter.getTweetAuthorById(quotted_tweet.author_id);
                        tweet.text = tweet.text.replace(/https:\/\/t\.co\/.+$/i,'').trimRight();
                        sendTweet(to,tweet.text,author.name,tweet.created_at,tweet.public_metrics.retweet_count,tweet.public_metrics.like_count,true,quotted_tweet_author.username,quotted_tweet.text);
                    } else if (tweet) {
                        sendTweet(to,tweet.text,author.name,tweet.created_at,tweet.public_metrics.retweet_count,tweet.public_metrics.like_count,false,null,null);
                    }
                } else { // No auth data, ask user to authenticate bot 
                    bot.notice(from,'No auth data.');
                }
            }
        } else //youtube link
        if (message.match(/(https?:\/\/)?(www\.)?youtube\.com\/.+/) || message.match(/(https?:\/\/)?(www\.)?youtu\.be\/.+/)) {
            if (await isModuleEnabledInChannel(to,"youtube read")) {
                let likes = 0, title = "", date = "", description = "", account = "", duration = "", v = "", youtubeapirequest = "", views = "", result = "";
                if (message.match(/v=.+&?/)){
                    v = message.slice(message.match(/v=.+&?/).index + 2);
                } else
                if (message.match(/\.be\/.+&?/)) {
                    v = message.slice(message.match(/\.be\/.+&?/).index + 4);
                } else
                if (message.match(/shorts\/.+/)) {
                    if(message.match(/\?/)){
                        v = message.slice(message.match(/shorts\/.+/).index + 7,message.match(/\?/).index);
                    } else {
                        v = message.slice(message.match(/shorts\/.+/).index + 7);
                    }
                }
                if (v != "") {
                    youtubeapirequest = youtubeVideosURL + "?part=statistics,snippet,contentDetails&id=" + v + "&key=" + youtubeAPIKey;
                    needle.get(youtubeapirequest, { headers: { "Accept-Language": "en-US", "Accept": "application/json"}}, function(err, r, result) {
                        if (err) {
                            bot.notice(from,`Error: ${err}`);
                            throw Error(err);
                        }
                        if (!result.errors && result && result.items[0]) {
                            title = result.items[0].snippet.title;
                            date = result.items[0].snippet.publishedAt;
                            description = result.items[0].snippet.description;
                            account = result.items[0].snippet.channelTitle;
                            likes = result.items[0].statistics.likeCount;
                            views = result.items[0].statistics.viewCount;
                            duration = result.items[0].contentDetails.duration;
                            sendYouTubevideo(to,title,description,account,date,likes,views,duration);
                        }
                    });
                }
            }
        } else
        if (message.match(/^\.yt\s.+$/)) {
            if (await isModuleEnabledInChannel(to,"youtube search")) {
                let likes = 0, title = "", date = "", description = "", account = "", duration = "", query = "", id = "", youtubeapirequest = "", views = "", result = "";
                query = message.slice(4);
                if (query != "") {
                    youtubeapirequest = youtubeSearchURL + "?part=snippet&maxResults=5&q=" + query + "&safeSearch=none&type=video&key=" + youtubeAPIKey;
                    needle.get(youtubeapirequest, { headers: { "Accept": "application/json"}}, function(err, r, res) {
                        if (res.items.length >= 1) {
                            res.items.forEach((video,i) => {
                                if (video.snippet.title == query) {
                                    id = video.id.videoId;
                                }
                            });
                            if (id == "")
                                id = res.items[0].id.videoId;
                            youtubeapirequest = youtubeVideosURL +"?part=statistics,snippet,contentDetails&id=" + id + "&key=" + youtubeAPIKey;
                            needle.get(youtubeapirequest, { headers: { "Accept": "application/json"}}, function(err, r, result) {
                                if (err) {
                                    bot.notice(from,`Error: ${err}`);
                                    throw Error(err);
                                }
                                if (!result.errors && result && result.items[0]) {
                                    title = result.items[0].snippet.title;
                                    date = result.items[0].snippet.publishedAt;
                                    description = result.items[0].snippet.description;
                                    account = result.items[0].snippet.channelTitle;
                                    likes = result.items[0].statistics.likeCount;
                                    views = result.items[0].statistics.viewCount;
                                    duration = result.items[0].contentDetails.duration;
                                    sendYouTubevideo(to,title,description,account,date,likes,views,duration,id);
                                }
                            });
                        } else {
                            bot.notice(from,`No YouTube results for '${query}'`);
                        }
                    });
                }
            } else {
                bot.notice(from,`The 'youtube search' module is not enabled in ${to}.`);
            }
        } else
        if (message.match(/twitter\.com\/i\/spaces\/.+&?/)) {
            if (await isModuleEnabledInChannel(to,"twitter expand")) {
                if (token) {
                    let id = message.slice(message.search(/\/spaces\/\w+/)+8,message.search(/\?/)),
                        result = await twitter.getSpaceById(id);
                    if (result) {
                        htmlKeys.forEach( curr => {
                            result.title = result.title.replace(new RegExp(curr,'g'),unescape(curr,result.title));
                        });
                        sendSpace(to,result.title,result.state,result.started_at,result.host_ids,result.participant_count);
                    }
                } else { // No auth data, ask user to authenticate bot 
                    bot.notice(from,'No auth data.');
                }
            }
        } else
        // any non-twitter non-youtube url and ignore files
        if (message.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/)) {
            if (await isModuleEnabledInChannel(to,"url read")) {
                let url=message.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/)[0];
                let options = { follow_max: 5, headers: {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.52'}};
                let stream = needle.get(url, options);
                let chunk = null;
                stream.on('readable', function() {
                    if (chunk = this.read()){
                        if (chunk != "\r\n") {
                            if (chunk.toString().match(/<title>(.*?)<\/title>/)) {
                                let title = chunk.toString().match(/<title>(.*?)<\/title>/)[1];
                                htmlKeys.forEach( curr => {
                                    title = title.replace(new RegExp(curr,'g'),unescape(curr,title));
                                });
                                bot.say(to,`Title: ${title}`);
                                stream.request.abort();
                            }
                        }
                    }
                });
            }
        } else
        if (message.match(/^\.modules$/)) {
            commands.push({'nick': from, 'channel': to, 'hostname': hostname});
            bot.whois(from,modules);
        } else
        if ( message.match(/^\.ignore\s.+$/)) {            
            let channel = null;
            if (message.match(/^\.ignore\s#.+$/)) {
                channel = message.match(/#.+/);
                commands.push({'nick': from, 'channel': channel, 'hostname': hostname});
                bot.whois(from,ignore_channel);
            }
        } else
        if ( message.match(/^\.unignore\s.+$/)) {            
            let channel = null;
            if (message.match(/^\.unignore\s#.+$/)) {
                channel = message.match(/#.+/);
                commands.push({'nick': from, 'channel': channel, 'hostname': hostname});
                bot.whois(from,unignore_channel);
            }
        } else
        if ( message.match(/^\.ignoring$/)) {            
            let channel = null;
            if (message.match(/^\.ignoring$/)) {
                commands.push({'nick': from, 'hostname': hostname });
                bot.whois(from,ignoring);
            }
        } else
        if ( message.match(/^\.enable\s\w+(\s\w+)*$/)) {            
            let module = null;
            if (message.match(/^\.enable\s\w+(\s\w+)*$/))
                module = message.slice(message.search(/\s\w+(\s\w+)*$/)+1);
            if (module == "twitter expand" || module == "dalle" || module == "twitter follow" || module == "twitter search" || module == "url read" || module == "openai" || module == 'imdb' || module == 'youtube read' || module == 'youtube search'){
                commands.push({'nick': from, 'module': module, 'channel': to, 'hostname': hostname});
                bot.whois(from,enable);
            } else {
                bot.notice(from,`Module '${module}' not found`);
            }
        } else
        if ( message.match(/^\.disable\s\w+(\s\w+)*$/)) {
            // .disable command - disable module on a channel
            let module = null;
            if (message.match(/^\.disable\s\w+(\s\w+)*$/))
                module = message.slice(message.search(/\s\w+(\s\w+)*$/)+1);
            if (module == "twitter expand" || module == "dalle" || module == "twitter follow" || module == "twitter search" || module == "url read" || module == "openai" || module == 'imdb' || module == 'youtube read' || module == 'youtube search'){
                commands.push({'nick': from, 'module': module, 'channel': to, 'hostname': hostname});
                bot.whois(from,disable);
            } else {
                bot.notice(from,`Module '${module}'not found`);
            }
        }else
        if (message.match(/^\.follow\s@?\w+$/)) {
            // .follow command - add user ID to stream
            if (await isModuleEnabledInChannel(to,"twitter follow")) {
                if (token) {
                    var handle = null;
                    if (message.match(/^\.follow\s@\w+$/))
                        handle = message.slice(message.search(/@\w+$/)+1);
                    else
                        handle = message.slice(message.search(/\s\w+$/)+1);
                    commands.push({'nick': from, 'handle': handle, 'channel': to, 'hostname': hostname});
                    bot.whois(from,follow);
                } else // No auth data, ask user to authenticate bot
                    bot.notice(from,'No auth data.');
            } else {
                bot.notice(from,`The 'twitter follow' module is not enabled in ${to}.`);
            }
        } else
        if (message.match(/^\.unfollow\s@?\w+$/)) {
            // .unfollow command - remove user ID from stream
            if (await isModuleEnabledInChannel(to,"twitter follow")) {
                if (token) {
                    var handle=null;
                    if (message.match(/^\.unfollow\s@\w+$/))
                        handle = message.slice(message.search(/@\w+$/)+1);
                    else
                        handle = message.slice(message.search(/\s\w+$/)+1);
                    // add command to commands queue
                    commands.push({'nick': from, 'handle': handle, 'channel': to, 'hostname': hostname});
                    bot.whois(from, unfollow);
                } else // No auth data, ask user to authenticate bot
                    bot.notice(from,'No auth data.');
            } else {
                bot.notice(from,`The 'twitter follow' module is not enabled in ${to}.`);
            }
        } else
        if (message.match(/^\.following$/)) {
            if (await isModuleEnabledInChannel(to,"twitter follow")) {
                let db = getDatabase();
                if (token) {
                    const following = db.prepare("select * from handles where t_channel_name = ? COLLATE NOCASE");
                    let following_handles = [];
                    for (const handle of following.iterate(to)){
                        following_handles.push(handle.t_handle_name);
                    }
                    if (following_handles.length > 0){
                        let result = await twitter.findTwitterUsers(following_handles.toString());
                        if (result) {
                            let accounts=`${result[0].name} (@${result[0].username})`;
                            result.forEach( function (current,index) {
                                if (index>0)
                                    accounts+=`, ${current.name} (@${current.username})`;
                            });
                            bot.notice(from,`Following: ${accounts} in ${to}.`);
                        } else {
                            bot.notice(from,`Not following anyone in ${to} yet!.`);
                        }
                    } else {
                        bot.notice(from,`Not following anyone in ${to} yet!.`); 
                    }
                } else // No auth data, ask user to authenticate bot
                    bot.notice(from,'No auth data.');
            } else {
                bot.notice(from,`The 'twitter follow' module is not enabled in ${to}.`);
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
                            fs.access(path.join(__dirname,'images',to), (err) => {
                                if (err){
                                    fs.mkdirSync(path.join(__dirname,'images',to), { recursive: true });
                                }
                                let buffer = null;
                                for (let i=0; i < response.body.images.length ; i++){
                                    buffer = Buffer.from(response.body.images[i], "base64");
                                    fs.writeFile(path.join(__dirname,'images',to,`dall-e_result_${i}.jpg`), buffer, (err) => {
                                        if (!err && i == (response.body.images.length -1)){
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
                                        }
                                    });
                                }
                            });
                        } else {
                            if (response.statusCode == 524){
                                bot.notice(from,`@${from} Dall-E Service is too Busy. Please try again later...`);
                            } else {
                                bot.say(to,`Dall-E Error ${response.statusCode}: ${response.statusMessage}`);
                            }
                            channels[to].running = false;
                        }
                    });
                } else {
                    bot.notice(from,`@${from} please wait for the current Dall-E request to complete.`);
                }
            } else {
                bot.notice(from,`The 'dalle' module is not enabled in ${to}.`);
            }
        } else
        if (message.match(/\.openai\s.+$/)) {
            if (await isModuleEnabledInChannel(to,"openai")) {
                let openaiAPIKey = await getUserOpenaiAPIKey(from);
                if (openaiAPIKey){
                    if (message.match(/\.openai\shttps?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,5}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)\.png/)){
                        let url = message.slice(message.match(/\.openai\shttps?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,5}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)\.png/).index+8).trim();
                        if (!channels[to].openairunning){
                            channels[to].openairunning = true;
                            bot.say(to,`Generating variations...`);
                            deleteOpenAIImage(to);
                            needle.get(url, async (err, res) => {
                                if (!err && res.statusCode == 200) {
                                    let resized = false;
                                    fs.writeFile(path.join(__dirname,'openaiimages',to,'variation.png'), res.raw, async (err) => {
                                        if (!err) {
                                            resized = await resizeImage(path.join(__dirname,'openaiimages',to,'variation.png'),to,3000000);
                                            if (resized) {
                                                var data = {
                                                    image: {
                                                        file: path.join(__dirname,'openaiimages',to,resized),
                                                        content_type: "image/png"
                                                    },
                                                    "n": 3,
                                                    "response_format": "b64_json",
                                                    "size": "512x512",
                                                    "user": "undertweetv4"
                                                }
                                            } else {
                                                var data = {
                                                    image: {
                                                        file: path.join(__dirname,'openaiimages',to,'variation.png'),
                                                        content_type: "image/png"
                                                    },
                                                    "n": 3,
                                                    "response_format": "b64_json",
                                                    "size": "512x512",
                                                    "user": "undertweetv4"
                                                }
                                            }
                                            needle.post(openAIAPIVariationsUrl, data, {headers: {"Authorization": `Bearer ${openaiAPIKey}`}, multipart: true },function (error,response){
                                                if (!error && response.statusCode == 200){
                                                    fs.access(path.join(__dirname,'openaiimages',to), (err) => {
                                                        if (err){
                                                            fs.mkdirSync(path.join(__dirname,'openaiimages',to), { recursive: true });
                                                        }
                                                        let buffer = null;
                                                        for (let i=0; i < response.body.data.length ; i++){
                                                            buffer = Buffer.from(response.body.data[i].b64_json, "base64");
                                                            fs.writeFile(path.join(__dirname,'openaiimages',to,`openaidalle_${i}.png`), buffer, "base64", (err) => {
                                                                if (!err && i == (response.body.data.length -1)){
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
                                                                }
                                                            });
                                                        }
                                                    });
                                                } else {
                                                    if (response.statusCode == 524){
                                                        bot.notice(from,`@${from} OpenAI Dall-E Service is too Busy. Please try again later...`);
                                                    } else
                                                    if (response.statusCode == 401){
                                                        bot.say(to,`OpenAI Dall-E Error: "Incorrect API key provided. You can find your API key at https://beta.openai.com.`);
                                                    } else {
                                                        if (response.body.error && response.body.error.message)
                                                            bot.say(to,`OpenAI Dall-E Error: ${JSON.stringify(response.body.error.message)}`);
                                                        else{
                                                            if (response.statusCode && !error)
                                                                bot.say(to,`OpenAI Dall-E Status Code: ${JSON.stringify(response.statusCode)}`);
                                                            else if (response.statusCode && error)
                                                                bot.say(to,`OpenAI Dall-E Status Code: ${JSON.stringify(response.statusCode)} Error: ${JSON.stringify(error)}`);
                                                            else if (error)
                                                                bot.say(to,`OpenAI Dall-E Error: ${JSON.stringify(error)}`);
                                                        }
                                                    }
                                                    channels[to].openairunning = false;
                                                }
                                            });
                                        }
                                    });
                                } else {
                                    bot.notice(from,`@${from} Error downloading variation image.`);
                                    channels[to].openairunning = false;
                                }
                            });
                        } else {
                            bot.notice(from,`@${from} please wait for the current OpenAI Dall-E request to complete.`);
                        }
                    } else 
                        if (message.match(/\.openai\shttps?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,5}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/)){
                            bot.notice(from,`@${from} Variation image must be a valid PNG file and less than 4MB.`);
                        } else {
                            //generate image variation by preview image number
                            if (message.match(/\.openai\s[1-3]$/)){
                                let imageNumber = message.match(/[1-3]$/)[0];
                                fs.access(path.join(__dirname,'openaiimages',to,`openaidalle_${imageNumber-1}.png`), (err) => {
                                    if (!err){
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
                                                "size": "512x512",
                                                "user": "undertweetv3"
                                            }
                                            needle.post(openAIAPIVariationsUrl, data, {headers: {"Authorization": `Bearer ${openaiAPIKey}`}, multipart: true },function (error,response){
                                                if (!error && response.statusCode == 200){
                                                    let buffer = null;
                                                    for (let i=0; i < response.body.data.length ; i++){
                                                        buffer = Buffer.from(response.body.data[i].b64_json, "base64");
                                                        fs.writeFile(path.join(__dirname,'openaiimages',to,`openaidalle_${i}.png`), buffer, "base64", (err) => {
                                                            if (!err && i == (response.body.data.length -1)){
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
                                                            }
                                                        });
                                                    }
                                                } else {
                                                    if (response.statusCode == 524){
                                                        bot.notice(from,`@${from} OpenAI Dall-E Service is too Busy. Please try again later...`);
                                                    } else
                                                    if (response.statusCode == 401){
                                                        bot.say(to,`OpenAI Dall-E Error: "Incorrect API key provided. You can find your API key at https://beta.openai.com.`);
                                                    } else {
                                                        bot.say(to,`OpenAI Dall-E Error: ${JSON.stringify(response.body.error.message)}`);
                                                    }
                                                    channels[to].openairunning = false;
                                                }
                                            });
                                        } else {
                                            bot.notice(from,`@${from} please wait for the current OpenAI Dall-E request to complete.`);
                                        }
                                    } else {
                                        bot.notice(from,`@${from} Selected image no longer exists.`);
                                    }
                                });
                            } else {
                                let prompt = message.slice(message.match(/\.openai\s.+$/).index+8).trim(),
                                    data = {
                                    "prompt": prompt,
                                    "n": 3,
                                    "response_format": "b64_json",
                                    "size": "512x512",
                                    "user": "undertweetv3"
                                }
                                // check if bot is not handling another call
                                if (!channels[to].openairunning){
                                    channels[to].openairunning = true;
                                    bot.say(to,`Generating from "${prompt}" prompt...`);
                                    deleteOpenAIImage(to);
                                    needle.post(openAIAPIGenerationsUrl, data, {headers: {"Content-Type": "application/json","Authorization": `Bearer ${openaiAPIKey}`}},function (error,response){
                                        if (!error && response.statusCode == 200){
                                            fs.access(path.join(__dirname,'openaiimages',to), (err) => {
                                                if (err){
                                                    fs.mkdirSync(path.join(__dirname,'openaiimages',to), { recursive: true });
                                                }
                                                let buffer = null;
                                                for (let i=0; i < response.body.data.length ; i++){
                                                    buffer = Buffer.from(response.body.data[i].b64_json, "base64");
                                                    fs.writeFile(path.join(__dirname,'openaiimages',to,`openaidalle_${i}.png`), buffer, "base64", (err) => {
                                                        if (!err && i == (response.body.data.length -1)){
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
                                                        }
                                                    });
                                                }
                                            });
                                        } else {
                                            if (response.statusCode == 524){
                                                bot.notice(from,`@${from} OpenAI Dall-E Service is too Busy. Please try again later...`);
                                            } else
                                            if (response.statusCode == 401){
                                                bot.say(to,`OpenAI Dall-E Error: "Incorrect API key provided. You can find your API key at https://beta.openai.com.`);
                                            } else {
                                                bot.say(to,`OpenAI Dall-E Error: ${JSON.stringify(response.body.error.message)}`);
                                            }
                                            channels[to].openairunning = false;
                                        }
                                    });
                                } else {
                                    bot.notice(from,`@${from} please wait for the current OpenAI Dall-E request to complete.`);
                                }
                            }
                        }
                    } else {
                        bot.notice(from,`You don't have an OpenAI API Key, create an account and get one from https://beta.openai.com/account/api-keys and then do /msg ${config.irc.nick} .setopenaiapikey <yourkey>`);
                    }
                } else {
                    bot.notice(from,`The 'openai' module is not enabled in ${to}.`);
                }
        } else
        if (message.match(/\.setopenaiapikey\s.+$/)) {
            let key = message.slice(17);
            if (await setUserOpenaiAPIKey(from,key)){
                bot.notice(from,`Saved OpenAI API Key for ${from}.`);
            } else {
                bot.notice(from,`Error saving OpenAI API Key for ${from}.`);
            }
        } else
        if (message.match(/\.delopenaiapikey$/)) {
            if (await deleteUserOpenaiAPIKey(from)){
                bot.notice(from,`Removed OpenAI API Key for ${from}.`);
            } else {
                bot.notice(from,`No OpenAI API Key found for ${from}.`);
            }
        } else
        if (message.match(/\.imdb\s.+$/)) {
            if (await isModuleEnabledInChannel(to,"imdb")) {
                if (!channels[to].running){
                    channels[to].running = true;
                    let imdbquery = message;
                    let title = "";
                    if (message.match(/\s-/)){
                        title = message.slice(message.match(/\.imdb\s/).index+6, message.match(/\s-/).index).trim().toLocaleLowerCase('en-us').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    } else {
                        title = message.slice(message.match(/\.imdb\s.+$/).index+6).trim().toLocaleLowerCase('en-us').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    }
                    let yearSearch = false;
                    imdbquery = "https://www.imdb.com/search/title/?title=" + title.replaceAll(" ","+");
                    if (message.match(/-m/)) {
                        imdbquery += "&title_type=feature";
                    }
                    if (message.match(/-tv/)) {
                        imdbquery += "&title_type=tv_series";
                    }
                    if (message.match(/-y\s[1-2][0,8,9]([0-9]){2}/)){
                        yearSearch = true;
                        imdbquery += "&release_date=" + message.slice(message.match(/[1-2][0,8,9]([0-9]){2}/).index,message.match(/[1-2][0,8,9]([0-9]){2}/).index+4) + "-01-01,";
                    }
                    // check if bot is not handling another call
                    needle.get(imdbquery, { headers: { "Accept-Language": "en-US" }}, function(err, res, body) {
                        const $ = cheerio.load(body);
                        let results = 0, index = 0, details = "", url = "", out = "", votes = "", gross = "";
                        $('.lister-item-content').map((i,card) =>{
                            if($(card).find('.lister-item-header').find('a').text().toLocaleLowerCase('en-us').normalize("NFD").replace(/[\u0300-\u036f]/g, "") == title){
                                results += 1;
                            }
                        });
                        if (results == 0) {
                            bot.say(to,`No results for '${title}'`);
                        } else {
                            $('.lister-item-content').map((i, card) => {
                                if($(card).find('.lister-item-header').find('a').text().toLocaleLowerCase('en-us').normalize("NFD").replace(/[\u0300-\u036f]/g, "") == title && (index+1) < 4 ){
                                    url = "https://imdb.com" + $(card).find('.lister-item-header').find('a').attr('href');
                                    url = url.substring(0,url.match(/\/\?ref_=adv_li_tt/).index);
                                    details = "";
                                    if ($(card).find('p.sort-num_votes-visible').find('span')){
                                        $(card).find('p.sort-num_votes-visible').find('span').map ( (i,info) => {
                                            if ($(info).attr('name') == 'nv' && $(info).text().indexOf("$") == -1)
                                                votes = $(info).text().replace(",","");
                                            if ($(info).attr('name') == 'nv' && $(info).text().indexOf("$") != -1)
                                                gross = $(info).text();
                                        });
                                    }
                                    let stars = $(card).find('.ratings-bar').find('strong').text() + " ";
                                    if ($(card).find('.ratings-bar').find('strong').text()) {
                                        for (i = 0 ; i < 10 ; i += 2) {
                                            if (i < parseInt($(card).find('.ratings-bar').find('strong').text())-1){
                                                stars += colors.yellow("\u2605");
                                            } else {
                                                stars += colors.gray("\u2606");
                                            }
                                        }
                                        if (votes != "") {
                                            if (parseInt(votes) > 1000000) {
                                                votes = Math.floor(parseInt(votes)/1000000).toString() + "M";
                                            } else 
                                            if (parseInt(votes) > 1000) {
                                                votes = Math.floor(parseInt(votes)/1000).toString() + "K";
                                            }
                                            stars += ` (${votes} votes)`;
                                        }
                                    } else {
                                        stars = colors.gray("\u2606") + " N/A";
                                    }
                                    if ($(card).find('p.text-muted')){
                                        $(card).find('p.text-muted').map((i, info) => {
                                            $(info).find('span').map((i,detail) => {
                                                details += `${$(detail).text().trim()} `;
                                            });
                                            if (i == $(card).find('p.text-muted').length - 1){
                                                details += `· "${$(info).text().trim().replace(/\s{2,}/gi, '')}"`;
                                            }
                                        });
                                    }
                                    out = `[${index+1}/${results}] ${$(card).find('.lister-item-header').find('a').text()} ${$(card).find('.lister-item-year').text()} · ${stars} ·${gross != "" ? ` ${gross} ·` : ``} ${details.replaceAll("|","·")} · ${url}`;
                                    if (out.length > 350) {
                                        out = `[${index+1}/${results}] ${$(card).find('.lister-item-header').find('a').text()} ${$(card).find('.lister-item-year').text()} · ${stars} ·${gross != "" ? ` ${gross} ·` : ``} ${details.replaceAll("|","·")}`;
                                        bot.say(to,out);
                                        bot.say(to,url);
                                    } else {
                                        bot.say(to,out);
                                    }
                                    index += 1;
                                }
                            }).get();
                            if (results > 3) {
                                bot.notice(from,`To view all the results visit: ${imdbquery}`);
                            }
                        }
                    });
                    channels[to].running = false;
                } else {
                    bot.notice(from,`@${from} please wait for the current IMDb search to complete.`);
                }
            } else {
                bot.notice(from,`The 'imdb' module is not enabled in ${to}.`);
            }
        }
        // if message is .help
        if (message.match(/^\.help$/)) {
            bot.notice(from,'Usage:');
            setTimeout(function() { bot.notice(from,'.enable <module name> - enables module in channel - must be OWNER (~) or bot admin.');},1000);
            setTimeout(function() { bot.notice(from,'.disable <module name> - disable module in channel - must be OWNER (~) or bot admin.');},1000);
            setTimeout(function() { bot.notice(from,'.modules - get enabled modules in channel - must be OWNER (~) or bot admin.');},1000);
            setTimeout(function() { bot.notice(from,`Available modules (case sensitive): 'twitter search', 'twitter follow', 'twitter expand', 'dalle', 'url read', 'openai', 'imdb', 'youtube read', 'youtube search'.`);},1000);
            setTimeout(function() { bot.notice(from,'.ut @twitter_handle - retrieves the last tweet from that account.');},1000);
            setTimeout(function() { bot.notice(from,'.ut <search terms> - search for one or more terms including hashtags.');},1000);
            setTimeout(function() { bot.notice(from,'.following - show twitter accounts followed in the channel.');},1000);
            setTimeout(function() { bot.notice(from,'.follow @twitter_handle - follows the account in the channel - must be OWNER (~) or bot admin.');},1000);
            setTimeout(function() { bot.notice(from,'.unfollow @twitter_handle - unfollows the account in the channel - must be OWNER (~) or bot admin.');},1000);
            setTimeout(function() { bot.notice(from,'.dalle <prompt> - generate dall-e images from prompt');},1000);
            setTimeout(function() { bot.notice(from,'.openai <prompt> - generate OpenAI Dall-E images from prompt');},1000);
            setTimeout(function() { bot.notice(from,'.openai URL - generate OpenAI Dall-E images from PNG image');},1000);
            setTimeout(function() { bot.notice(from,'.openai <1-3> - generate OpenAI Dall-E image variation from image number.');},1000);
            setTimeout(function() { bot.notice(from,'.setopenaiapikey <api_key> - set OpenAI API Key');},1000);
            setTimeout(function() { bot.notice(from,'.delopenaiapikey - delete OpenAI API Key');},1000);
            setTimeout(function() { bot.notice(from,'.help - this help message.');},1000);
        } else
        if (message.match(/^\.bots$/)) {
            bot.notice(from,`${config.irc.nick} [NodeJS], a Twitter bot for irc. Do .help for usage.`);
        } else
        if (message.match(/^\.source$/)) {
            bot.notice(from,`${config.irc.nick} [NodeJS] :: ${colors.white.bold('Source ')} ${packageInf.repository}`);
        }
    }
});

bot.on('registered', function (){
    bot.say('nickserv','identify '+ password);
})

bot.connect({host,port,tls,nick,username,gecos,password});
needle.defaults({user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.52'});
