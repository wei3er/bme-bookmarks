const _handler = require('../handler.js');

function formatDate(obj) {
    if(!obj) {
        return "never";
    }
    return new Date(obj).toLocaleString();
}

function updateUI(_state) {
    document.getElementById("merge").disabled = false;
    document.getElementById("fetch").disabled = false;
    var element = document.querySelector("#feeds");
    while (element.lastChild) {
        element.removeChild(element.lastChild);
    }
    
    if(_state.bookmarks.length == 0) {
        var child = document.createElement("div");
        child.className = "res";
        child.innerHTML = "no feeds defined yet!";
        element.appendChild(child);

    } else {
        for(const bookmark of _state.bookmarks) {
            var child = document.createElement("div");
            child.className = "res";
    
            var cls = "detail error";
            var stateLogo = `<img class="state-icon" src="/icons/error-solid.svg">`;
            var stateDate =  "never";
            var stateDetail =  "";
            if(bookmark.target) {
                if(bookmark.error != null) {
                    cls += "detail error";
                    stateLogo = `<img class="state-icon" src="/icons/cross-solid.svg">`;
                    stateDate = `${formatDate(bookmark.target.ts)} (${JSON.stringify(bookmark.error)})`;
                } else {
                    stateDetail = `md5: ${bookmark.target.md5}`;
                    stateDate = formatDate(bookmark.target.ts);
                    if(!bookmark.state || bookmark.target.md5 != bookmark.state.md5) {
                        cls = "detail dirty";
                        stateLogo = `<img class="state-icon" src="/icons/refresh-double-rounded-solid.svg">`;
                    } else {
                        cls = "detail";
                        stateLogo = `<img class="state-icon" src="/icons/checkmark-solid.svg">`;
                    }
                }
            }
            
            child.innerHTML = `${stateLogo} ${bookmark.title}: <span title="${stateDetail}" class="${cls}">${stateDate}</span>`;
            element.appendChild(child);
        }
    }
    document.getElementById("modDate").innerHTML = formatDate(_state.modified);
    document.getElementById("mergeDate").innerHTML = formatDate(_state.merged);
    document.getElementById("nextDate").innerHTML = formatDate(_state.nextFetch);
    
    var msgElement = document.querySelector("#msg");
    if(_state.error != null && _state.error != "") {
        msgElement.className = "state error";
        msgElement.innerHTML = `error: ${_state.error}`;
    } else {
        msgElement.className = "state";
        msgElement.innerHTML = "";
    }

    return _handler.manifest()
        .then(manifest => {
            document.getElementById("release").innerHTML = manifest.version_name;
            document.getElementById("name").innerHTML = manifest.name;
        });
}

document.addEventListener("DOMContentLoaded", function() {
        _handler.storage().get()
            .then(updateUI)
            .catch(_handler.handleError);
    }
);

document.addEventListener('click', (event)=> { 
    if(event.target.id == "merge") {
        document.getElementById("merge").disabled = true;
        document.getElementById("fetch").disabled = true;
        _handler.mergeBookmarks()
            .then(updateUI)
            .catch(_handler.handleError);
    }
    if(event.target.id == "fetch") {
        document.getElementById("merge").disabled = true;
        document.getElementById("fetch").disabled = true;
        _handler.reloadBookmarks()
            .then(updateUI)
            .catch(_handler.handleError);
    }
});



