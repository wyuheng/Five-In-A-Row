const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8000 });

const clientMap = new Map();

let cnt = 0;

generateUniqueUsername = () => {
    return cnt++;
}

wss.on('connection', (ws) => {
    console.log('Client connected');
    const username = generateUniqueUsername(); // assign a unique name for the new client
    //
    // Store the WebSocket client in the Map    
    ws.send(JSON.stringify({msgType : "initialize", uniqueName : username }));
    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
        //ws.send(`Server received: ${message}`);
        try {
             //******msg from client parsed with JSON.parse(event)**********/
            req = JSON.parse(message);
            if (req.msgType === 'move')
                requestHandler(req.name, req.row, req.col, req.roomId);
            else if (req.msgType === 'room') {
                console.log("Record uId:" + req.name + " in userMap");
                clientMap.set(username, ws); 
                joinRoom(req.name, req.roomId);
            } else
                throw new Error("Invalid MSG type!");
        } catch (error) {
            console.error('Error parsing JSON:', error.message);
            //send a denial msg
            ws.send(JSON.stringify(
                {msgType: "error", valid : false, msg : error.message}
            ));
        }
        
    });

    //add delete client func in the future
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

console.log('WebSocket server started on port 8000');


//Chess Room content
const ChaseBoardLength = 19;
const winCondition = 5;
const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];

const chessRoomMap = new Map(); //map

function joinRoom(uId, roomId) {
    if (!chessRoomMap.has(roomId)) {
        console.log("New Room:" + roomId + " generated with u1:" + uId);
        initRoom(roomId, uId);
    } 
    room = chessRoomMap.get(roomId);
    if (room.u1Id == uId || room.u2Id == uId)
        return;
    else if (room.u2Id == null) {
        room.u2Id = uId;
        console.log("u2:" + uId + " joins the room:" + roomId + " check:" + chessRoomMap.get(roomId).u2Id);
    } else
        throw new Error("The room is full");
}

function requestHandler(uId, i, j, roomId) {
        console.log("Get uId:" + uId + " from clientMap");
        let ws = clientMap.get(uId);
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
        clientMap.get(u2Id).send(JSON.stringify(
            {msgType : "update", uId : uId, success : winning, lastMove : lastMove, valid : true, isU1 : isU1}
        ));

        //If there's a winner, the game is over. Delete the chessRoom
        if (winning)  chessRoomMap.delete(roomId);
        //console.log(board); // This line won't be executed
}


//chess Room = {u1id, u2Id, board: [], u1ToPlay}
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
    if (room == null || room.u2Id == null)
        throw new Error("Cannot begin with one player:" + uId);
    if (room.u1Id != uId && room.u2Id != uId) {
        throw new Error("user:" + uId + " cannot play in the room:" + roomId);
    }
    //check whether it's current user's turn to play
    let isU1 = room.u1Id == uId;
    if (!(room.u1ToPlay == (room.u1Id == uId))) {
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
    //console.log("Room board:" + room.board);
    return {winning : checkSuccess(room.board, i, j, (isU1 ? 1 : 2)), isU1 : isU1, lastMove : lastMove};
}



