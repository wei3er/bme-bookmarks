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
    document.querySelector("#local").innerHTML = `<b>local:</b> md5:${formatDate(resp.value.storage.md5)}<br/>(update: ${formatDate(resp.value.storage.ts)})`;
    if(resp.value.remote.md5 != resp.value.storage.md5) {
        document.querySelector("#remote").innerHTML = `<b>remote:</b> md5:${formatDate(resp.value.remote.md5)}<br/>(update: ${formatDate(resp.value.remote.ts)})`;
    }
    document.querySelector("#msg").innerHTML = !resp.value.error ? "" : `[${formatDate(resp.ts)}] error: ${JSON.stringify(resp.value.message)}`;
}

document.addEventListener("DOMContentLoaded", function() {
        browser.runtime.sendMessage(newEvent(Events.STATE))
            .then(resp => updateUI(resp))
            .catch(handleError);
    }
);
document.querySelector("form").addEventListener("submit", function(e){
        e.preventDefault();
        browser.runtime.sendMessage(newEvent(Events.MERGE))
            .then(resp => updateUI(resp))
            .catch(handleError);
    }
);
