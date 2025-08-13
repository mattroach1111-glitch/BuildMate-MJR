import { pdf2pic } from 'pdf2pic';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Converts a PDF buffer to a JPEG image buffer
 * @param pdfBuffer - The PDF file as a Buffer
 * @returns Promise<Buffer> - The converted image as a Buffer
 */
export async function convertPdfToImage(pdfBuffer: Buffer): Promise<Buffer> {
  const tempDir = '/tmp';
  const tempPdfPath = path.join(tempDir, `temp-${randomUUID()}.pdf`);
  
  try {
    // Write PDF buffer to temporary file
    await fs.writeFile(tempPdfPath, pdfBuffer);
    
    // Configure pdf2pic for conversion
    const convert = pdf2pic.fromPath(tempPdfPath, {
      density: 150,           // DPI
      saveFilename: "converted",
      savePath: tempDir,
      format: "jpg",
      width: 1200,           // Max width
      height: 1600,          // Max height
      quality: 75            // JPEG quality
    });
    
    // Convert first page to image
    const result = await convert(1); // Convert page 1
    
    if (!result.path) {
      throw new Error('PDF conversion failed - no output path');
    }
    
    // Read the converted image
    const imageBuffer = await fs.readFile(result.path);
    
    // Clean up temporary files
    try {
      await fs.unlink(tempPdfPath);
      await fs.unlink(result.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temporary files:', cleanupError);
    }
    
    return imageBuffer;
    
  } catch (error) {
    // Clean up temporary PDF file if it exists
    try {
      await fs.unlink(tempPdfPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    console.error('PDF conversion error:', error);
    throw new Error(`Failed to convert PDF to image: ${error.message}`);
  }
}