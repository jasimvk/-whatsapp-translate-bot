const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: true }));

const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;  // Replace with your Google API key
console.log(GOOGLE_API_KEY);


app.post('/whatsapp', async (req, res) => {
    const incomingMsg = req.body.Body.trim();
    console.log('Received message:', incomingMsg);

    try {
        const response = await axios.post(GOOGLE_TRANSLATE_API_URL, null, {
            params: {
                q: incomingMsg,
                target: 'ml',
                key: GOOGLE_API_KEY
            }
        });

        const translatedText = response.data.data.translations[0].translatedText;
        console.log('Translated text:', translatedText);

        const twiml = new MessagingResponse();
        twiml.message(translatedText);

        res.set('Content-Type', 'text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error translating text:', error);

        const twiml = new MessagingResponse();
        twiml.message('Sorry, I couldn\'t process this message.');

        res.set('Content-Type', 'text/xml');
        res.send(twiml.toString());
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});