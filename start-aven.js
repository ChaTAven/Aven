'use strict';

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const values = dotenv.parse(fs.readFileSync(envPath));
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const probe = net.createServer();

probe.once('error', er => {
  if (er.code === 'EADDRINUSE') {
    console.error(`Aven başlatılmadı: ${HOST}:${PORT} zaten kullanımda; yinelenen başlatma atlandı.`);
    process.exit(98);
  }
  console.error('Aven port kontrolü başarısız:', er);
  process.exit(1);
});

probe.listen(PORT, HOST, () => probe.close(er => {
  if (er) {
    console.error('Aven port kontrolü kapatılamadı:', er);
    process.exit(1);
  }
  require('./server');
}));
