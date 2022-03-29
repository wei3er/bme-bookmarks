var extensionState = {
    storage: {},
    error: false,
    message: null,
    remote: {
        ts: null,
        md5: null
    }
}

function handleError(error) {
    extensionState.error = true;
    extensionState.message = error;
    console.error(error == "" ? "unspecified error": error)
    updateIcon();
}

function parseBookmarks(raw) {
    switch(extensionState.storage.bookmarksFormat) {
        case "Firefox":
            return parseFirefox(raw);
        case "Chrome":
            //TODO
            return parseChrome(raw);
        default:
            throw `unsupported format type: ${extensionState.storage.bookmarksFormat}!`;
    }
}

function reloadBookmarks() {
    return getStorage().get()
        .then(storageData => {
            return httpRequest({ method: "GET", url: storageData.bookmarksUri })
                .then(loadedData => {
                    return {md5: md5(loadedData), parsed: parseBookmarks(loadedData), raw: loadedData };
                })
                .then(obj => {
                    extensionState.remote.md5 = obj.md5;
                    extensionState.remote.ts = new Date();
                    return obj;
                });
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
    for (const item of items) {
        var parent = null;

        var thisKey = "";
        for (comp of item.path) {
            thisKey += "###" + comp;
            thisNode = parentIds[thisKey]
            if (!thisNode) {
            await browser.bookmarks.create({
                parentId: parent == null ? null : parent.id,
                title: comp,
                type: "folder"
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
            index: item.index,
            type: "bookmark"
        });
    }
}


function mergeBookmarks() {
    extensionState.error = false;
    extensionState.message = null
    return reloadBookmarks()
        .then(obj => {
            return clearBookmarks()
                .then(() => {
                    return createBookmarks(obj.parsed);
                })
                .then(() => {
                    var now = new Date();
                    extensionState.storage.md5 = obj.md5;
                    extensionState.storage.ts = now;
                    return getStorage().set({ ts: now, md5: obj.md5, raw: obj.raw });
                });
        });
}

function updateIcon() {
    browser.browserAction.setIcon({ path: "/icons/logo-96.png" });
    if(extensionState.error) {
        browser.browserAction.setBadgeText({ text: "E" });

    } else if(extensionState.storage.md5 != extensionState.remote.md5) {
        browser.browserAction.setBadgeText({ text: "U" });

    } else {
        browser.browserAction.setBadgeText({ text: "" });
    }
}

// handle messages from other components
browser.runtime.onMessage.addListener((req, sender, sendResponse) => {
    switch(req.type) {
        case Events.MERGE:
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
        browser.alarms.onAlarm.addListener(alarmInfo => {
            if(syncAlarm == alarmInfo.name) {
                reloadBookmarks().catch(handleError);
            }
        })
        return browser.alarms.create(syncAlarm, { periodInMinutes: extensionState.storage.reloadRate || 30 });
    })
    .then(() => {
        // keep track of storage changes
        return browser.storage.onChanged.addListener((changes, area) => {
            for (let item of Object.keys(changes)) {
                extensionState.storage[item] = changes[item].newValue;
                if(item = "reloadRate") {
                    browser.alarms.clear(syncAlarm);
                    browser.alarms.create(syncAlarm, { periodInMinutes: extensionState.storage.reloadRate });
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
  

