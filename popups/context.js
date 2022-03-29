function handleError(error) {
    console.error(error)
}

function formatDate(d) {
    if(d) {
        return d.toLocaleString();
    }
    return "never";
}

function updateUI(resp) {
    document.querySelector("#localDate").innerHTML = formatDate(resp.value.storage.ts);
    document.querySelector("#remoteDate").innerHTML = formatDate(resp.value.remote.ts);
    document.querySelector("#localMd5").innerHTML = formatDate(resp.value.storage.md5);

    var dirty = resp.value.remote.md5 != resp.value.storage.md5
    document.querySelector("#remote").style.visibility = "hidden";
    if(dirty) {
        document.querySelector("#remote").style.visibility = "visible";
        document.querySelector("#remoteMd5").innerHTML = formatDate(resp.value.remote.md5);
    }

    if(resp.value.error || (resp.value.message != null && resp.value.message != "")) {
        document.querySelector("#msg").innerHTML = (!resp.value.error ? "" : "error: ") + resp.value.message;
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
            .then(resp => updateUI(resp))
            .catch(handleError);
    }
);

document.addEventListener('click', (event)=> { 
    if(event.target.id == "merge") {
        getBrowser().runtime.sendMessage(newEvent(Events.MERGE))
            .then(resp => updateUI(resp))
            .catch(handleError);
    }
    if(event.target.id == "fetch") {
        getBrowser().runtime.sendMessage(newEvent(Events.FETCH))
            .then(resp => updateUI(resp))
            .catch(handleError);
    }
});
