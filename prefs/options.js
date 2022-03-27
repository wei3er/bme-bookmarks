function handleError(error) {
    console.log(error);
    browser.runtime.sendMessage({ type: "error", ts: new Date(), value: error }).catch(e => console.log(e));
}

function saveOptions(e) {
    e.preventDefault();
    getStorage().set({
        bookmarksUri: document.querySelector("#uri").value,
        reloadRate: document.querySelector("#reload").value,
        bookmarksFormat: document.querySelector('input[name="format"]:checked').value
    }).catch(handleError);
}

function getOptional(obj, key, defaultValue) {
    if(!obj || !(key in obj)) {
        return defaultValue;
    }
    return obj[key];
}

function restoreOptions() {
    getStorage().get().then(storageData => {
            document.querySelector("#reload").value = getOptional(storageData, "reloadRate", 15);
            document.querySelector("#uri").value = getOptional(storageData, "bookmarksUri", "https://exmaple.com/bookmarks.json");
        
            var format = getOptional(storageData, "format", "Firefox");
            document.querySelector("#chrome").checked = format == "Chrome";
            document.querySelector("#firefox").checked = format != "Chrome";

        })
        .catch(handleError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch(msg.type) {
        case "merge":
            getStorage().set({
                updated: msg.value
            }).catch(handleError);
            break;
        default:
            // nothing to do
    }
    sendResponse({ ack: true, comp: "options" });
})