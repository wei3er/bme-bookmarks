
function parseFirefox(folder, raw) {
    var items = [];
    parseFirefoxNode(items, folder != null && folder != "" ? [ folder ] : [], JSON.parse(raw));
    return items;
}

function parseFirefoxNode(items, path, thisNode) {
    var p = path;
    if(thisNode.children) {
        if(!thisNode.root && thisNode.typeCode == 2) {
            p = [...p, thisNode.title];
        }
        for(child of thisNode.children) {
            parseFirefoxNode(items, p, child)
        }
    } else {
        if(thisNode.typeCode == 1 && thisNode.uri) {
            items.push({
                path: p,
                title: thisNode.title,
                url: thisNode.uri,
            });
        }
    }
}

//#####

function parsePortable(folder, raw) {
    var items = JSON.parse(raw);
    if(folder != null && folder != "") {
        for(var item of items) {
            item.path = [folder, ...item.path]
        }
    }
    return items;
}

//#####

function parseChrome(folder, raw) {
    var items = [];
    parseChromeNode(items, folder != null && folder != "" ? [ folder ] : [], JSON.parse(raw));
    return items;
}

function parseChromeNode(items, path, thisNode) {
    if(true) throw "not yet implemented!"
    var p = path;
    if(thisNode.children) {
        if(!thisNode.root && thisNode.typeCode == 2) {
            p = [...p, thisNode.title];
        }
        for(child of thisNode.children) {
            parseChromeNode(items, p, child)
        }
    } else {
        if(thisNode.typeCode == 1 && thisNode.uri) {
            items.push({
                path: p,
                title: thisNode.title,
                url: thisNode.uri,
            });
        }
    }
}