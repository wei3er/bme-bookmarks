
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
                index: thisNode.index,
                url: thisNode.uri,
            });
        }
    }
}