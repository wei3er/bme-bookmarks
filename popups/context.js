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
    document.querySelector("#updated").innerHTML = `last update: ${formatDate(resp.value.local.ts)}`;
    if(resp.value.error) {
        document.querySelector("#msg").innerHTML = `[${formatDate(resp.ts)}] error: ${JSON.stringify(resp.value.message)}`;
    } else if(resp.value.remote.md5 != resp.value.local.md5) {
        document.querySelector("#msg").innerHTML = `new version available: ${resp.value.remote.md5}`;
    } else {
        document.querySelector("#msg").innerHTML = resp.value.message;
    }
}

document.addEventListener("DOMContentLoaded", function() {
    browser.runtime.sendMessage(newEvent(Events.STATE))
        .then(resp => updateUI(resp))
        .catch(handleError);
});
document.querySelector("form").addEventListener("submit", function(e){
        e.preventDefault();
        browser.runtime.sendMessage(newEvent(Events.MERGE))
            .then(resp => updateUI(resp))
            .catch(handleError);
    }
);
