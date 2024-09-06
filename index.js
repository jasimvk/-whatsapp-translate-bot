const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: true }));

const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const defaultLanguage = 'ml';  // Malayalam

// Function to translate text
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

app.post('/whatsapp', async (req, res) => {
    const incomingMsg = req.body.Body.trim();
    const languageOptions = {
        '1': 'hi', // Hindi
        '2': 'es', // Spanish
        '3': 'fr', // French
        '4': 'ar'  // Arabic
    };

    try {
        if (req.session && req.session.lastMessage && languageOptions[incomingMsg]) {
            // Translate to the selected language
            const originalMessage = req.session.lastMessage;
            const targetLanguage = languageOptions[incomingMsg];
            const translatedText = await translateText(originalMessage, targetLanguage);

            const twiml = new MessagingResponse();
            twiml.message(translatedText);
            res.set('Content-Type', 'text/xml');
            res.send(twiml.toString());

            // Clear the session
            req.session.lastMessage = null;
        } else {
            // Translate to Malayalam by default
            const translatedText = await translateText(incomingMsg, defaultLanguage);

            // Store the original message in session
            req.session = { lastMessage: incomingMsg };

            const twiml = new MessagingResponse();
            twiml.message(translatedText);

            // Provide language options for further translation
            const optionsMessage = `Choose a language to translate to:\n1. Hindi (hi)\n2. Spanish (es)\n3. French (fr)\n4. Arabic (ar)\nReply with the number or code.`;
            twiml.message(optionsMessage);

            res.set('Content-Type', 'text/xml');
            res.send(twiml.toString());
        }
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
