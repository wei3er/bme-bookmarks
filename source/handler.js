import _browser from 'webextension-polyfill';
import md5 from 'md5';
const _parser = require('./parser.js');

//###########

function translateResponse(bookmark, payload) {
    if (bookmark.content) {
        switch (bookmark.content) {
            case ContentTypes.PLAIN:
                return payload;
            case ContentTypes.GITHUB:
                return atob(JSON.parse(payload).content);
            default:
                throw `unsupported content type: ${bookmark.content}`;
        }
    }
    return payload;
}

function translateAuthHeader(bookmark) {
    if (bookmark.auth && bookmark.auth.type) {
        switch (bookmark.auth.type) {
            case AuthTypes.NONE:
                return null;
            case AuthTypes.BASIC:
                return { Authorization: `Basic ${btoa(bookmark.auth.value)}` };
            case AuthTypes.BEARER:
                return { Authorization: `Bearer ${bookmark.auth.value}` };
            case AuthTypes.GITHUB:
                return { Authorization: `token ${bookmark.auth.value}` };
            default:
                throw `unsupported auth type: ${bookmark.auth.type}`;
        }
    }
    return null;
}

function mergeBookmarks(_state) {
    return reloadBookmarks(_state)
        .then(items => {
            return clearBookmarks()
                .then(() => {
                    return createBookmarks(items);
                })
                .then(() => {
                    for (var bookmark of _state.bookmarks) {
                        if(bookmark.error == null) {
                            bookmark.state = bookmark.target;
                        }
                    }
                    _state.merged = new Date().getTime();
                    return storage().set({ bookmarks: _state.bookmarks, merged: _state.merged });
                });
        }).then(() => {
            return _state;
        });
}

function reloadBookmarks(_state) {
    let promises = [];
    for (const bookmark of _state.bookmarks) {
        if(!bookmark.target) {
            bookmark.target = {};
        }
        promises.push(httpRequest({
                method: "GET",
                url: bookmark.uri,
                headers: translateAuthHeader(bookmark)
            })
            .then(payload => {
                return translateResponse(bookmark, payload);
            })
            .then(loadedData => {
                bookmark.target.ts = new Date().getTime();
                bookmark.target.md5 = md5(loadedData);
                bookmark.error = null;
                try {
                    return _parser.parseBookmarks(bookmark, loadedData);
                } catch(e) {
                    bookmark.error = convertMessage(e);
                }
                return [];
            })
            .catch(e => {
                bookmark.target.ts = new Date().getTime();
                bookmark.error = convertMessage(e);
            }));
    }
    return Promise.all(promises)
        .then(result => {
            storage().set({ bookmarks: _state.bookmarks })
                .then(result => {
                    updateIcon(_state);

                })
            return result;
        })
        .then(result => {
            var bookmarks = [];
            for(var items of result) {
                if(items != null) {
                    bookmarks.push(...items);
                }
            }
            return bookmarks;
        }); 
}

function clearBookmarks() {
    function rmItem(items) {
        var tmp = [];

        for (const item of items) {
            tmp.push(bookmarks().removeTree(item.id)
                .catch(function () {
                    if (item.children.length) {
                        tmp.push(rmItem(item.children))
                    }
                })
            );
        }
        return Promise.all(tmp)
    }
    return bookmarks().getTree()
        .then(roots => {
            return rmItem(roots)
        });
}

async function createBookmarks(items) {
    const parentIds = {};
    try {
        for (var item of items) {
            var parent = null;

            var thisKey = "";
            for (var comp of item.path) {
                thisKey += "###" + comp;
                var thisNode = parentIds[thisKey]
                if (!thisNode) {
                    await bookmarks().create({
                        parentId: parent == null ? null : parent.id,
                        title: comp
                    }).then(function (i) {
                        parentIds[thisKey] = i;
                    });
                    thisNode = parentIds[thisKey];
                }
                parent = thisNode;
            }
            await bookmarks().create({
                parentId: parent == null ? null : parent.id,
                title: item.title,
                url: item.url,
            });
        }
    } catch(e) {
        handleError(e);
        throw e;
    }
}

//###########

function updateIcon(_state) {
    action().setIcon({ path: "/icons/logo-96.png" });
    for (const bookmark of _state.bookmarks) {
        if (bookmark.error) {
            action().setBadgeText({ text: "E" });
            return;
        }
        if (bookmark.target != null && (bookmark.state == null || bookmark.state.md5 != bookmark.target.md5)) {
            action().setBadgeText({ text: "U" });
            return;
        }
    }
    action().setBadgeText({ text: "" });
}

function convertMessage(err) {
    if(err == null || err == "") {
        return "unspecified error";
    }
    if(typeof err === 'object' && 'message' in err) {
        return err.message;
    }
    return JSON.stringify(err);
}

function handleError(err) {
    action().setIcon({ path: "/icons/logo-96.png" });
    action().setBadgeText({ text: "E" });
    console.error(convertMessage(err));
}

//###########

function alarms() {
    return _browser.alarms;
}

function bookmarks() {
    return _browser.bookmarks;
}

function storage() {
    return _browser.storage.local;
}

function action() {
    return _browser.action || _browser.browserAction;
}

function manifest() {
    return httpRequest({ method: "GET", url: _browser.runtime.getURL("manifest.json") })
    .then(loadedData => {
        return JSON.parse(loadedData);
    });
}

//###########

function httpRequest(obj) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(obj.method || "GET", obj.url);
        if (obj.headers) {
            Object.keys(obj.headers).forEach(key => {
                xhr.setRequestHeader(key, obj.headers[key]);
            });
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject(xhr.statusText);
            }
        };
        xhr.onerror = () => reject(xhr.statusText);
        xhr.send(obj.body);
    });
}

//###########

const AuthTypes = {
    NONE: "none",
    BASIC: "basic",
    BEARER: "bearer",
    GITHUB: "github",
};
    
const ContentTypes = {
    PLAIN: "none",
    GITHUB: "github",
};

module.exports = {

    ContentTypes: ContentTypes,
    AuthTypes: AuthTypes,

    mergeBookmarks: function() {
        return storage().get().then(storageData => {
            return mergeBookmarks(storageData);
        });
    },
    reloadBookmarks: function() {
        return storage().get().then(storageData => {
            return reloadBookmarks(storageData)
                .then(() => {
                    return storageData;
                });
        });
    },

    httpRequest: httpRequest,
    handleError: handleError,

    bookmarks: bookmarks,
    storage: storage,
    alarms: alarms,
    manifest: manifest,
};
