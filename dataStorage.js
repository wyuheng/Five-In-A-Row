const clientMap = new Map();
const userPasswordMap = new Map();
const userRoomMap = new Map();
const chessRoomMap = new Map(); 
const userClientMap = new Map();

function setUserClient(uId, cId) {
    userClientMap.set(uId, cId);
}

function getUserClient(uId) {
    userClientMap.get(uId);
}

function setClientMap(uId, ws) {
    clientMap.set(uId, ws);
}

function getClientMap(uId) {
    return clientMap.get(uId);
}

function checkUser(uId) {
    return userPasswordMap.has(uId);
}

function setUpNewUser(username, password) {
    if (userPasswordMap.has(username))
        return false;
    userPasswordMap.set(username, password);
    return true;
}

function checkPassword(uId, password) {
    return userPasswordMap.get(uId) === password;
}

function setUserRoom(uId, roomId) {
    if (userRoomMap.has(uId)) return false;
    userRoomMap.set(uId, roomId);
    return true;
}

function getUserRoom(uId) {
    return userRoomMap.get(uId);
}

function deleteUserRoom(uId, roomId) {
    if (userRoomMap.get(uId) != roomId)
        throw new Error("Cannot remove user:" + uId + " from a game which the user doesn't join");
    userRoomMap.delete(uId);
}

function getChessRoomRecord(roomId) {
    if (!chessRoomMap.has(roomId))
        return null;
    return chessRoomMap.get(roomId).record;
}


module.exports = {chessRoomMap, checkUser, setClientMap, getClientMap, setUpNewUser, checkPassword, 
                setUserRoom, deleteUserRoom, getUserRoom, getChessRoomRecord, setUserClient, getUserClient};