const express = require('express');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID_RAW = process.env.TELEGRAM_CHAT_ID;
// Convert CHAT_ID to number if it's numeric, otherwise keep as string (for usernames like @channel)
const CHAT_ID = isNaN(CHAT_ID_RAW) ? CHAT_ID_RAW : Number(CHAT_ID_RAW);

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// Serve static files from this folder (so you can open the site from same origin)
app.use(express.static(path.join(__dirname)));

app.post('/send-telegram', upload.single('file'), async (req, res) => {
  console.log('📩 /send-telegram request received');
  console.log('Body:', req.body);
  console.log('File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'no file');

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('❌ Missing BOT_TOKEN or CHAT_ID');
    return res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set on server' });
  }

  console.log('✅ BOT_TOKEN and CHAT_ID loaded');
  console.log('CHAT_ID:', CHAT_ID);

  const { format, paper, qty } = req.body || {};
  const { chat_message, chat_name } = req.body || {};
  // If chat_message provided, treat as a simple chat/contact message
  if (chat_message) {
    const safeName = String(chat_name || 'Гість');
    const safeMsg = String(chat_message || 'Порожнє повідомлення');
    const chatText = `Нове повідомлення з сайту:\n- Ім'я: ${safeName}\n- Повідомлення:\n${safeMsg}`;
    try {
      console.log('🔵 Sending chat message to Telegram API...');
      const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: chatText
      });
      console.log('✅ Telegram API response (chat):', response.data);
      return res.json({ ok: true, result: response.data });
    } catch (err) {
      console.error('❌ Telegram API error (chat):', err.message);
      if (err.response && err.response.data) {
        console.error('📋 Telegram error details:', err.response.data);
      }
      return res.status(500).json({ ok: false, error: err.message, details: err.response && err.response.data });
    }
  }
  const safeFormat = String(format || 'Не вказано');
  const safePaper = String(paper || 'Не вказано');
  const safeQty = String(qty || '1');

  const message = `Нове замовлення на друк:\n- Формат: ${safeFormat}\n- Папір: ${safePaper}\n- Кількість: ${safeQty}`;

  try {
    let response;

    // If file is uploaded, send as document
    if (req.file) {
      console.log('🔵 Sending to Telegram API with file...');
      const fileStream = fs.createReadStream(req.file.path);
      const form = new FormData();
      form.append('chat_id', String(CHAT_ID));
      form.append('caption', message);
      form.append('document', fileStream, req.file.originalname);

      response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, form, {
        headers: form.getHeaders()
      });

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
    } else {
      // Send only text message
      console.log('🔵 Sending text message to Telegram API...');
      response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: message
      });
    }

    console.log('✅ Telegram API response:', response.data);
    return res.json({ ok: true, result: response.data });
  } catch (err) {
    console.error('❌ Telegram API error:', err.message);
    if (err.response && err.response.data) {
      console.error('📋 Telegram error details:', err.response.data);
    }
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ ok: false, error: err.message, details: err.response && err.response.data });
  }
});

app.listen(PORT, () => {
  console.log(`Sergeyfix server running on http://localhost:${PORT}`);
});
