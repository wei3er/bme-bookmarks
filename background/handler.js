var extensionState = {
    defaultReloadRate: 30,

    error: false,
    message: null,
    
    local: {
        ts: null,
        md5: null,
    },

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

function reloadBookmarks() {
    return getStorage().get()
        .then(storageData => {
            return httpRequest({ method: "GET", url: storageData.bookmarksUri })
                .then(loadedData => {
                    return {md5: md5(loadedData), parsed: JSON.parse(loadedData) };
                })
                .then(obj => {
                    extensionState.remote.md5 = obj.md5;
                    extensionState.remote.ts = new Date();
                    if(extensionState.local.md5 != extensionState.remote.md5) {
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
                    extensionState.local.ts = now;
                    return getStorage().set({ update: now, md5: obj.md5 });
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
            break;
        case Events.STATE:
            sendResponse(newEvent(Events.STATE, extensionState));
            break;
        default:
            handleError(`unsupported message type ${req.type} received!`);
    }
});

// refresh bookmark source periodically
const syncAlarm = "sync-alarm"
browser.alarms.onAlarm.addListener(alarmInfo => {
    if(syncAlarm == alarmInfo.name) {
        reloadBookmarks().catch(handleError);
    }
});
getStorage().get().then(storageData => {
    extensionState.local.md5 = storageData.md5;
    extensionState.local.ts = storageData.update;
    var reloadRate = storageData.reloadRate || extensionState.defaultReloadRate;
    browser.alarms.create(syncAlarm, { periodInMinutes: reloadRate });
}).catch(handleError);

reloadBookmarks().catch(handleError);

