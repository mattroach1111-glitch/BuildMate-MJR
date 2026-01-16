import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { storage } from '../storage';
import { ObjectStorageService } from '../objectStorage';

export async function generateSwmsCompliancePackage(jobId: string): Promise<Buffer | null> {
  const objectStorageService = new ObjectStorageService();
  
  const job = await storage.getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const signatures = await storage.getSwmsSignaturesForJobWithDetails(jobId);
  
  if (signatures.length === 0) {
    return null;
  }

  const signaturesByTemplate = new Map<string, Array<typeof signatures[0]>>();
  for (const sig of signatures) {
    if (sig.template) {
      const existing = signaturesByTemplate.get(sig.templateId) || [];
      existing.push(sig);
      signaturesByTemplate.set(sig.templateId, existing);
    }
  }

  const combinedPdf = await PDFDocument.create();
  const font = await combinedPdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await combinedPdf.embedFont(StandardFonts.HelveticaBold);

  const coverPage = combinedPdf.addPage([595, 842]);
  let yPos = 780;

  coverPage.drawText('SWMS COMPLIANCE PACKAGE', {
    x: 50,
    y: yPos,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.4),
  });
  yPos -= 40;

  coverPage.drawText(`Job: ${job.jobAddress}`, { x: 50, y: yPos, size: 12, font: boldFont });
  yPos -= 20;
  coverPage.drawText(`Client: ${job.clientName}`, { x: 50, y: yPos, size: 10, font });
  yPos -= 15;
  coverPage.drawText(`Project Manager: ${job.projectName}`, { x: 50, y: yPos, size: 10, font });
  yPos -= 15;
  coverPage.drawText(`Generated: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, { x: 50, y: yPos, size: 10, font });
  yPos -= 40;

  coverPage.drawText('SIGNATURE RECORDS', { x: 50, y: yPos, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.4) });
  yPos -= 25;

  coverPage.drawText('This document contains the following Safe Work Method Statements with digital signature proof:', { x: 50, y: yPos, size: 10, font });
  yPos -= 30;

  for (const [templateId, templateSigs] of Array.from(signaturesByTemplate)) {
    const template = templateSigs[0].template;
    if (!template) continue;

    coverPage.drawText(`• ${template.title}`, { x: 60, y: yPos, size: 11, font: boldFont });
    yPos -= 18;

    for (const sig of templateSigs) {
      const signedDate = sig.signedAt ? new Date(sig.signedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown';
      coverPage.drawText(`   - ${sig.signerName} (${sig.occupation}) - Signed: ${signedDate}`, { x: 70, y: yPos, size: 9, font });
      yPos -= 15;
    }
    yPos -= 10;

    if (yPos < 100) {
      const newPage = combinedPdf.addPage([595, 842]);
      yPos = 780;
    }
  }

  for (const [templateId, templateSigs] of Array.from(signaturesByTemplate)) {
    const template = templateSigs[0].template;
    if (!template || !template.objectPath) continue;

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(template.objectPath);
      const [buffer] = await objectFile.download();
      
      const swmsPdf = await PDFDocument.load(buffer);
      const copiedPages = await combinedPdf.copyPages(swmsPdf, swmsPdf.getPageIndices());
      for (const page of copiedPages) {
        combinedPdf.addPage(page);
      }

      const sigPage = combinedPdf.addPage([595, 842]);
      let sigYPos = 780;

      sigPage.drawText('SWMS SIGNATURE EVIDENCE', {
        x: 50,
        y: sigYPos,
        size: 16,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.4),
      });
      sigYPos -= 30;

      sigPage.drawText(`Document: ${template.title}`, { x: 50, y: sigYPos, size: 12, font: boldFont });
      sigYPos -= 20;
      sigPage.drawText(`Job: ${job.jobAddress}`, { x: 50, y: sigYPos, size: 10, font });
      sigYPos -= 40;

      sigPage.drawText('Digital Signatures:', { x: 50, y: sigYPos, size: 12, font: boldFont });
      sigYPos -= 25;

      sigPage.drawText('Name', { x: 60, y: sigYPos, size: 10, font: boldFont });
      sigPage.drawText('Occupation', { x: 200, y: sigYPos, size: 10, font: boldFont });
      sigPage.drawText('Date Signed', { x: 350, y: sigYPos, size: 10, font: boldFont });
      sigYPos -= 5;
      sigPage.drawLine({ start: { x: 50, y: sigYPos }, end: { x: 545, y: sigYPos }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
      sigYPos -= 18;

      for (const sig of templateSigs) {
        const signedDate = sig.signedAt ? new Date(sig.signedAt).toLocaleDateString('en-AU', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Unknown';
        
        sigPage.drawText(sig.signerName, { x: 60, y: sigYPos, size: 10, font });
        sigPage.drawText(sig.occupation, { x: 200, y: sigYPos, size: 10, font });
        sigPage.drawText(signedDate, { x: 350, y: sigYPos, size: 10, font });
        sigYPos -= 18;
      }

      sigYPos -= 30;
      sigPage.drawText('Certification:', { x: 50, y: sigYPos, size: 10, font: boldFont });
      sigYPos -= 18;
      sigPage.drawText('The above individuals have digitally signed this SWMS document, acknowledging that they have:', { x: 50, y: sigYPos, size: 9, font });
      sigYPos -= 15;
      sigPage.drawText('• Read and understood the safe work procedures outlined in this document', { x: 60, y: sigYPos, size: 9, font });
      sigYPos -= 15;
      sigPage.drawText('• Been instructed in the work activities and controls to be adopted', { x: 60, y: sigYPos, size: 9, font });
      sigYPos -= 15;
      sigPage.drawText('• Agreed to follow the safety procedures when performing work on this job', { x: 60, y: sigYPos, size: 9, font });

    } catch (pdfError) {
      console.error(`Error loading SWMS PDF for template ${templateId}:`, pdfError);
      const errorPage = combinedPdf.addPage([595, 842]);
      errorPage.drawText(`Unable to load SWMS document: ${template.title}`, {
        x: 50,
        y: 780,
        size: 12,
        font: boldFont,
        color: rgb(0.8, 0.2, 0.2),
      });
    }
  }

  const pdfBytes = await combinedPdf.save();
  return Buffer.from(pdfBytes);
}
