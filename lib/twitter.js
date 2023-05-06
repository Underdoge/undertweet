'use strict';

const 
    needle = require('needle'),
    config = require('../config'),
    token = config.twitter.bearer_token;

exports.getTweetById = async function (id) {
    let url = `https://api.twitter.com/2/tweets?ids=${id}&tweet.fields=public_metrics,author_id,context_annotations,source,referenced_tweets,created_at&expansions=referenced_tweets.id`,
        htmlKeys = ['&amp;', '&lt;', '&gt;', '&#(\\d+);'],
        result = await needle("get", url, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`, "User-Agent": "v2TweetLookupJS"}});
    if (result.statusCode == 200 && result.body.data[0]) {
        result.body.data[0].text = result.body.data[0].text.replace(/\n/g, ' ');
        htmlKeys.forEach( curr => {
            result.body.data[0].text = result.body.data[0].text.replace(new RegExp(curr,'g'),unescape(curr,result.body.data[0].text));
        });
        return result.body.data[0];
    } else {
        bot.say("#testing",`statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        return null;
    }
}

exports.getTweetAuthorById = async function (id) {
    let url = `https://api.twitter.com/2/users/${id}`;
    let result = await needle("get", url, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        bot.say("#testing",`statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        return null;
    }
}

exports.findTwitterUser = async function ( username ) {
    let result = await needle('get',`https://api.twitter.com/2/users/by/username/${username}`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        bot.say("#testing",`statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        return null;
    }
}

exports.findTwitterUsers = async function ( usernames ) {
    let result = await needle('get',`https://api.twitter.com/2/users/by?usernames=${usernames}`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        bot.say("#testing",`statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        return null;
    }
}

exports.getLastTweetFromUsername = async function ( username ) {
    let result = await needle('get',`https://api.twitter.com/2/tweets/search/recent?query=from:${username}&tweet.fields=public_metrics,author_id,context_annotations,source,referenced_tweets,created_at&expansions=referenced_tweets.id`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        if (result.statusCode != 400) {
            bot.say("#testing",`statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        }
        return null;
    }
}

exports.seartchTweets = async function ( query ) {
    let result = await needle('get',`https://api.twitter.com/2/tweets/search/recent?query=${query}&tweet.fields=public_metrics,author_id,context_annotations,source,referenced_tweets,created_at&expansions=referenced_tweets.id`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        if (result.statusCode != 400) {
            bot.say("#testing",`statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        }
        return null;
    }
}

exports.getSpaceById = async function (id) {
    console.log("id: "+id);
    let result = await needle('get',`https://api.twitter.com/2/spaces/${id}?space.fields=participant_count,started_at,state,title,host_ids`, { headers: { "Accept": "application/json", "authorization": `Bearer ${token}`}});
    if (result.statusCode == 200 && result.body.data) {
        return result.body.data;
    } else {
        if (result.statusCode != 400) {
            bot.say("#testing",`statusCode: ${result.statusCode} statusMessage: ${result.statusMessage}`);
        }
        return null;
    }
}
