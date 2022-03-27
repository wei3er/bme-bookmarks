function handleError(error) {
    console.log(error);
    sendMessage({ type: "error", ts: new Date(), value: error });
}

function reset() {
    sendMessage({ type: "reset", ts: new Date() });
}

function formatDate(d) {
    if(d) {
        return d.toLocaleString();
    }
    return "never";
}

function updateUI() {
    getStorage().get().then(storageData => {
        document.querySelector("#updated").innerHTML = `last update: ${formatDate(storageData.update)}`;
    })
    .catch(handleError);
}

function reloadBookmarks() {
    return getStorage().get()
        .then(storageData => {
            return httpRequest({ method: "GET", url: storageData.bookmarksUri })
                .then(loadedData => {
                    return {raw: loadedData, parsed: JSON.parse(loadedData) };
                })
                .then(obj => {
                    sendMessage({ type: "reload", ts: new Date() })
                    if(storageData.raw != obj.raw) {
                        getStorage().set({ raw: obj.raw })
                            .then(() => {
                                sendMessage({ type: "dirty", ts: new Date() });
                            })
                            .catch(handleError);
                    }
                    return obj.parsed;
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

function sendMessage(msg) {
    browser.runtime.sendMessage(handleMessage(msg)).catch(e => console.log(e));
}

function handleMessage(msg) {
    switch(msg.type) {
        case "merge":
            document.querySelector("#updated").innerHTML = `last update: ${formatDate(msg.ts)}`;
            break;
        case "perform-reload":
            reloadBookmarks().catch(handleError);
            break;
        case "reload":
            // nothing to do
            break;
        case "error":
            document.querySelector("#msg").innerHTML = `[${formatDate(msg.ts)}] error: ${JSON.stringify(msg.value)}`;
            browser.browserAction.setIcon({ path: "/icons/logo-error.png" });
            break;
        case "dirty":
            browser.browserAction.setIcon({ path: "/icons/logo-dirty.png" });
            document.querySelector("#msg").innerHTML = `[${formatDate(msg.ts)}] new version available`;
            break;
        case "reset":
            document.querySelector("#msg").innerHTML = "";
            browser.browserAction.setIcon({ path: "/icons/logo.png" });
            break;
        default:
            // nothing to do
    }
    return msg;
}



browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender, sendResponse) 
    sendResponse({ ack: true, comp: "context" });
});
document.addEventListener("DOMContentLoaded", updateUI);
document.querySelector("form").addEventListener("submit", function(e){
        e.preventDefault();
        reset();
        reloadBookmarks()
            .then(items => {
                return clearBookmarks()
                    .then(() => {
                        return createBookmarks(items);
                    });

            })
            .then(() => {
                var now = new Date();
                return getStorage().set({ update: now })
                    .then(() => {
                        sendMessage({ type: "merge", ts: now });
                    });
            })
            .catch(handleError);
    }
);
