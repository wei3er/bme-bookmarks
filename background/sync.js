function handleError(error) {
    console.log(error);
    browser.runtime.sendMessage({ type: "error", ts: new Date(), value: error }).catch(e => console.log(e));
}

const syncAlarm = "sync-alarm"
browser.alarms.onAlarm.addListener(alarmInfo => {
        if(syncAlarm == alarmInfo.name) {
            browser.runtime.sendMessage({ type: "perform-reload", ts: new Date() }).catch(e => console.log(e));
        }
    });
getStorage().get().then(storageData => {
        browser.alarms.create(syncAlarm, { periodInMinutes: parseInt(storageData.reloadRate) });
    })
    .catch(handleError);

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    sendResponse({ ack: true, comp: "background" });
})
