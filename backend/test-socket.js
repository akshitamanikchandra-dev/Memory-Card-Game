const io = require('socket.io-client');
const socket = io('http://localhost:3000');
const clientId = 'test-client-' + Date.now();
socket.on('connect', () => {
  console.log('Host Connected');
  socket.emit('user:save', { clientId, username: 'TestHost', avatar: 'bot-1' }, () => {
    socket.emit('room:create', { clientId, username: 'TestHost', avatar: 'bot-1', difficulty: 'easy', theme: 'emojis' }, (res) => {
      console.log('Room created:', res.room.roomId);
      const roomId = res.room.roomId;
      
      const socket2 = io('http://localhost:3000');
      const clientId2 = 'test-client-2';
      socket2.on('connect', () => {
        console.log('Player 2 Connected');
        socket2.emit('user:save', { clientId: clientId2, username: 'Player2', avatar: 'bot-2' }, () => {
          socket2.emit('room:join', { clientId: clientId2, username: 'Player2', avatar: 'bot-2', roomId }, (res2) => {
            console.log('Player 2 joined callback. Players in room:', res2.room.players.length);
            
            socket.emit('room:start', { roomId, clientId }, (res3) => {
               console.log('Host called room:start. Success:', res3.ok);
               setTimeout(() => process.exit(0), 1000);
            });
          });
        });
      });
      
      socket2.on('room:update', (room) => console.log('Player 2 received room:update. Status:', room.status, 'Players:', room.players.length));
      socket2.on('chat:message', (msg) => console.log('Player 2 received chat:', msg.text));
    });
  });
});

socket.on('room:update', (room) => console.log('Host received room:update. Status:', room.status, 'Players:', room.players.length));
socket.on('chat:message', (msg) => console.log('Host received chat:', msg.text));
