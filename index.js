const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');
const Tesseract = require('tesseract.js');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: true }));

const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;

const languageOptions = {
    '1': 'en',  // English
    '2': 'ar',  // Arabic
    '3': 'hi',  // Hindi
};

const userStates = {};

app.post('/whatsapp', async (req, res) => {
    console.log('Received request:', req.body);
    const incomingMsg = req.body.Body ? req.body.Body.trim() : '';
    const mediaUrl = req.body.MediaUrl0;
    const fromNumber = req.body.From;
    console.log('Received message:', incomingMsg, 'from:', fromNumber);

    const twiml = new MessagingResponse();

    if (!userStates[fromNumber]) {
        userStates[fromNumber] = { step: 'translate' };
    }

    try {
        if (mediaUrl) {
            // Handle image translation
            const extractedText = await extractTextFromImage(mediaUrl);
            if (extractedText) {
                const translatedText = await translateText(extractedText, 'ml');
                twiml.message(`Extracted and translated text:\n${translatedText}`);
                twiml.message('Choose another language:\n1. English\n2. Arabic\n3. Hindi\n\nOr send any message to translate to Malayalam again.');
                userStates[fromNumber].step = 'choose_language';
                userStates[fromNumber].originalText = extractedText;
            } else {
                twiml.message('No text found in the image.');
            }
        } else if (userStates[fromNumber].step === 'translate') {
            const translatedText = await translateText(incomingMsg, 'ml');
            console.log('Translated text (Malayalam):', translatedText);

            // First message: Malayalam translation
            twiml.message(translatedText);

            // Second message: Language options
            twiml.message('Choose another language:\n1. English\n2. Arabic\n3. Hindi\n\nOr send any message to translate to Malayalam again.');
            
            userStates[fromNumber].step = 'choose_language';
            userStates[fromNumber].originalText = incomingMsg;
        } else if (userStates[fromNumber].step === 'choose_language') {
            if (languageOptions[incomingMsg]) {
                const translatedText = await translateText(userStates[fromNumber].originalText, languageOptions[incomingMsg]);
                console.log(`Translated text (${languageOptions[incomingMsg]}):`, translatedText);

                // First message: Translation in chosen language
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
        console.error('Error processing message:', error);
        twiml.message('Sorry, I couldn\'t process this message.');
        res.set('Content-Type', 'text/xml');
        res.send(twiml.toString());
    }
});

async function extractTextFromImage(imageUrl) {
    try {
        const { data: { text } } = await Tesseract.recognize(imageUrl, 'eng');
        return text.trim();
    } catch (error) {
        console.error('Error extracting text from image:', error);
        return null;
    }
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});