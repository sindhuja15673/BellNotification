const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json());


mongoose.connect('mongodb://localhost:27017/chatApp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const messageSchema = new mongoose.Schema({
  text: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date }, 
  readNotificationSent: { type: Boolean, default: false }, 
});

messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Message = mongoose.model('Message', messageSchema);


app.get('/api/messages', async (req, res) => {
  const messages = await Message.find();
  res.json(messages);
});

app.post('/api/messages', async (req, res) => {
  const newMessage = new Message(req.body);
  await newMessage.save();

  io.emit('receiveMessage', newMessage);

  res.json(newMessage);
});

app.put('/api/messages/:id', async (req, res) => {
  const { id } = req.params;
  const updatedMessage = await Message.findByIdAndUpdate(id, req.body, { new: true });
  
  res.json(updatedMessage);
});

app.delete('/api/messages/:id', async (req, res) => {
  const { id } = req.params;
  await Message.findByIdAndDelete(id);
  res.status(204).send(); 
});


io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('readMessage', async (messageId) => {
    const message = await Message.findById(messageId);
    if (message && !message.read) {
      message.read = true;
      message.readAt = new Date();
      message.readNotificationSent = true; 
      await message.save();
      
      
      io.emit('messageReadNotification', message); 
    }
  });
  

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});


server.listen(5000, () => {
  console.log('Server running on port 5000');
});
