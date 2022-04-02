function handleError(error) {
    console.error(error)
}

function formatDate(d) {
    if(d) {
        return d.toLocaleString();
    }
    return "never";
}

function updateUI(extensionState) {
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
        if(bookmark.state) {
            if(lastMerge == null || lastMerge < bookmark.state.ts) {
                lastMerge = bookmark.state.ts;
            }
        }
        
        child.innerHTML = `${stateLogo} ${bookmark.title}: <span title="${stateDetail}" class="${cls}">${stateDate}</span>`;
        element.appendChild(child);
    }
    document.querySelector("#mod").innerHTML = formatDate(extensionState.storage.modified);
    document.querySelector("#merge").innerHTML = formatDate(lastMerge);


    var msgElement = document.querySelector("#msg");
    if(extensionState.error || (extensionState.message != null && extensionState.message != "")) {
        msgElement.className = "state error";
        msgElement.innerHTML = (!extensionState.error ? "" : "error: ") + extensionState.message;
    } else {
        msgElement.className = "state";
        msgElement.innerHTML = "";
    }

    return httpRequest({ method: "GET", url: getBrowser().runtime.getURL("manifest.json") })
        .then(loadedData => {
            var manifest = JSON.parse(loadedData);
            document.querySelector("#release").innerHTML = manifest.version_name;
            document.querySelector("#name").innerHTML = manifest.name;
        });
}

document.addEventListener("DOMContentLoaded", function() {
        getBrowser().runtime.sendMessage(newEvent(Events.STATE))
            .then(extensionState => updateUI(extensionState.value))
            .catch(handleError);
    }
);

document.addEventListener('click', (event)=> { 
    if(event.target.id == "merge") {
        getBrowser().runtime.sendMessage(newEvent(Events.MERGE))
            .then(extensionState => updateUI(extensionState.value))
            .catch(handleError);
    }
    if(event.target.id == "fetch") {
        getBrowser().runtime.sendMessage(newEvent(Events.FETCH))
            .then(extensionState => updateUI(extensionState.value))
            .catch(handleError);
    }
});



