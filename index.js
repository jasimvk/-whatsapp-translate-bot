const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: true }));

const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;  // Replace with your Google API key

const languageOptions = {
    '1': 'en',  // English
    '2': 'ar',  // Arabic
    '3': 'hi',  // Hindi
 
};

const userStates = {};

app.post('/whatsapp', async (req, res) => {
    console.log('Received request:', req.body);
    const incomingMsg = req.body.Body.trim();
    const fromNumber = req.body.From;
    console.log('Received message:', incomingMsg, 'from:', fromNumber);

    const twiml = new MessagingResponse();

    if (!userStates[fromNumber]) {
        userStates[fromNumber] = { step: 'translate' };
    }

    try {
        if (userStates[fromNumber].step === 'translate') {
            const response = await axios.post(GOOGLE_TRANSLATE_API_URL, null, {
                params: {
                    q: incomingMsg,
                    target: 'ml',
                    key: GOOGLE_API_KEY
                }
            });
            console.log('Response:', response.data);

            const translatedText = response.data.data.translations[0].translatedText;
            console.log('Translated text:', translatedText);

            // First message: Translation
            twiml.message(translatedText);

            // Second message: Language options
            twiml.message('Choose another language:\n1. English\n2. Arabic\n3. Hindi\n\nOr send any message to translate to Malayalam again.');
            
            userStates[fromNumber].step = 'choose_language';
            userStates[fromNumber].originalText = incomingMsg;
        } else if (userStates[fromNumber].step === 'choose_language') {
            if (languageOptions[incomingMsg]) {
                const response = await axios.post(GOOGLE_TRANSLATE_API_URL, null, {
                    params: {
                        q: userStates[fromNumber].originalText,
                        target: languageOptions[incomingMsg],
                        key: GOOGLE_API_KEY
                    }
                });
                console.log('Response:', response.data);

                const translatedText = response.data.data.translations[0].translatedText;
                console.log('Translated text:', translatedText);

                // First message: Translation
                twiml.message(translatedText);

                // Second message: Instruction
                twiml.message('Send any message to translate to Malayalam.');
            } else {
                twiml.message('Invalid option. Send any message to translate to Malayalam.');
            }
            userStates[fromNumber].step = 'translate';
        }

        res.set('Content-Type', 'text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error translating text:', error);

        twiml.message('Sorry, I couldn\'t process this message.');

        res.set('Content-Type', 'text/xml');
        res.send(twiml.toString());
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});