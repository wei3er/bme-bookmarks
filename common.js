const Formats = {
    FIREFOX: "firefox",
    CHROME: "chrome",
    PORTABLE: "portable",
}

const AuthTypes = {
    NONE: "none",
    BASIC: "basic",
    BEARER: "bearer",
    GITHUB: "github",
}

const ContentTypes = {
    PLAIN: "none",
    GITHUB: "github",
}

const Events = {
    MERGE: "merge",
    FETCH: "fetch",
    ERROR: "error",
    STATE: "state",
    ACK: "ack",
};

function newEvent(type, value) {
    return { type: type, ts: new Date().getTime(), value: value };
}

function getStorage() {
    return browser.storage.local;
}

function httpRequest(obj) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(obj.method || "GET", obj.url);
        if (obj.headers) {
            Object.keys(obj.headers).forEach(key => {
                xhr.setRequestHeader(key, obj.headers[key]);
            });
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject(xhr.statusText);
            }
        };
        xhr.onerror = () => reject(xhr.statusText);
        xhr.send(obj.body);
    });
}



