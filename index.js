const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const axios = require('axios');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
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

// Tesseract test
console.log('Running Tesseract test...');
Tesseract.recognize('https://tesseract.projectnaptha.com/img/eng_bw.png', 'eng', { logger: m => console.log('Tesseract test:', m) })
  .then(({ data: { text } }) => {
    console.log('Tesseract test result:', text);
  })
  .catch(error => {
    console.error('Tesseract test failed:', error);
  });

app.post('/whatsapp', async (req, res) => {
    console.log('Received request:', req.body);
    const incomingMsg = req.body.Body ? req.body.Body.trim() : '';
    const mediaUrl = req.body.MediaUrl0;
    const fromNumber = req.body.From;
    console.log('Received message:', incomingMsg, 'from:', fromNumber);
    console.log('Media URL:', mediaUrl);

    const twiml = new MessagingResponse();

    if (!userStates[fromNumber]) {
        userStates[fromNumber] = { step: 'translate' };
    }   

    try {
        if (mediaUrl) {
            console.log('Processing image...');
            twiml.message('Processing your image. This may take a moment...');
            
            const extractedText = await extractTextFromImage(mediaUrl);
            console.log('Extracted text:', extractedText);
            
            if (extractedText) {
                const translatedText = await translateText(extractedText, 'ml');
                console.log('Translated text:', translatedText);
                twiml.message(`Extracted and translated text:\n${translatedText}`);
                twiml.message('Choose another language:\n1. English\n2. Arabic\n3. Hindi\n\nOr send any message to translate to Malayalam again.');
                userStates[fromNumber].step = 'choose_language';
                userStates[fromNumber].originalText = extractedText;
            } else {
                twiml.message('Unable to extract text from the image. Please make sure the image contains clear, readable text and try again.');
            }
        } else if (userStates[fromNumber].step === 'translate') {
            const translatedText = await translateText(incomingMsg, 'ml');
            console.log('Translated text (Malayalam):', translatedText);

            twiml.message(translatedText);
            twiml.message('Choose another language:\n1. English\n2. Arabic\n3. Hindi\n\nOr send any message to translate to Malayalam again.');
            
            userStates[fromNumber].step = 'choose_language';
            userStates[fromNumber].originalText = incomingMsg;
        } else if (userStates[fromNumber].step === 'choose_language') {
            if (languageOptions[incomingMsg]) {
                const translatedText = await translateText(userStates[fromNumber].originalText, languageOptions[incomingMsg]);
                console.log(`Translated text (${languageOptions[incomingMsg]}):`, translatedText);

                twiml.message(translatedText);
                twiml.message('Send a new message to translate to Malayalam.');
            } else {
                twiml.message('Invalid option. Send any message to translate to Malayalam.');
            }
            userStates[fromNumber].step = 'translate';
        }

        res.set('Content-Type', 'text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error processing message:', error);
        if (error.message.includes('network')) {
            twiml.message('Sorry, there was a network error. Please try again later.');
        } else if (error.message.includes('Tesseract') || error.message.includes('OCR')) {
            twiml.message('Sorry, there was an error processing the image. Please try a different image or send text instead.');
        } else {
            twiml.message('Sorry, I encountered an error while processing your message. Please try again.');
        }
        res.set('Content-Type', 'text/xml');
        res.send(twiml.toString());
    }
});

async function downloadImage(url) {
    try {
        console.log('Downloading image from URL:', url);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer'
        });
        const buffer = Buffer.from(response.data, 'binary');
        const tempPath = path.join(__dirname, 'temp_image.jpg');
        fs.writeFileSync(tempPath, buffer);
        console.log('Image downloaded successfully to:', tempPath);
        return tempPath;
    } catch (error) {
        console.error('Error downloading image:', error.message);
        throw error;
    }
}

function getImageFormat(imagePath) {
    const ext = path.extname(imagePath).toLowerCase();
    return ext === '.png' ? 'png' :
           ext === '.jpg' || ext === '.jpeg' ? 'jpg' :
           ext === '.gif' ? 'gif' :
           ext === '.bmp' ? 'bmp' :
           'unknown';
}

async function extractTextFromImage(imageUrl) {
    let imagePath;
    try {
        console.log('Downloading image from URL:', imageUrl);
        imagePath = await downloadImage(imageUrl);
        console.log('Image downloaded. File size:', fs.statSync(imagePath).size, 'bytes');
        const format = getImageFormat(imagePath);
        console.log('Image format:', format);
        if (format === 'unknown') {
            throw new Error('Unsupported image format');
        }
        console.log('Starting OCR process...');
        const { data: { text } } = await Promise.race([
            Tesseract.recognize(imagePath, 'eng', {
                logger: m => console.log('Tesseract progress:', m)
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OCR timeout')), 30000))
        ]);
        console.log('OCR process completed.');
        
        if (!text || text.trim().length === 0) {
            throw new Error('No text found in the image');
        }
        
        return text.trim();
    } catch (error) {
        console.error('Error extracting text from image:', error);
        throw error; // Rethrow the error to be caught in the main function
    } finally {
        if (imagePath) {
            fs.unlinkSync(imagePath);  // Delete the temporary image file
            console.log('Temporary image file deleted');
        }
    }
}

async function translateText(text, targetLanguage) {
    try {
        console.log(`Translating text to ${targetLanguage}:`, text);
        const response = await axios.post(GOOGLE_TRANSLATE_API_URL, null, {
            params: {
                q: text,
                target: targetLanguage,
                key: GOOGLE_API_KEY
            }
        });
        console.log('Translation successful');
        return response.data.data.translations[0].translatedText;
    } catch (error) {
        console.error('Error translating text:', error);
        throw error;
    }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log('Environment variables loaded:', {
        GOOGLE_API_KEY: GOOGLE_API_KEY ? 'Set' : 'Not set',
        PORT: process.env.PORT || '(using default 3000)'
    });
});