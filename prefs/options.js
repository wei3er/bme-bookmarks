function handleError(error) {
    console.error(error)
}

function saveOptions(e) {
    e.preventDefault();

    var bookmarks = [];
    var element = e.target.querySelector("#resources");
    for(i=0; i<element.children.length; i++) {
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
    getStorage().get().then(storageData => {
        if(storageData.bookmarks) {
            // copy state
            for(oldValue of storageData.bookmarks) {
                for(newValue of bookmarks) {
                    if(newValue.title == oldValue.title) {
                        newValue.state = oldValue.state;
                    }
                }
            }
        }
        getStorage().set({
                reloadRate: parseInt(e.target.querySelector("#reload").value),
                bookmarks: bookmarks,
            }).catch(handleError);
    });
}

function getOptional(obj, key, defaultValue) {
    if(!obj || !(key in obj)) {
        return defaultValue;
    }
    return obj[key];
}

function restoreOptions() {
    getStorage().get().then(storageData => {
            document.querySelector("#reload").value = getOptional(storageData, "reloadRate", 15);

            var bookmarks = getOptional(storageData, "bookmarks", [{ uri: "https://exmaple.com/bookmarks.json", format: "Firefox" }]);
            for(i in bookmarks) {
                var idx = parseInt(i) + 1;
                addResource(idx);
                document.querySelector(`#title-${idx}`).value = bookmarks[i].title;
                document.querySelector(`#folder-${idx}`).value = bookmarks[i].folder;
                document.querySelector(`#uri-${idx}`).value = bookmarks[i].uri;

                document.querySelector(`#firefox-${idx}`).checked = bookmarks[i].format == Formats.FIREFOX;
                document.querySelector(`#chrome-${idx}`).checked = bookmarks[i].format == Formats.CHROME;
                document.querySelector(`#portable-${idx}`).checked = bookmarks[i].format == Formats.PORTABLE;

                document.querySelector(`#plain-${idx}`).checked = bookmarks[i].content == ContentTypes.PLAIN;
                document.querySelector(`#github1-${idx}`).checked = bookmarks[i].content == ContentTypes.GITHUB;

                if(bookmarks[i].auth) {
                    document.querySelector(`#none-${idx}`).checked = bookmarks[i].auth.type == AuthTypes.NONE;
                    document.querySelector(`#basic-${idx}`).checked = bookmarks[i].auth.type == AuthTypes.BASIC;
                    document.querySelector(`#bearer-${idx}`).checked = bookmarks[i].auth.type == AuthTypes.BEARER;
                    document.querySelector(`#github2-${idx}`).checked = bookmarks[i].auth.type == AuthTypes.GITHUB;
                    document.querySelector(`#aval-${idx}`).value = bookmarks[i].auth.value;
                }
            }
        })
        .catch(handleError);
}

function addResource(idx) {
    var child = document.createElement("div");
    child.className = "resline";
    child.innerHTML += `
            <div><nobr>
                <label class="main" for="title-${idx}">Title*: </label><input type="text" id="title-${idx}" class="title">
                <label class="main" for="folder-${idx}">Folder: </label><input type="text" id="folder-${idx}" class="folder">
            </nobr></div>
            <div><nobr>
                <label class="main" for="uri-${idx}">URI*: </label><input type="text" id="uri-${idx}" class="uri">
            </nobr></div>
            <div><nobr>
                <label class="main">Format*: </label>
                <input type="radio" id="firefox-${idx}" name="format-${idx}" value="${Formats.FIREFOX}" checked>
                <label for="firefox-${idx}">Firefox</label>
                <input type="radio" id="chrome-${idx}" name="format-${idx}" value="${Formats.CHROME}">
                <label for="chrome-${idx}">Chrome</label>
                <input type="radio" id="portable-${idx}" name="format-${idx}" value="${Formats.PORTABLE}">
                <label for="portable-${idx}">Portable</label>
            </nobr></div>
            <div><nobr>
                <label class="main">Content Type*: </label>
                <input type="radio" id="plain-${idx}" name="content-${idx}" value="${ContentTypes.PLAIN}" checked>
                <label for="plain-${idx}">Plain</label>
                <input type="radio" id="github1-${idx}" name="content-${idx}" value="${ContentTypes.GITHUB}">
                <label for="github1-${idx}">GitHub</label>
            </nobr></div>
            <div><nobr>
                <label class="main">Auth Type*: </label>
                <input type="radio" id="none-${idx}" name="auth-${idx}" value="${AuthTypes.NONE}" checked>
                <label for="none-${idx}">None</label>
                <input type="radio" id="basic-${idx}" name="auth-${idx}" value="${AuthTypes.BASIC}">
                <label for="basic-${idx}">Basic</label>
                <input type="radio" id="bearer-${idx}" name="auth-${idx}" value="${AuthTypes.BEARER}">
                <label for="bearer-${idx}">Bearer</label>
                <input type="radio" id="github2-${idx}" name="auth-${idx}" value="${AuthTypes.GITHUB}">
                <label for="github2-${idx}">GitHub</label>
            </nobr></div>
            <div><nobr>
                <label class="main" for="aval-${idx}">Auth Value*: </label><input type="password" id="aval-${idx}" class="title">
            </nobr></div>`;
    document.querySelector("#resources").appendChild(child);
}

function rmResource() {
    var element = document.querySelector("#resources");
    if(element.childElementCount > 1) {
        element.removeChild(element.children[element.childElementCount - 1])
    }
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
document.addEventListener('click', (event)=> { 
    if(event.target.id == "add") {
        addResource(document.querySelector("#resources").childElementCount + 1);
    }
    if(event.target.id == "remove") {
        rmResource();
    }
});