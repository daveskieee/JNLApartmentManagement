const express = require('express');
const app = express();

console.log('Creating express app...');

app.get('/', (req, res) => {
  console.log('Received GET request');
  res.json({ status: 'ok' });
});

console.log('Attempting to listen on port 5000...');

try {
  const server = app.listen(5000, () => {
    console.log('✅ Server is listening on port 5000');
  });
  
  server.on('error', (err) => {
    console.error('Server error:', err.message);
  });
  
  console.log('✅ app.listen() called, waiting for callback...');
} catch (err) {
  console.error('Error creating server:', err.message);
}

let count = 0;
const timer = setInterval(() => {
  count++;
  console.log(`Still running (${count*5} seconds)...`);
  if (count >= 4) clearInterval(timer);
}, 5000);
