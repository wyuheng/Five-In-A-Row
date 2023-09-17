const { getClientMap, deleteUserRoom, setUserRoom, getUserRoom } = require("./dataStorage.js");
const {chessRoomMap} = require("./dataStorage.js")


const ChaseBoardLength = 19;
const winCondition = 5;
const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];



function joinRoom(uId, roomId) {
    if(getUserRoom(uId) != undefined)
        throw new Error("User:" + uId + " already in a game");

    if (!chessRoomMap.has(roomId)) {
        console.log("New Room:" + roomId + " generated with u1:" + uId);
        initRoom(roomId, uId);
        setUserRoom(uId, roomId);
        return;
    } 
    room = chessRoomMap.get(roomId);
    if (room.u1Id == uId || room.u2Id == uId)
        return;
    else if (room.u2Id == null) {
        room.u2Id = uId;
        setUserRoom(uId, roomId);
        console.log("u2:" + uId + " joins the room:" + roomId + " check:" + chessRoomMap.get(roomId).u2Id);
    } else
        throw new Error("The room is full");
}

function requestHandler(uId, i, j, roomId) {
        console.log("Get uId:" + uId + " from clientMap");
        let ws = getClientMap(uId);
        //for current implementation
        let {winning, isU1, lastMove} = putStone(uId, roomId, i, j);
        //send feedback to the user
        ws.send(JSON.stringify(
            {msgType : "update", uId : uId, success : winning, lastMove : lastMove, valid : true, isU1 : isU1}
        ));
        //send update to the other user
        let room = chessRoomMap.get(roomId);
        let u2Id = room.u1Id == uId ? room.u2Id : room.u1Id;
        console.log("Get uId:" + u2Id + " from clientMap");
        //If there's a winner, the game is over. Delete the chessRoom
        if (winning) {
            chessRoomMap.delete(roomId);
            deleteUserRoom(uId, roomId);
            deleteUserRoom(u2Id, roomId);
        }
        getClientMap(u2Id).send(JSON.stringify(
            {msgType : "update", uId : uId, success : winning, lastMove : lastMove, valid : true, isU1 : isU1}
        ));
}

function initRoom(roomId, u1Id, u2Id = null) {
    if (chessRoomMap.has(roomId))
        return null;

    let matrix = [];
    for (let i = 0; i < ChaseBoardLength; i++) {
        matrix[i] = []; // Create an empty row
        for (let j = 0; j < ChaseBoardLength; j++) {
            matrix[i][j] = 0; // Initialize each element to zero
        }
    }
    let temp = {u1Id : u1Id, u2Id : u2Id, board : matrix, u1ToPlay : true, record : []};
    chessRoomMap.set(roomId, temp);
    return temp;
}

//TC: O(5)
function maxConsecutive(board, i, j, d1, d2, val) {
    let consecutive = 0;
    while(i >= 0 && i < ChaseBoardLength && j >= 0 && j < ChaseBoardLength) {
        if (board[i][j] != val) 
            break;
        ++consecutive;
        i += d1;
        j += d2;
    }
    return consecutive;
}


function checkSuccess(board, i, j, val) {
    for (const dir of dirs) {
        let d1 = dir[0], d2 = dir[1];
        let consecutive = maxConsecutive(board, i, j, d1, d2, val) + maxConsecutive(board, i, j, -d1, -d2, val) - 1;
        if (consecutive >= winCondition) {
            //the user is winning, delete the whole board;
            return true;
        }
    }
    return false;
    //if one wins, the server should also send a msg to the loser
}

//check whether the player wins after putting the stone
function putStone(uId, roomId, i, j) {
    if (!chessRoomMap.has(roomId)) {
        throw new Error("Room:" + roomId + " not existed!");
    }
    let room = chessRoomMap.get(roomId);
    if (room === null || room.u2Id === null)
        throw new Error("Cannot begin with one player:" + uId);
    if (room.u1Id != uId && room.u2Id != uId) {
        throw new Error("user:" + uId + " cannot play in the room:" + roomId);
    }
    //check whether it's current user's turn to play
    const isU1 = room.u1Id === uId ? true : false;
    if ((isU1 && !room.u1ToPlay) || (!isU1 && room.u1ToPlay)) {
        throw new Error("Not " + uId + "'s turn to play");
    }

    if (i < 0 || i >= ChaseBoardLength || j < 0 || j >= ChaseBoardLength || (room.board)[i][j] != 0) {
        throw new Error("Invalid location to put chess");
    }
    
    room.board[i][j] = isU1 ? 1 : 2;
    room.u1ToPlay = !room.u1ToPlay;
    let lastMove = [isU1 ? 1 : 2, i, j];
    //add a new move
    room.record.push(lastMove);
    return {winning : checkSuccess(room.board, i, j, (isU1 ? 1 : 2)), isU1 : isU1, lastMove : lastMove};
}

module.exports = {joinRoom, requestHandler};