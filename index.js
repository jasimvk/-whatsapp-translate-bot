const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');

const app = express();
app.use(express.urlencoded({ extended: true }));

const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;  // Replace with your Google API key

app.post('/whatsapp', async (req, res) => {
    const incomingMsg = req.body.Body.trim();

    // Translate the message from English to Malayalam
    try {
        const response = await axios.post(GOOGLE_TRANSLATE_API_URL, null, {
            params: {
                q: incomingMsg,
                source: 'en',
                target: 'ml',
                key: GOOGLE_API_KEY
            }
        });
        const translatedText = response.data.data.translations[0].translatedText;

        const twiml = new MessagingResponse();
        twiml.message(translatedText);

        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());
    } catch (error) {
        console.error('Translation error:', error);
        const twiml = new MessagingResponse();
        twiml.message('Sorry, I couldn\'t process this message.');

        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());
    }
});

// Listen on port 3000
app.listen(3000, () => {
    console.log('Server is listening on port 3000');
});
