function handleError(error) {
    console.error(error)
}

function formatDate(obj) {
    if(!obj) {
        return "never";
    }
    return new Date(obj).toLocaleString();
}

function updateUI(extensionState) {
    document.getElementById("merge").disabled = false;
    document.getElementById("fetch").disabled = false;
    var element = document.querySelector("#feeds");
    while (element.lastChild) {
        element.removeChild(element.lastChild);
    }
    
    var lastMerge = null;
    for(const bookmark of extensionState.storage.bookmarks) {
        var snapshot = extensionState.snapshots[bookmark.title];

        var child = document.createElement("div");
        child.className = "res";

        var cls = "detail error";
        var stateLogo = `<img class="state-icon" src="/icons/error-solid.svg">`;
        var stateDate =  "never";
        var stateDetail =  "";
        if(snapshot && snapshot.state) {
            if(snapshot.state.error) {
                cls += "detail error";
                stateLogo = `<img class="state-icon" src="/icons/cross-solid.svg">`;
                stateDate = `${formatDate(snapshot.state.ts)} (${JSON.stringify(snapshot.state.message)})`;
            } else {
                stateDetail = `md5: ${snapshot.state.md5}`;
                stateDate = formatDate(snapshot.state.ts);
                if(!bookmark.state || snapshot.state.md5 != bookmark.state.md5) {
                    cls = "detail dirty";
                    stateLogo = `<img class="state-icon" src="/icons/refresh-double-rounded-solid.svg">`;
                } else {
                    cls = "detail";
                    stateLogo = `<img class="state-icon" src="/icons/checkmark-solid.svg">`;
                }
            }
        }
        if(bookmark.state && bookmark.state.ts) {
            if(lastMerge) {
                if(lastMerge < bookmark.state.ts) {
                    lastMerge = bookmark.state.ts;
                }
            } else {
                lastMerge = bookmark.state.ts;
            }
        }
        
        child.innerHTML = `${stateLogo} ${bookmark.title}: <span title="${stateDetail}" class="${cls}">${stateDate}</span>`;
        element.appendChild(child);
    }
    document.getElementById("modDate").innerHTML = formatDate(extensionState.storage.modified);
    document.getElementById("mergeDate").innerHTML = formatDate(lastMerge);
    document.getElementById("nextDate").innerHTML = formatDate(extensionState.nextFetch);
    
    var msgElement = document.querySelector("#msg");
    if(extensionState.error || (extensionState.message != null && extensionState.message != "")) {
        msgElement.className = "state error";
        msgElement.innerHTML = (!extensionState.error ? "" : "error: ") + extensionState.message;
    } else {
        msgElement.className = "state";
        msgElement.innerHTML = "";
    }

    return httpRequest({ method: "GET", url: browser.runtime.getURL("manifest.json") })
        .then(loadedData => {
            var manifest = JSON.parse(loadedData);
            document.getElementById("release").innerHTML = manifest.version_name;
            document.getElementById("name").innerHTML = manifest.name;
        });
}

document.addEventListener("DOMContentLoaded", function() {
        browser.runtime.sendMessage(newEvent(Events.STATE))
            .then(extensionState => updateUI(extensionState.value))
            .catch(handleError);
    }
);

document.addEventListener('click', (event)=> { 
    if(event.target.id == "merge") {
        document.getElementById("merge").disabled = true;
        document.getElementById("fetch").disabled = true;
        browser.runtime.sendMessage(newEvent(Events.MERGE))
            .then(extensionState => updateUI(extensionState.value))
            .catch(handleError);
    }
    if(event.target.id == "fetch") {
        document.getElementById("merge").disabled = true;
        document.getElementById("fetch").disabled = true;
        browser.runtime.sendMessage(newEvent(Events.FETCH))
            .then(extensionState => updateUI(extensionState.value))
            .catch(handleError);
    }
});



