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
    
    var dirty = false;
    var lastFetch = null;
    var lastMerge = null;
    for(const bookmark of extensionState.storage.bookmarks) {
        var child = document.createElement("div");
        child.className = "res";

        var cls = "md5";
        var snapshot = extensionState.snapshots[bookmark.title];
        if(snapshot) {
            lastFetch = snapshot.ts;
            dirty = dirty || snapshot.md5 != bookmark.md5;
            cls = cls + (snapshot.md5 != bookmark.md5 ? " dirty" : "");
        }
        lastMerge = bookmark.ts;
        
        child.innerHTML = `<b>${bookmark.title}:</b> <span class="${cls}">${bookmark.md5}</span>`;
        element.appendChild(child);
    }
    document.querySelector("#mod").innerHTML = formatDate(extensionState.storage.modified);
    document.querySelector("#fetch").innerHTML = formatDate(lastFetch);
    document.querySelector("#merge").innerHTML = formatDate(lastMerge);


    var msgElement = document.querySelector("#msg");
    if(extensionState.error || (extensionState.message != null && extensionState.message != "")) {
        msgElement.classList.add("dirty");
        msgElement.innerHTML = (!extensionState.error ? "" : "error: ") + extensionState.message;
    } else if(dirty) {
        msgElement.classList.add("dirty");
        msgElement.innerHTML = "out of sync";
    } else {
        msgElement.className = "";
        msgElement.innerHTML = "synced";
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



