import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export async function convertPdfToImage(pdfBuffer: Buffer): Promise<Buffer> {
  const tempPdfPath = join(tmpdir(), `pdf_${Date.now()}.pdf`);
  const tempImagePath = join(tmpdir(), `image_${Date.now()}.jpg`);

  try {
    // Write PDF buffer to temporary file
    await writeFile(tempPdfPath, pdfBuffer);

    // Convert ALL pages of PDF to a single vertical image using ImageMagick
    return new Promise((resolve, reject) => {
      const convert = spawn('convert', [
        '-density', '150',
        tempPdfPath, // Convert ALL pages (removed [0])
        '-append', // Vertically append all pages
        '-quality', '90',
        '-background', 'white',
        '-alpha', 'remove',
        tempImagePath
      ]);

      convert.on('close', async (code) => {
        try {
          if (code !== 0) {
            reject(new Error(`ImageMagick conversion failed with code ${code}`));
            return;
          }

          // Read the converted image
          const { readFile } = await import('fs/promises');
          const imageBuffer = await readFile(tempImagePath);
          
          // Clean up temporary files
          await unlink(tempPdfPath).catch(() => {});
          await unlink(tempImagePath).catch(() => {});
          
          resolve(imageBuffer);
        } catch (error) {
          reject(error);
        }
      });

      convert.on('error', (error) => {
        reject(new Error(`ImageMagick process error: ${error.message}`));
      });
    });

  } catch (error) {
    // Clean up on error
    await unlink(tempPdfPath).catch(() => {});
    await unlink(tempImagePath).catch(() => {});
    throw error;
  }
}