var extensionState = {
    storage: {},
    snapshots: {},
    error: false,
    message: null,
    locked: false,
    nextFetch: null,
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
    const newSnapshots = {};
    const allBookmarks = [];
    let promises = [];
    for (const bookmark of extensionState.storage.bookmarks) {
        var tmp = extensionState.snapshots[bookmark.title];
        if (!tmp) {
            tmp = {
                state: {},
                bookmarks: {},
            };
        }
        const bookmarkSnapshot = tmp;
        newSnapshots[bookmark.title] = bookmarkSnapshot;

        promises.push(httpRequest({
                method: "GET",
                url: bookmark.uri,
                headers: translateAuthHeader(bookmark)
            })
            .then(payload => {
                return translateResponse(bookmark, payload);
            })
            .then(loadedData => {
                bookmarkSnapshot.state.ts = new Date().getTime();
                bookmarkSnapshot.state.md5 = md5(loadedData);
                bookmarkSnapshot.state.error = false;
                bookmarkSnapshot.state.message = null;
                try {
                    bookmarkSnapshot.bookmarks = parseBookmarks(bookmark, loadedData);
                } catch(e) {
                    bookmarkSnapshot.state.error = true;
                    bookmarkSnapshot.state.message = error;
                }
                allBookmarks.push(...bookmarkSnapshot.bookmarks);
                return bookmarkSnapshot.bookmarks;
            })
            .catch(error => {
                bookmarkSnapshot.state.ts = new Date().getTime();
                bookmarkSnapshot.state.error = true;
                bookmarkSnapshot.state.message = error;
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
            tmp.push(browser.bookmarks.removeTree(item.id)
                .catch(function () {
                    if (item.children.length) {
                        tmp.push(rmItem(item.children))
                    }
                })
            );
        }
        return Promise.all(tmp)
    }
    return browser.bookmarks.getTree()
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
                    await browser.bookmarks.create({
                        parentId: parent == null ? null : parent.id,
                        title: comp
                    }).then(function (i) {
                        parentIds[thisKey] = i;
                    });
                    thisNode = parentIds[thisKey];
                }
                parent = thisNode;
            }
            await browser.bookmarks.create({
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
                    for (var bookmark of extensionState.storage.bookmarks) {
                        var update = extensionState.snapshots[bookmark.title];
                        bookmark.state = update.state;
                    }
                    return getStorage().set({ bookmarks: extensionState.storage.bookmarks });
                });
            });
}

function updateIcon() {
    browser.browserAction.setIcon({ path: "/icons/logo-96.png" });
    if (extensionState.error) {
        browser.browserAction.setBadgeText({ text: "E" });
        return;
    }
    for (const bookmark of extensionState.storage.bookmarks) {
        var update = extensionState.snapshots[bookmark.title];
        if (update.state != null && (bookmark.state == null || bookmark.state.md5 != update.state.md5)) {
            browser.browserAction.setBadgeText({ text: "U" });
            return;
        }
    }
    browser.browserAction.setBadgeText({ text: "" });
}

// handle messages from other components
browser.runtime.onMessage.addListener((req, sender, sendResponse) => {
    switch (req.type) {
        case Events.MERGE:
            reset();
            if(!extensionState.locked) {
                extensionState.locked = true;
                mergeBookmarks()
                    .then(() => {
                        extensionState.locked = false;
                        updateIcon();
                    })
                    .finally(() => {
                        sendResponse(newEvent(Events.STATE, extensionState))
                    })
                    .catch(handleError);
            }
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
            return true;
        case Events.STATE:
            sendResponse(newEvent(Events.STATE, extensionState));
            return true;
        default:
            handleError(`unsupported message type ${req.type} received!`);
            return false;
    }
});

function updateNextFetch(alarmName) {
    extensionState.nextFetch = new Date().getTime() + (extensionState.storage.reloadRate || 30)*60000;;
    return browser.alarms.get(alarmName)
        .then((alarmInfo) => {
            return browser.alarms.clear(alarmName);
        })
        .finally(() => {
            return browser.alarms.create(alarmName, { when: extensionState.nextFetch });
        });
}
const syncAlarm = "sync-alarm";
getStorage().get().then(storageData => {
        // load snapshot of storage
        extensionState.storage = storageData;
    })
    .then(() => {
        // refresh bookmarks source periodically
        browser.alarms.onAlarm.addListener(alarmInfo => {
            if (syncAlarm == alarmInfo.name) {
                reloadBookmarks().catch(handleError);
                updateNextFetch(syncAlarm);
            }
        })
        return updateNextFetch(syncAlarm);
    })
    .then(() => {
        // keep track of storage changes
        return browser.storage.onChanged.addListener((changes, area) => {
            for (let item of Object.keys(changes)) {
                extensionState.storage[item] = changes[item].newValue;
                if (item = "reloadRate") {
                    updateNextFetch(syncAlarm);
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
function setModified(id, changeInfo) {
    if(!extensionState.locked) {
        getStorage().set({ modified: new Date().getTime() }).catch(handleError);
    }
}
browser.bookmarks.onCreated.addListener(setModified);
browser.bookmarks.onRemoved.addListener(setModified);
browser.bookmarks.onChanged.addListener(setModified);
browser.bookmarks.onMoved.addListener(setModified);
