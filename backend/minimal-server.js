const express = require('express');

const app = express();

app.use(express.json());

app.get('/test', (req, res) => {
  console.log('GET /test called');
  res.json({ status: 'OK' });
});

app.post('/test', (req, res) => {
  console.log('POST /test called with body:', req.body);
  res.json({ status: 'OK', received: req.body });
});

const PORT = 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal server listening on port ${PORT} on 0.0.0.0`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
