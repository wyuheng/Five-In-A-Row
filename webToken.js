const jwt = require('jsonwebtoken');

const jwtSecretKey = "This is a random jwt secret token!";

function assignToken(userId) {
// To create a JWT token
    const token = jwt.sign({ userId: userId }, jwtSecretKey, { expiresIn: '2d' });
    return token;
}

// To verify a JWT token
function checkToken(token) {
    try {
        const decoded = jwt.verify(token, jwtSecretKey);
        return {valid : true, uId : decoded.userId};
    } catch (error) {
        console.log(error);
        return {valid : false};
    }
}

module.exports = {assignToken, checkToken};