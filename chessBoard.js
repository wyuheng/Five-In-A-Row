const { getClientMap, deleteUserRoom, setUserRoom, getUserRoom } = require("./dataStorage.js");
const {chessRoomMap} = require("./dataStorage.js");
const AIName = "AIOpponentBot";

const ChessBoardLength = 19;
//const ChessBoardLength = 4;
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
    if (room.u1Id == uId || room.u2Id == uId) {
        console.log("user:" + uId + " is already in the room:" + uId);
        return;
    }
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
        if (uId != AIName && ws === undefined)
            throw new Error("Cannot find the ws of uId:" + uId);
        //for current implementation
        let {winning, isU1, lastMove} = putStone(uId, roomId, i, j);
        //send feedback to the user
        if (ws != undefined) {
            ws.send(JSON.stringify(
                {msgType : "update", uId : uId, success : winning, lastMove : lastMove, valid : true, isU1 : isU1}
            ));
        }
        //send update to the other user
        let room = chessRoomMap.get(roomId);
        let u2Id = room.u1Id == uId ? room.u2Id : room.u1Id;
        
        //If there's a winner, the game is over. Delete the chessRoom
        if (winning) {
            chessRoomMap.delete(roomId);
            deleteUserRoom(uId, roomId);
            deleteUserRoom(u2Id, roomId);
        }

        if (u2Id === AIName) {
            //let the AI play instead of sending msg to user2
            const currAI = chessRoomMap.get(roomId).AI;
            if (currAI === null || currAI === undefined)
                throw new Error("Not an AI room");
            currAI.updateMCTS([lastMove[1], lastMove[2]]);
            const nextMoveOfAI = currAI.getBestMove();
            console.log("AI move to:" + nextMoveOfAI);
            currAI.updateMCTS(nextMoveOfAI);
            requestHandler(AIName, nextMoveOfAI[0], nextMoveOfAI[1], roomId);
            return;
        }

        console.log("Get uId:" + u2Id + " from clientMap");
        const ws2 = getClientMap(u2Id);
        if (ws2 === undefined)
            throw new Error("Cannot find the ws of uId:" + uId);
        ws2.send(JSON.stringify(
            {msgType : "update", uId : uId, success : winning, lastMove : lastMove, valid : true, isU1 : isU1}
        ));
}

function initRoom(roomId, u1Id, u2Id = null) {
    if (chessRoomMap.has(roomId))
        return null;

    let matrix = [];
    for (let i = 0; i < ChessBoardLength; i++) {
        matrix[i] = []; // Create an empty row
        for (let j = 0; j < ChessBoardLength; j++) {
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
    while(i >= 0 && i < ChessBoardLength && j >= 0 && j < ChessBoardLength) {
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

    if (i < 0 || i >= ChessBoardLength || j < 0 || j >= ChessBoardLength || (room.board)[i][j] != 0) {
        throw new Error("Invalid location to put chess");
    }
    
    room.board[i][j] = isU1 ? 1 : 2;
    room.u1ToPlay = !room.u1ToPlay;
    let lastMove = [isU1 ? 1 : 2, i, j];
    //add a new move
    room.record.push(lastMove);
    return {winning : checkSuccess(room.board, i, j, (isU1 ? 1 : 2)), isU1 : isU1, lastMove : lastMove};
}

function joinAIRoom(uId, roomId) {
    joinRoom(uId, roomId);
    joinRoom(AIName, roomId);

    const room = chessRoomMap.get(roomId);
    room.AI = new MCTSTree(room.board);
}


/***********************AI*************************** */

//build an AI with MCTS tree
//const {ChessBoardLength, checkSuccess} = require('./chessBoard.js')

const C = 2;

class Node{
    constructor(state, player, endOfGame, parent = null) {
        this.endOfGame = endOfGame;
        this.totalVal = 0;
        this.visit = 0;
        this.parent = parent;
        this.state = state;
        this.player = player;
        //use next move as the search key so that the target child can be found in O(1)
        this.children = new Map();
    }

    UCB1() {
        if (this.visit == 0 || Node.round < 1)
            return Infinity;
        return this.totalVal / this.visit + C * Math.sqrt(Math.log(Node.round) / this.visit)
    }

    getAvg() {
        return this.visit === 0 ? Infinity : this.totalVal / this.visit;
    }

    printNode() {
        console.log('/***************** */');
        console.log("Node val:" + this.totalVal + " vis:" + this.visit);
        for (let i = 0; i < ChessBoardLength; ++i)
            console.log(this.state[i]);
        console.log('/***************** */');
    }
}




class MCTSTree{
    constructor(state, player) {
        this.root = new Node(state, player, false, null);
        Node.round = 0; //define a static field for Node
    }

    runMCTS(iterationTimes, iterationDepth) {
        //this.root.printNode();
        while (!this.root.endOfGame && iterationTimes-- > 0) {
            this.performIteration(iterationDepth);
        }
    }

    performIteration(depthLimit) {
       let currNode = this.root;
        
       while(currNode.children.size != 0 && depthLimit-- > 0) {
            //currNode.printNode();
            currNode = select(currNode);
       }
       let val = 0;
       if (currNode.visit == 0) {
            val = simulation(currNode);
       } else {
            if (depthLimit > 0 && !currNode.endOfGame) {
                expand(currNode);
                currNode = select(currNode);
            }
            val = simulation(currNode);     
       }
       backPropagation(currNode, val);
       //console.log("\\\\\\\\end of one loop///////// \n");
    }

    stopMCTS() {
        this.running = false;
        console.log("Waiting for the tree to stop");
        while(this.inProcess) {   
            //busy waiting
            //not a good implementation, but the easiest one since JS doesn't have an in-built lock
        }
    }

    updateMCTS(newMove) {
        if (!this.root.children.has(getKey(newMove))) {
            forceExpand(this.root, newMove);  
        } 
        const nextRoot = this.root.children.get(getKey(newMove));
        //disconnect from parent, hoping that the GC process can delete parent to save memory
        nextRoot.parent = null;
        this.root.children.clear();
        this.root = nextRoot;
    }

    getBestMove() {
        this.runMCTS(30000, 10);
        let bestMove = [], bestMoveNode = null;
        for (const [lastMove, nextNode] of this.root.children.entries()) {
            //console.log("Move:" +  [Math.floor(lastMove / ChessBoardLength), Math.floor(lastMove % ChessBoardLength)] + " score:" + nextNode.getAvg());
            //if there's one move to win directly, then just pick this move
            if (nextNode.endOfGame && nextNode.player == 2) {
                bestMove = lastMove;
                break;
            }

            if (bestMoveNode === null || nextNode.getAvg() > bestMoveNode.getAvg()) {
                bestMove = lastMove;
                bestMoveNode = nextNode;
            }
        }
        return [Math.floor(bestMove / ChessBoardLength), Math.floor(bestMove % ChessBoardLength)];
    }
}

function backPropagation(node, val) {
    //console.log("back Propagation");
    while(node != null) {
        node.totalVal += val;
        ++node.visit;
        node = node.parent;
    }
    ++Node.round;
}


function select (node) {
    
    if (node.children.length == 0)
        throw new Error("Cannot do selection on a leaf node");
    let candidate = null, bestUCB = -Infinity, moveChosen = null;
    for (const [lastMove, nextNode] of node.children.entries()) {
        if (nextNode.UCB1() > bestUCB) {
            candidate = nextNode;
            bestUCB = nextNode.UCB1();
            moveChosen = lastMove;
        }
    }
    //console.log("select candidate:[" + Math.floor(moveChosen / ChessBoardLength) + "," + Math.floor(moveChosen % ChessBoardLength) + "]");
    return candidate;
}

function expand(node) {
    //console.log("expand with node:");
    //node.printNode();
    if (node.endOfGame)
        return;
    //("The game has ended, so the current node cannot be expanded");
    const moves = getValidMove(node.state);
    //console.log("Valid move:");
    //console.log(moves);
    for (const move of moves) {
        generateNewState(node, move)
    }
}

//force the node to expand a specific move if it's not in the children map
function forceExpand(node, move) {
    console.log("force expand");
    if (node.endOfGame)
        return;
    //("The game has ended, so the current node cannot be expanded");
    generateNewState(node, move)
}

//previous node, new move
function generateNewState(node, move) {
    const lastPlayer = node.player == 1 ? 2 : 1;
    const newState = moveToNewState(node.state, move, lastPlayer);
    const newNode = new Node(newState, lastPlayer, checkSuccess(newState, move[0], move[1], lastPlayer), node);
    node.children.set(getKey(move), newNode);
}


function simulation(node) {
    if(node.endOfGame)
        return node.player == 1 ? -1 : 1;
    //console.log("simulation with node:");
    //node.printNode();
    const board = copyMatrix(node.state);
    const allMoves = []
    for (let i = 0; i < ChessBoardLength; ++i) {
        for (let j = 0; j < ChessBoardLength; ++j) {
            if (node.state[i][j] == 0)
                allMoves.push([i, j]);
        }
    }
    //classic random shuffling algorithm
    let L = allMoves.length, currPlayer = node.player == 1 ? 2 : 1;
    while(L > 0) {
        //randomly select a move
        let idx = Math.floor(Math.random() * L);
        //update state
        board[allMoves[idx][0]][allMoves[idx][1]] = currPlayer;
        if (checkSuccess(board, allMoves[idx][0], allMoves[idx][1], currPlayer))
            return currPlayer == 1 ? -1 : 1; //if the AI wins, return 1
        //swap idx to the end
        allMoves[idx] = allMoves[L - 1];
        
        //update L and currPlayer
        --L;
        currPlayer = currPlayer == 1 ? 2 : 1;
    }
    //draw
    return 0;
}



function getKey(move) {
    return move[0] * ChessBoardLength + move[1];
}

function moveToNewState(state, move, player) {
    const currState = copyMatrix(state);
    currState[move[0]][move[1]] = player;
    return currState;
}

function getValidMove (state) {
    //console.log("get valid moves:");
    const M = state.length, N = state[0].length;
    const ans = [];
    for (let i = 0; i < M; ++i) {
        for (let j = 0; j < N; ++j) {
            //console.log("i:" + i + " j:" + j);
            if(state[i][j] == 0 && hasNeighbor(i, j, state, 1)) {
                ans.push([i, j]);
            }
           
        }
       
    }
    return ans.length == 0? [[Math.floor(ChessBoardLength / 2), Math.floor(ChessBoardLength / 2)]] : ans;
}

function hasNeighbor(row,col, state, dis) {
    const M = state.length, N = state[0].length;
    for (let i = Math.max(row - dis, 0); i <= Math.min(row + dis, M - 1); ++i) {
        for (let j = Math.max(col - dis, 0); j <= Math.min(col + dis, N - 1); ++j) {
            if (state[i][j] != 0)
                return true;
        }
    }
    return false;
}

function copyMatrix(state) {
    const M = state.length, N = state[0].length;
    const mat = [];
    for (let i = 0; i < M; ++i) {
        mat[i] = [];
        for (let j = 0; j < N; ++j)
            mat[i][j] = state[i][j];
    }
    return mat;
}

module.exports = {joinRoom, requestHandler, checkSuccess, joinAIRoom, ChessBoardLength};