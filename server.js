// server.js

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const path = require('path');

const app = express();
const port = 3000;

// Set up file upload middleware
// Files will be temporarily stored in the 'uploads/' directory
const upload = multer({ dest: 'uploads/' });

// Serve the HTML file from the current directory
app.use(express.static(path.join(__dirname, '')));

/**
 * Core function to merge an array of PDF files.
 * @param {string[]} pdfFilePaths - Array of paths to the uploaded PDF files.
 * @returns {Promise<Buffer>} - The merged PDF document as a Buffer.
 */
async function mergePdfs(pdfFilePaths) {
    const mergedDoc = await PDFDocument.create();

    for (const filePath of pdfFilePaths) {
        // 1. Read the PDF file into a buffer
        const pdfBytes = fs.readFileSync(filePath);
        
        // 2. Load the PDF from its bytes
        const externalPdfDoc = await PDFDocument.load(pdfBytes);

        // 3. Copy all pages from the external PDF into the new merged document
        const copiedPages = await mergedDoc.copyPages(
            externalPdfDoc,
            externalPdfDoc.getPageIndices()
        );

        // 4. Add the copied pages to the merged document
        copiedPages.forEach(page => mergedDoc.addPage(page));
    }

    // 5. Save the merged document to a buffer
    const pdfBuffer = await mergedDoc.save();
    return Buffer.from(pdfBuffer);
}


// --- API Endpoint for Merging ---
app.post('/api/merge', upload.array('pdfFiles', 10), async (req, res) => {
    console.log('Merge request received.');
    
    // Ensure files were uploaded and there are at least two
    if (!req.files || req.files.length < 2) {
        return res.status(400).send({ message: 'Please upload at least two PDF files.' });
    }

    const filePaths = req.files.map(file => file.path);

    try {
        const outputBuffer = await mergePdfs(filePaths);

        // Set headers for file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="iLovePDF_merged.pdf"');
        res.send(outputBuffer);

    } catch (error) {
        console.error('PDF Processing Error:', error);
        res.status(500).send({ message: 'An error occurred during PDF merging.' });
    } finally {
        // Clean up temporary files regardless of success or failure
        filePaths.forEach(p => {
            try {
                fs.unlinkSync(p);
            } catch (cleanupError) {
                console.error(`Failed to clean up file ${p}:`, cleanupError.message);
            }
        });
        // Also clean up the 'uploads' directory if it's empty in a real application
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Open your browser to http://localhost:${port}/index.html`);
});