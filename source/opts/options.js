const _parser = require('../parser.js');
const _handler = require('../handler.js');

function saveOptions(e) {
    e.preventDefault();

    var bookmarks = [];
    var element = e.target.querySelector("#resources");
    for(var i=0; i<element.children.length; i++) {
        var idx = parseInt(i) + 1;
        var title = e.target.querySelector(`#title-${idx}`).value;
        var folder = e.target.querySelector(`#folder-${idx}`).value;
        var uri = e.target.querySelector(`#uri-${idx}`).value;
        var format = e.target.querySelector(`input[name="format-${idx}"]:checked`).value;
        var content = e.target.querySelector(`input[name="content-${idx}"]:checked`).value;
        var auth = e.target.querySelector(`input[name="auth-${idx}"]:checked`).value;
        var aval = e.target.querySelector(`#aval-${idx}`).value;
        bookmarks.push({ 
            title: title, 
            folder: folder, 
            uri: uri, 
            format: format, 
            auth: {
                type: auth,
                value: aval,
            }, 
            content: content 
        });
    }
    _handler.storage().get()
        .then(storageData => {
            if(storageData.bookmarks) {
                // copy state
                for(var newValue of bookmarks) {
                    for(var oldValue of storageData.bookmarks) {
                        if(newValue.title == oldValue.title) {
                            newValue.state = oldValue.state;
                            newValue.target = oldValue.target;
                            newValue.error = oldValue.error;
                        }
                    }
                }
            }
        })
        .then(storageData => {
            return _handler.storage().set({
                reloadRate: parseInt(e.target.querySelector("#reload").value),
                bookmarks: bookmarks,
            });
        })
        .catch(_handler.handleError);
}

function getOptional(obj, key, defaultValue) {
    if(!obj || !(key in obj)) {
        return defaultValue;
    }
    return obj[key];
}

function restoreOptions() {
    _handler.storage().get()
        .then(storageData => {
            document.querySelector("#reload").value = getOptional(storageData, "reloadRate", 15);
            
            document.querySelector("#resources").innerHTML = "";
            var bookmarks = getOptional(storageData, "bookmarks", [{ uri: "https://exmaple.com/bookmarks.json", format: "Firefox" }]);
            for(var i in bookmarks) {
                var idx = parseInt(i) + 1;
                addResource(idx);
                document.querySelector(`#title-${idx}`).value = bookmarks[i].title;
                document.querySelector(`#folder-${idx}`).value = bookmarks[i].folder;
                document.querySelector(`#uri-${idx}`).value = bookmarks[i].uri;

                document.querySelector(`#firefox-${idx}`).checked = bookmarks[i].format == _parser.Formats.FIREFOX;
                document.querySelector(`#chrome-${idx}`).checked = bookmarks[i].format == _parser.Formats.CHROME;
                document.querySelector(`#portable-${idx}`).checked = bookmarks[i].format == _parser.Formats.PORTABLE;

                document.querySelector(`#plain-${idx}`).checked = bookmarks[i].content == _handler.ContentTypes.PLAIN;
                document.querySelector(`#github1-${idx}`).checked = bookmarks[i].content == _handler.ContentTypes.GITHUB;

                if(bookmarks[i].auth) {
                    document.querySelector(`#none-${idx}`).checked = bookmarks[i].auth.type == _handler.AuthTypes.NONE;
                    document.querySelector(`#basic-${idx}`).checked = bookmarks[i].auth.type == _handler.AuthTypes.BASIC;
                    document.querySelector(`#bearer-${idx}`).checked = bookmarks[i].auth.type == _handler.AuthTypes.BEARER;
                    document.querySelector(`#github2-${idx}`).checked = bookmarks[i].auth.type == _handler.AuthTypes.GITHUB;
                    document.querySelector(`#aval-${idx}`).value = bookmarks[i].auth.value;
                }
            }
        })
        .catch(_handler.handleError);
}

function addResource(idx) {
    var child = document.createElement("div");
    child.className = "resline";
    child.innerHTML += `
            <div><nobr>
                <label for="title-${idx}">Title*: </label><input type="text" id="title-${idx}" class="title">
                <label for="folder-${idx}">Folder: </label><input type="text" id="folder-${idx}" class="folder">
            </nobr></div>
            <div><nobr>
                <label for="uri-${idx}">URI*: </label><input type="text" id="uri-${idx}" class="uri">
            </nobr></div>
            <div><nobr>
                <label>Format*: </label>
                <input type="radio" id="firefox-${idx}" name="format-${idx}" value="${_parser.Formats.FIREFOX}" checked>
                <label for="firefox-${idx}">Firefox</label>
                <input type="radio" id="chrome-${idx}" name="format-${idx}" value="${_parser.Formats.CHROME}">
                <label for="chrome-${idx}">Chrome</label>
                <input type="radio" id="portable-${idx}" name="format-${idx}" value="${_parser.Formats.PORTABLE}">
                <label for="portable-${idx}">Portable</label>
            </nobr></div>
            <div><nobr>
                <label>Content Type*: </label>
                <input type="radio" id="plain-${idx}" name="content-${idx}" value="${_handler.ContentTypes.PLAIN}" checked>
                <label for="plain-${idx}">Plain</label>
                <input type="radio" id="github1-${idx}" name="content-${idx}" value="${_handler.ContentTypes.GITHUB}">
                <label for="github1-${idx}">GitHub</label>
            </nobr></div>
            <div><nobr>
                <label>Auth Type*: </label>
                <input type="radio" id="none-${idx}" name="auth-${idx}" value="${_handler.AuthTypes.NONE}" checked>
                <label for="none-${idx}">None</label>
                <input type="radio" id="basic-${idx}" name="auth-${idx}" value="${_handler.AuthTypes.BASIC}">
                <label for="basic-${idx}">Basic</label>
                <input type="radio" id="bearer-${idx}" name="auth-${idx}" value="${_handler.AuthTypes.BEARER}">
                <label for="bearer-${idx}">Bearer</label>
                <input type="radio" id="github2-${idx}" name="auth-${idx}" value="${_handler.AuthTypes.GITHUB}">
                <label for="github2-${idx}">GitHub</label>
            </nobr></div>
            <div><nobr>
                <label for="aval-${idx}">Auth Value*: </label><input type="password" id="aval-${idx}" class="title">
            </nobr></div>`;
    document.querySelector("#resources").appendChild(child);
}

function rmResource() {
    var element = document.querySelector("#resources");
    if(element.childElementCount > 1) {
        element.removeChild(element.children[element.childElementCount - 1])
    }
}

function exportOptions() {
    _handler.storage().get()
        .then(storageData => {
            var element = document.createElement('a');
            element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(storageData)));
            element.setAttribute('download', "settings.json");
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        })
        .catch(_handler.handleError);
}

function importOptions(file) {
    file.text()
        .then(data => {
            return _handler.storage().set(JSON.parse(data))
                .catch(_handler.handleError);
        })
        .then(data => {
            restoreOptions();
        })
        .catch(_handler.handleError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
document.addEventListener('click', (event) => { 
    if(event.target.id == "add") {
        addResource(document.querySelector("#resources").childElementCount + 1);
    }
    if(event.target.id == "remove") {
        rmResource();
    }
    if(event.target.id == "export") {
        exportOptions();
    }
    if(event.target.id == "import") {
        importFile.click();
    }
});

document.getElementById("importFile").addEventListener("change", function() {
    importOptions(this.files[0]);
}, false);
