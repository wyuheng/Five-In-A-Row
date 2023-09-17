const {assignToken, checkToken} = require('./webToken.js');
const {setUpNewUser, checkPassword, getUserRoom, getChessRoomRecord} = require('./dataStorage.js');


const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(
    cors({
      origin: ['http://localhost:3000', 'http://localhost:3001','https://5inarow.d29zru9wx39pau.amplifyapp.com'],
      credentials: true,
    })
);
const server = http.createServer(app);

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log("username:" + username + " password:" + password);
    // Check if the user exists and the password is correct
    if (!checkPassword(username, password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  
    // Create a JWT token for the user  
    // Return the token to the client
    res.json({ token : assignToken(username) });
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!setUpNewUser(username, password))
        return res.status(401).json({ msgType: "error", msg: 'username existed' });
    res.json({ msgType: "initialize", msg: 'Register successfully' });
});

app.get('/username', (req, res) => {
    try{
        // Get the Authorization header from the request
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({msgType : "error", msg:  'Unauthorized - No Authorization header' });
        }
        const token = authHeader.split(' ')[1]; // Assuming it's in the "Bearer <token>" format
        
        const {valid, uId} = checkToken(token);
        if (!valid)
            res.status(401).json({msgType : "error", msg: 'Invalid token' });
        else {
            roomId = getUserRoom(uId);
            console.log("Send uId:" + uId + " roomId:" +  roomId);
            res.status(200).json({msgType : "initialize", uId: uId, 
                                    roomId : (roomId === undefined ? null : roomId),
                                    record : (roomId === undefined ? null : getChessRoomRecord(roomId))
                                });
        }
    } catch (error) {
        console.log("Error when get username with token :" + error);
    }
});


server.listen(8000, () => {
    console.log('API Server is running on port 8000');
});

module.exports = server;