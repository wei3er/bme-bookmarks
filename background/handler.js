var extensionState = {
    storage: {},
    error: false,
    message: null,
    remote: {
        ts: null,
        md5: null
    }
}

function reset() {
    extensionState.error = false;
    extensionState.message = null;
}

function handleError(error) {
    extensionState.error = true;
    extensionState.message = error == "" ? "unspecified error" : error;
    console.error(extensionState.message)
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
            index: item.index
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
    getBrowser().browserAction.setIcon({ path: "/icons/logo-96.png" });
    if(extensionState.error) {
        getBrowser().browserAction.setBadgeText({ text: "E" });

    } else if(extensionState.storage.md5 != extensionState.remote.md5) {
        getBrowser().browserAction.setBadgeText({ text: "U" });

    } else {
        getBrowser().browserAction.setBadgeText({ text: "" });
    }
}

// handle messages from other components
getBrowser().runtime.onMessage.addListener((req, sender, sendResponse) => {
    switch(req.type) {
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
            if(syncAlarm == alarmInfo.name) {
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
                if(item = "reloadRate") {
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
  

