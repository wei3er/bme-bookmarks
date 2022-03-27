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
    console.error(error)
    browser.browserAction.setIcon({ path: "/icons/logo-error.png" });
}

function parseBookmarks(raw) {
    switch(extensionState.storage.format) {
        case "Firefox":
            //TODO
            return JSON.parse(raw);
        case "Chrome":
            //TODO
            return JSON.parse(raw);
        default:
            throw `unsupported format type: ${extensionState.storage.format}!`;
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
                    if(extensionState.storage.md5 != extensionState.remote.md5) {
                        browser.browserAction.setIcon({ path: "/icons/logo-dirty.png" });
                    }
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
    browser.browserAction.setIcon({ path: "/icons/logo.png" });
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
                    return getStorage().set({ ts: now, md5: obj.md5, raw: obj.raw });
                })
        })
        .catch(handleError);
}

// handle messages from other components
browser.runtime.onMessage.addListener((req, sender, sendResponse) => {
    switch(req.type) {
        case Events.MERGE:
            mergeBookmarks()
                .finally(sendResponse(newEvent(Events.STATE, extensionState)));
            break;
        case Events.ERROR:
            handleError(extensionState.message);
            sendResponse(newEvent(Events.ACK));
            break;
        case Events.STATE:
            sendResponse(newEvent(Events.STATE, extensionState));
            break;
        default:
            handleError(`unsupported message type ${req.type} received!`);
    }
});

getStorage().get().then(storageData => {
        // load snapshot of storage
        extensionState.storage = storageData;
    })
    .then(() => {
        // refresh bookmarks source periodically
        const syncAlarm = "sync-alarm";
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
            }
        });
    })
    .then(() => {
        // perform initial reload
        return reloadBookmarks();
    })
    .catch(handleError);
  

