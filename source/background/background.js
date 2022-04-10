const _handler = require('../handler.js');

function updateNextFetch(alarmName) {
    return _handler.storage().get()
        .then(_state => {
            var nextFetch = new Date().getTime() + (_state.reloadRate || 30)*60000;
            return _handler.alarms().get(alarmName)
                .then((alarmInfo) => {
                    return _handler.alarms().clear(alarmName);
                })
                .finally(() => {
                    _handler.alarms().create(alarmName, { when: nextFetch });
                    return _handler.storage().set({ nextFetch: nextFetch });
                });
        });
}

const syncAlarm = "sync-alarm";
// refresh bookmarks source periodically
_handler.alarms().onAlarm.addListener(alarmInfo => {
    if (syncAlarm == alarmInfo.name) {
        return _handler.reloadBookmarks()
            .catch(_handler.handleError)
            .finally(updateNextFetch(syncAlarm));
    }
})
updateNextFetch(syncAlarm)
    .then(() => {
        // keep track of storage changes
        return _handler.onStorageChange((changes, area) => {
            for (let item of Object.keys(changes)) {
                if (item = "reloadRate") {
                    return updateNextFetch(syncAlarm);
                }
            }
        });
    })
    .then(() => {
        // perform initial reload
        return _handler.reloadBookmarks();
    })
    .catch(_handler.handleError);

// listen for bookmark changes
function setModified(id, changeInfo) {
    _handler.storage().set({ modified: new Date().getTime() })
        .catch(_handler.handleError);
}
_handler.bookmarks().onCreated.addListener(setModified);
_handler.bookmarks().onRemoved.addListener(setModified);
_handler.bookmarks().onChanged.addListener(setModified);
_handler.bookmarks().onMoved.addListener(setModified);
