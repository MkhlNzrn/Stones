require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PHOTOS_DIR = path.join(__dirname, 'photos');
const STONES_DIR = path.join(__dirname, 'stones');
const ITEMS_DIR = path.join(__dirname, 'items');
const EMAIL_TO = 'izdeliya.iz.kamnya.spb@gmail.com';

const IMG_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
function isImage(filename) {
  return IMG_EXT.includes(path.extname(filename).toLowerCase());
}

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
    return files.filter((f) => isImage(f));
  } catch {
    return [];
  }
}

function getFirstImageInDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return null;
    const files = fs.readdirSync(dirPath);
    const img = files.find((f) => isImage(f));
    return img || null;
  } catch {
    return null;
  }
}

function getStones() {
  try {
    if (!fs.existsSync(STONES_DIR)) return [];
    const subdirs = fs.readdirSync(STONES_DIR, { withFileTypes: true });
    return subdirs
      .filter((d) => d.isDirectory())
      .map((d) => {
        const first = getFirstImageInDir(path.join(STONES_DIR, d.name));
        return { name: d.name, image: first ? d.name + '/' + first : null };
      })
      .filter((s) => s.image);
  } catch {
    return [];
  }
}

function getItems() {
  try {
    if (!fs.existsSync(ITEMS_DIR)) return [];
    const subdirs = fs.readdirSync(ITEMS_DIR, { withFileTypes: true });
    return subdirs
      .filter((d) => d.isDirectory())
      .map((d) => {
        const first = getFirstImageInDir(path.join(ITEMS_DIR, d.name));
        return { name: d.name, image: first ? d.name + '/' + first : null };
      })
      .filter((s) => s.image);
  } catch {
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // API: list photos (catalog)
  if (pathname === '/api/works') {
    const files = getPhotoFiles();
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(files));
    return;
  }

  // API: list stones (name + first image path per folder)
  if (pathname === '/api/stones') {
    const list = getStones();
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(list));
    return;
  }

  // API: list items (name + first image path per folder)
  if (pathname === '/api/items') {
    const list = getItems();
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(list));
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

  // Static: /stones/* -> files from stones dir (e.g. /stones/мрамор/photo.jpg)
  if (pathname.startsWith('/stones/')) {
    const rel = pathname.slice('/stones/'.length);
    if (!rel || rel.includes('..')) {
      send(res, 403, 'Forbidden');
      return;
    }
    const filePath = path.join(STONES_DIR, decodeURIComponent(rel));
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

  // Static: /items/* -> files from items dir
  if (pathname.startsWith('/items/')) {
    const rel = pathname.slice('/items/'.length);
    if (!rel || rel.includes('..')) {
      send(res, 403, 'Forbidden');
      return;
    }
    const filePath = path.join(ITEMS_DIR, decodeURIComponent(rel));
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
