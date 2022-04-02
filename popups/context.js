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
    console.log(JSON.stringify(extensionState));
    for(const bookmark of extensionState.storage.bookmarks) {
        var snapshot = extensionState.snapshots[bookmark.title];

        var child = document.createElement("div");
        child.className = "res";

        var cls = "state error";
        var state = "undefinded state";
        var detail =  "";
        if(snapshot && snapshot.state) {
            if(snapshot.state.error) {
                cls += "state error";
                state = `error (${JSON.stringify(snapshot.state.message)})`;
            } else {
                detail = `md5: ${snapshot.state.md5}`;
                if(snapshot.state.md5 != bookmark.state.md5) {
                    cls = "state dirty";
                    state = `out of sync (${formatDate(snapshot.state.ts)})`;
                } else {
                    cls = "state";
                    state = `synced (${formatDate(snapshot.state.ts)})`;
                }
            }
        }
        lastMerge = bookmark.state.ts;
        
        child.innerHTML = `<b>${bookmark.title}:</b> <span title="${detail}" class="${cls}">${state}</span>`;
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



