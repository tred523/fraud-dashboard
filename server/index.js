const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// Webhook must be mounted before express.json() to capture raw body for signature verification
app.use('/api/webhook',   require('./routes/webhook'));
app.use(express.json());

app.use('/api/upload',    require('./routes/upload'));
app.use('/api/events',    require('./routes/events'));
app.use('/api/visitor',   require('./routes/visitor'));
app.use('/api/overview',  require('./routes/overview'));
app.use('/api/anomalies', require('./routes/anomalies'));
app.use('/api/clusters',  require('./routes/clusters'));
app.use('/api/graph',     require('./routes/graph'));
app.use('/api/ingest',    require('./routes/ingest'));
app.use('/api/behavior', require('./routes/behavior'));
app.use('/api/verdict', require('./routes/verdict'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/labels',  require('./routes/labels'));

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../client/dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

(async () => {
  await initDb();
  app.listen(PORT, () => console.log(`Fraud Dashboard API → http://localhost:${PORT}`));
})();
