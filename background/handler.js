var extensionState = {
    storage: {},
    snapshots: {},
    modified: null,
    error: false,
    message: null,
}

function reset() {
    extensionState.error = false;
    extensionState.message = null;
}

function handleError(error) {
    extensionState.error = true;
    extensionState.message = (error == null || error == "" ? "unspecified error" : error);
    console.error(extensionState.message);
    updateIcon();
}

function parseBookmarks(bookmark, raw) {
    switch (bookmark.format) {
        case Formats.FIREFOX:
            return parseFirefox(bookmark.folder, raw);
        case Formats.CHROME:
            return parseChrome(bookmark.folder, raw);
        case Formats.PORTABLE:
            return parsePortable(bookmark.folder, raw);
        default:
            throw `unsupported format type: ${bookmark.format}!`;
    }
}


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

function reloadBookmarks() {
    var newSnapshots = {};
    var allBookmarks = [];
    let promises = [];
    for (const bookmark of extensionState.storage.bookmarks) {
        promises.push(httpRequest({
            method: "GET",
            url: bookmark.uri,
            headers: translateAuthHeader(bookmark)
        })
            .then(payload => {
                return translateResponse(bookmark, payload);
            })
            .then(loadedData => {
                bookmarkSnapshot = extensionState.snapshots[bookmark.title];
                if (!bookmarkSnapshot) {
                    bookmarkSnapshot = {
                        state: {
                            md5: null,
                            ts: null,
                        },
                        bookmarks: null,
                    };
                }
                bookmarkSnapshot.state.ts = new Date();
                bookmarkSnapshot.state.md5 = md5(loadedData);
                bookmarkSnapshot.bookmarks = parseBookmarks(bookmark, loadedData);

                newSnapshots[bookmark.title] = bookmarkSnapshot;
                allBookmarks.push(...bookmarkSnapshot.bookmarks);
                return bookmarkSnapshot.bookmarks;
            }));
    }
    return Promise.all(promises)
        .then((result) => {
            extensionState.snapshots = newSnapshots;
            return allBookmarks;
        });
}

function clearBookmarks() {
    function rmItem(items) {
        var tmp = [];

        for (const item of items) {
            tmp.push(getBrowser().bookmarks.removeTree(item.id)
                .catch(function () {
                    if (item.children.length) {
                        tmp.push(rmItem(item.children))
                    }
                })
            );
        }
        return Promise.all(tmp)
    }
    return getBrowser().bookmarks.getTree()
        .then(roots => {
            return rmItem(roots)
        });
}

async function createBookmarks(items) {
    const parentIds = {};
    try {
        for (const item of items) {
            var parent = null;

            var thisKey = "";
            for (comp of item.path) {
                thisKey += "###" + comp;
                thisNode = parentIds[thisKey]
                if (!thisNode) {
                    await getBrowser().bookmarks.create({
                        parentId: parent == null ? null : parent.id,
                        title: comp
                    }).then(function (i) {
                        parentIds[thisKey] = i;
                    });
                    thisNode = parentIds[thisKey];
                }
                parent = thisNode;
            }
            await getBrowser().bookmarks.create({
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


function mergeBookmarks() {
    extensionState.error = false;
    extensionState.message = null
    return reloadBookmarks()
        .then(items => {
            return clearBookmarks()
                .then(() => {
                    return createBookmarks(items);
                })
                .then(() => {
                    var now = new Date();
                    for (var bookmark of extensionState.storage.bookmarks) {
                        var update = extensionState.snapshots[bookmark.title];
                        bookmark.state = update.state;
                    }
                    return getStorage().set({ bookmarks: extensionState.storage.bookmarks });
                });
        });
}

function updateIcon() {
    getBrowser().browserAction.setIcon({ path: "/icons/logo-96.png" });
    if (extensionState.error) {
        getBrowser().browserAction.setBadgeText({ text: "E" });
        return;
    }
    for (const bookmark of extensionState.storage.bookmarks) {
        var update = extensionState.snapshots[bookmark.title];
        if (update.state != null && (bookmark.state == null || bookmark.state.md5 != update.state.md5)) {
            getBrowser().browserAction.setBadgeText({ text: "U" });
            return;
        }
    }
    getBrowser().browserAction.setBadgeText({ text: "" });
}

// handle messages from other components
getBrowser().runtime.onMessage.addListener((req, sender, sendResponse) => {
    switch (req.type) {
        case Events.MERGE:
            reset();
            mergeBookmarks()
                .then(() => {
                    updateIcon();
                })
                .finally(() => {
                    sendResponse(newEvent(Events.STATE, extensionState))
                })
                .catch(handleError);
            return true;
        case Events.FETCH:
            reloadBookmarks()
                .then(() => {
                    updateIcon();
                })
                .finally(() => {
                    sendResponse(newEvent(Events.STATE, extensionState))
                })
                .catch(handleError);
            return true;
        case Events.ERROR:
            handleError(extensionState.message);
            sendResponse(newEvent(Events.ACK));
            return false;
        case Events.STATE:
            sendResponse(newEvent(Events.STATE, extensionState));
            return false;
        default:
            handleError(`unsupported message type ${req.type} received!`);
    }
});

const syncAlarm = "sync-alarm";
getStorage().get().then(storageData => {
    // load snapshot of storage
    extensionState.storage = storageData;
})
    .then(() => {
        // refresh bookmarks source periodically
        getBrowser().alarms.onAlarm.addListener(alarmInfo => {
            if (syncAlarm == alarmInfo.name) {
                reloadBookmarks().catch(handleError);
            }
        })
        return getBrowser().alarms.create(syncAlarm, { periodInMinutes: extensionState.storage.reloadRate || 30 });
    })
    .then(() => {
        // keep track of storage changes
        return getBrowser().storage.onChanged.addListener((changes, area) => {
            for (let item of Object.keys(changes)) {
                extensionState.storage[item] = changes[item].newValue;
                if (item = "reloadRate") {
                    getBrowser().alarms.clear(syncAlarm);
                    getBrowser().alarms.create(syncAlarm, { periodInMinutes: extensionState.storage.reloadRate });
                }
            }
        });
    })
    .then(() => {
        // perform initial reload
        return reloadBookmarks()
            .then(() => {
                updateIcon();
            });
    })
    .catch(handleError);

// listen for bookmark changes
browser.bookmarks.onChanged.addListener(function (id, changeInfo) {
    getStorage().set({ modified: new Date() }).catch(handleError);
});

