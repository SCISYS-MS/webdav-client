"use strict";

var path = require("path");

var joinURL = require("url-join");
var deepmerge = require("deepmerge");

var fetch = require("../request.js").fetch;
var responseHandlers = require("../response.js");
var urlTools = require("../url.js");
var davTools = require("./dav.js");

var getValueForKey = davTools.getValueForKey;
var getSingleValue = davTools.getSingleValue;

/* BY ANNOVA */
function getSearchDirectoryContents(remotePath, options) {
    var fetchURL = joinURL(options.remoteURL, remotePath);
    var fetchOptions = {
        method: "PROPFIND",
        headers: deepmerge({
            Depth: "infinity"
        }, options.headers)
    };
    return fetch(fetchURL, fetchOptions).then(responseHandlers.handleResponseCode).then(function __handleResponseFormat(res) {
        // Convert response to text
        return res.text();
    }).then(davTools.parseXML).then(function __handleResult(result) {
        return getDirectoryFiles(result, options.remotePath, remotePath);
    });
}
/* BY ANNOVA */

function getDirectoryContents(remotePath, options) {
    var fetchURL = joinURL(options.remoteURL, remotePath);
    var fetchOptions = {
        method: "PROPFIND",
        headers: deepmerge({
            Depth: 1
        }, options.headers)
    };
    return fetch(fetchURL, fetchOptions).then(responseHandlers.handleResponseCode).then(function __handleResponseFormat(res) {
        // Convert response to text
        return res.text();
    }).then(davTools.parseXML).then(function __handleResult(result) {
        return getDirectoryFiles(result, options.remotePath, remotePath);
    });
}

function getDirectoryFiles(result, serverBasePath, requestPath) {
    var remoteTargetPath = path.join(serverBasePath, requestPath);
    // Extract the response items (directory contents)
    var multiStatus = getValueForKey("multistatus", result);
    var responseItems = getValueForKey("response", multiStatus);
    return responseItems
    // Filter out the item pointing to the current directory (not needed)
    .filter(function __filterResponseItem(item) {
        var href = getSingleValue(getValueForKey("href", item));
        href = urlTools.normaliseHREF(href);
        href = urlTools.normalisePath(href);
        return href !== serverBasePath && href !== remoteTargetPath;
    })
    // Map all items to a consistent output structure (results)
    .map(function __mapResponseItem(item) {
        // HREF is the file path (in full)
        var href = getSingleValue(getValueForKey("href", item));
        href = urlTools.normaliseHREF(href);
        href = decodeURI(href);
        href = urlTools.normalisePath(href);
        // Each item should contain a stat object
        var propStat = getSingleValue(getValueForKey("propstat", item));
        var props = getSingleValue(getValueForKey("prop", propStat));
        // Process the true full filename (minus the base server path)
        var filename = serverBasePath === "/" ? href : urlTools.normalisePath(path.relative(serverBasePath, href));
        return davTools.propsToStat(props, filename);
    });
}

module.exports = {
    getSearchDirectoryContents : getSearchDirectoryContents, 
    getDirectoryContents: getDirectoryContents
};
