const server = require('./APIServer.js')
const {checkToken} = require('./webToken.js')
const {joinRoom, requestHandler} = require('./chessBoard.js');
const {setClientMap} = require('./dataStorage.js')

const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });



wss.on('connection', (ws) => {
    console.log('Client connected');
    //const username = generateUniqueUsername(); // assign a unique name for the new client
    //
    // Store the WebSocket client in the Map
    
    
    ws.on('message', (message) => {
        //ws.send(`Server received: ${message}`);
        try {
            
            console.log(`Received: ${message}`);
            //token authentication
            
            const reqMsg = JSON.parse(message);
            const reqHeaders = reqMsg.headers;
            //Normally each token has a 'Bearer ' prefix, which should be removed
            const token = reqHeaders.Authorization.split(' ')[1];
            console.log("Extract Token:" + token);
            const {valid, uId} = checkToken(token);
            if (!valid) {
                //1000: connection is being closed intentionally, without any errors or issues
                ws.close(1000, 'Invalid token');
                return;
            }
            

             //******msg from client parsed with JSON.parse(event)**********/
            const req = reqMsg.body;
            console.log(`Request body: ${JSON.stringify(req)}`);
            if (req.msgType === 'move') {
                requestHandler(uId, req.row, req.col, req.roomId);
            } else if (req.msgType === 'room') {
                console.log("Record uId:" + uId + " in userMap");
                setClientMap(uId, ws); 
                joinRoom(uId, req.roomId);
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

console.log('WebSocket server started');


