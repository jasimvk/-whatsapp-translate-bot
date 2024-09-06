const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;

async function performOCR(imagePath) {
  const worker = await createWorker('ara');
  const { data: { text } } = await worker.recognize(imagePath);
  await worker.terminate();
  return text;
}

async function translateText(text, targetLanguage) {
  const response = await axios.post(GOOGLE_TRANSLATE_API_URL, null, {
    params: {
      q: text,
      target: targetLanguage,
      key: GOOGLE_API_KEY
    }
  });
  return response.data.data.translations[0].translatedText;
}

app.post('/whatsapp', upload.single('MediaUrl0'), async (req, res) => {
  const twiml = new MessagingResponse();

  try {
    if (req.file) {
      // Image processing
      const imageText = await performOCR(req.file.path);
      console.log('Extracted text:', imageText);

      if (imageText.trim()) {
        const translatedText = await translateText(imageText, 'ml');
        console.log('Translated text:', translatedText);

        twiml.message('Extracted and translated text:');
        twiml.message(translatedText);
      } else {
        twiml.message('No text could be extracted from the image.');
      }
    } else {
      // Text processing (existing functionality)
      const incomingMsg = req.body.Body.trim();
      const translatedText = await translateText(incomingMsg, 'ml');
      twiml.message(translatedText);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    twiml.message('Sorry, I couldn\'t process this message or image.');
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});