'use strict';

const 
    needle = require('needle'),
    config = require('../config'),
    token = config.twitter.bearer_token;

exports.getTweetById = async function (id,bot) {
    let htmlKeys = ['&amp;', '&lt;', '&gt;', '&#(\\d+);'],
        result = await needle("get", `https://api.twitter.com/2/tweets?ids=${id}&tweet.fields=in_reply_to_user_id,entities,public_metrics,author_id,context_annotations,source,referenced_tweets,created_at&expansions=referenced_tweets.id`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`, "User-Agent": "v2TweetLookupJS"}});
    if (result.statusCode == 200 && result.body.data[0]) {
        if (!result.body.data[0].in_reply_to_user_id && result.body.includes && result.body.includes.tweets && result.body.data[0].referenced_tweets[0].type != "quoted" ){
            let author = await exports.getTweetAuthorById(result.body.includes.tweets[0].author_id);
            result.body.data[0].text = `RT @${author.username}: ${result.body.includes.tweets[0].text}`;
            result.body.data[0].public_metrics.like_count = result.body.includes.tweets[0].public_metrics.like_count;
            result.body.data[0].public_metrics.retweet_count = result.body.includes.tweets[0].public_metrics.retweet_count;                
        }
        result.body.data[0].text = result.body.data[0].text.replace(/\n/g, ' ');
        result.body.data[0].text = result.body.data[0].text.replace(/\s\s/g, ' ');
        htmlKeys.forEach( curr => {
            result.body.data[0].text = result.body.data[0].text.replace(new RegExp(curr,'g'),unescape(curr,result.body.data[0].text));
        });
        return result.body.data[0];
    } else {
        bot.say("#testing",`Failed getting Tweet by ID, statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        return null;
    }
}

exports.getTweetAuthorById = async function (id,bot) {
    let result = await needle("get", `https://api.twitter.com/2/users/${id}`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        bot.say("#testing",`Failed getting Tweet author by ID, statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        return null;
    }
}

exports.findTwitterUser = async function (username,bot) {
    let result = await needle('get',`https://api.twitter.com/2/users/by/username/${username}`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        bot.say("#testing",`Failed finding Twitter user, statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        return null;
    }
}

exports.findTwitterUsers = async function (usernames,bot) {
    let result = await needle('get',`https://api.twitter.com/2/users/by?usernames=${usernames}`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        bot.say("#testing",`Failed finging Twitter users, statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        return null;
    }
}

exports.getLastTweetFromUsername = async function (username,bot ) {
    let result = await needle('get',`https://api.twitter.com/2/tweets/search/recent?query=from:${username}&tweet.fields=public_metrics,author_id,context_annotations,source,referenced_tweets,created_at&expansions=referenced_tweets.id`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        if (result.statusCode != 400) {
            bot.say("#testing",`Failed getting Last Tweet from username, statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        }
        return null;
    }
}

exports.seartchTweets = async function (query,bot) {
    let result = await needle('get',`https://api.twitter.com/2/tweets/search/recent?query=${query}&tweet.fields=public_metrics,author_id,context_annotations,source,referenced_tweets,created_at&expansions=referenced_tweets.id`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        if (result.statusCode != 400) {
            bot.say("#testing",`Failed searching Tweets, statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        }
        return null;
    }
}

exports.getSpaceById = async function (id,bot) {
    let result = await needle('get',`https://api.twitter.com/2/spaces/${id}?space.fields=participant_count,started_at,state,title,host_ids`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        if (result.statusCode != 400) {
            bot.say("#testing",`Failed getting Space by ID, statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        }
        return null;
    }
}
