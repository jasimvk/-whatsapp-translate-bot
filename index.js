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