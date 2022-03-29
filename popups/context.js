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
    document.querySelector("#localMd5").innerHTML = formatDate(resp.value.storage.md5);

    var dirty = resp.value.remote.md5 != resp.value.storage.md5
    document.querySelector("#remote").style.visibility = "hidden";
    if(dirty) {
        document.querySelector("#remote").style.visibility = "visible";
        document.querySelector("#remoteDate").innerHTML = formatDate(resp.value.remote.ts);
        document.querySelector("#remoteMd5").innerHTML = formatDate(resp.value.remote.md5);
    }

    if(resp.value.error || (resp.value.message != null && resp.value.message != "")) {
        document.querySelector("#msg").innerHTML = (!resp.value.error ? "" : "error: ") + resp.value.message;
    }

    browser.management.getSelf().then(info => {
        document.querySelector("#release").innerHTML = `Release: ${info.version}`;
        document.querySelector("#name").innerHTML = info.name;
    });
}

document.addEventListener("DOMContentLoaded", function() {
        browser.runtime.sendMessage(newEvent(Events.STATE))
            .then(resp => updateUI(resp))
            .catch(handleError);
    }
);

document.addEventListener('click', (event)=> { 
    if(event.target.id == "merge") {
        browser.runtime.sendMessage(newEvent(Events.MERGE))
            .then(resp => updateUI(resp))
            .catch(handleError);
    }
    if(event.target.id == "fetch") {
        browser.runtime.sendMessage(newEvent(Events.FETCH))
            .then(resp => updateUI(resp))
            .catch(handleError);
    }
});
