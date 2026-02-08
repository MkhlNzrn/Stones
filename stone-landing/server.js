require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PHOTOS_DIR = path.join(__dirname, 'photos');
const EMAIL_TO = 'izdeliya.iz.kamnya.spb@gmail.com';

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

function send(res, code, body, contentType) {
  contentType = contentType || 'application/json';
  res.writeHead(code, { 'Content-Type': contentType });
  res.end(body);
}

function getPhotoFiles() {
  try {
    if (!fs.existsSync(PHOTOS_DIR)) return [];
    const files = fs.readdirSync(PHOTOS_DIR);
    return files.filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });
  } catch {
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // API: list photos
  if (pathname === '/api/works') {
    const files = getPhotoFiles();
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(files));
    return;
  }

  // API: submit order (send email)
  if (pathname === '/api/order' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const data = JSON.parse(body);
      const { firstName, lastName, phone, description } = data;
      const text = [
        'Новая заявка с сайта',
        '',
        'Имя: ' + (firstName || '—'),
        'Фамилия: ' + (lastName || '—'),
        'Телефон: ' + (phone || '—'),
        'Описание заказа:',
        description || '—'
      ].join('\n');

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        send(res, 500, JSON.stringify({ error: 'Email not configured' }));
        return;
      }

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: EMAIL_TO,
        subject: 'Заявка с сайта: ' + (firstName || '') + ' ' + (lastName || ''),
        text
      });

      send(res, 200, JSON.stringify({ ok: true }));
    } catch (err) {
      console.error(err);
      send(res, 500, JSON.stringify({ error: 'Send failed' }));
    }
    return;
  }

  // Static: /photos/* -> files from photos dir
  if (pathname.startsWith('/photos/')) {
    const name = pathname.slice('/photos/'.length);
    if (name.includes('..')) {
      send(res, 403, 'Forbidden');
      return;
    }
    const filePath = path.join(PHOTOS_DIR, decodeURIComponent(name));
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      send(res, 404, 'Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Static: root files
  const filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname.slice(1));
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, 'Not Found', 'text/plain');
    return;
  }
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log('Сайт: http://localhost:' + PORT);
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Форма заявки не будет отправлять письма: задайте SMTP_USER и SMTP_PASS в .env');
  }
});
