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
                index: thisNode.index,
                url: thisNode.uri,
            });
        }
    }
}