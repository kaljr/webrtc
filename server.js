'use strict'

const fs = require('fs');
const express = require('express');
const app = express();
const https = require('https');
const wsServer = require('ws').Server;
let bodyParser = require('body-parser');

const serverConfig = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
};


// CONSTANTS
const PORT = 3000 // change this to use process.env.PORT for real use


// GLOBALS
const sockets = {}
let socketIdCounter = 0;


// MIDDLEWARES
app.use(express.static('public'));
app.use(bodyParser.json());


// Connect app to http server
const httpsServer = https.createServer(serverConfig);
httpsServer.on('request', app);


// Create Websocket server, connect to http
const wss = new wsServer({
  server: httpsServer
})


//// Handle Connections
//
httpsServer.listen(PORT, () => {
  console.log(`Example app listening at http://localhost:${PORT}`)
})


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

wss.on('connection', function connection(ws) {
  console.log('user connected')

  assignID(ws)
  
  // handle messages for this websocket connection
  ws.on('message', function incoming(msg) {

    // Broadcast received message to all other sockets but the sender
    for (let id in sockets) {
        if (sockets[id].socket !== ws) {
            sockets[id].socket.send(msg)
        }
    }
  });
});


//// Functions
//
function assignID(ws) {
    const id = getNextSocketId();
    sockets[id] = {
        socket: ws
    }

    // sendSocketId(ws, id)
}

function getNextSocketId() {
    let id = socketIdCounter
    socketIdCounter++

    return id
}

function sendJSON(socket, obj) {
    socket.send(JSON.stringify(obj))
}

function sendSocketId(socket, id) {
    sendJSON(socket,
      {
        type: 'socket-id',
        id: id
      })
  }