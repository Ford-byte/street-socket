const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');


require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: "*"
    }
});

// MySQL connection configuration
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
};

const pool = mysql.createPool(dbConfig);

app.get('/', (req, res) => {
    res.sendFile(__dirname, '/index.html');
});

app.get('/api/chats/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    pool.query(`SELECT chats.*, user.name 
        FROM chats 
JOIN user ON user.id = chats.user_1
WHERE (user_1 = ? AND user_2 = ?) OR (user_2 = ? AND user_1 = ?) 
ORDER BY created_at ASC;
`, [user1, user2, user1, user2], (err, results) => {
        if (err) {
   
            res.status(500).send('Error fetching messages'+err);
            return;
        }
        res.json(results);
    });
});

app.post('/api/chats', (req, res) => {
    const message = req.body;
    if (message.text === "") {
        return res.status(400).send({ data: 'Message cannot be empty' });
    }
    const uniqueId = uuidv4();
    res.status(200).send('Message saved successfully');

    io.emit('message', message);

    pool.query('INSERT INTO chats (id, user_1, user_2,  text) VALUES (?, ?,  ?, ?)', [uniqueId, message.user_1, message.user_2, message.text], (err, result) => {
        if (err) {
            console.log('Error saving message:', err);
            return;
        }
        console.log('Message saved to the database');
    });
});



// Handle incoming messages
io.on('connection', (socket) => {
    socket.on('message', (message) => {
        io.emit('message', message);
    });
    // Handle typing event
    socket.on("typing", (data) => {
        socket.broadcast.emit("typing", data); // Broadcast to other users
    });

    // Handle stop typing event
    socket.on("stopTyping", (data) => {
        socket.broadcast.emit("stopTyping", data); // Broadcast to other users
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected");
    });

});

server.listen(4001, () => {
    console.log('Server is running on http://localhost:4001');
});