import jsPDF from 'jspdf';
import type { Quote, QuoteItem, QuoteSignature } from '@shared/schema';

interface QuoteForPDF {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  projectDescription: string;
  projectAddress: string | null;
  status: string;
  validUntil: Date | string | null;
  builderMargin: string;
  subtotal: string;
  gstAmount: string;
  totalAmount: string;
  notes: string | null;
  createdAt: Date | string | null;
  acceptedAt: Date | string | null;
  items: QuoteItem[];
  signature?: {
    signerName: string;
    signatureData: string;
    signedAt: Date | string;
  } | null;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
  } catch {
    return '';
  }
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

export async function generateQuotePDFBuffer(quote: QuoteForPDF): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginLeft = 25;
  const marginRight = 25;
  const contentWidth = pageWidth - marginLeft - marginRight;
  
  let yPos = 25;

  // === HEADER SECTION ===
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  
  const logoText = 'MJR - BUILDERS';
  const logoWidth = doc.getTextWidth(logoText);
  const logoX = marginLeft;
  doc.text(logoText, logoX, yPos);
  
  // Draw roof graphic
  const roofStartX = logoX + logoWidth + 2;
  const roofEndX = roofStartX + 20;
  const roofPeakX = roofStartX + 10;
  const roofY = yPos - 3;
  doc.setLineWidth(0.8);
  doc.line(roofStartX, roofY, roofPeakX, roofY - 8);
  doc.line(roofPeakX, roofY - 8, roofEndX, roofY);
  
  // Underline for company name
  doc.setLineWidth(0.5);
  doc.line(logoX, yPos + 2, logoX + logoWidth, yPos + 2);
  
  yPos += 15;
  
  // Company details
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const companyDetails = [
    'ABN 36 674 122 866',
    'Telephone: 0459 200 766',
    'T2/3 131 Main rd Moonah 7009',
    'Admin@mjrbuilders.com.au'
  ];
  
  const detailsX = 75;
  companyDetails.forEach((line, index) => {
    doc.text(line, detailsX, yPos + (index * 5), { align: 'left' });
  });
  
  // HIA Member badge
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 100, 0);
  doc.text('HIA', pageWidth - marginRight - 15, yPos);
  doc.setFontSize(6);
  doc.text('Member', pageWidth - marginRight - 18, yPos + 4);
  
  doc.setTextColor(0, 0, 0);
  yPos += 30;
  
  // Separator line
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  yPos += 15;
  
  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const quoteDate = formatDate(quote.createdAt) || formatDate(new Date());
  doc.text(`Date: ${quoteDate}`, marginLeft, yPos);
  yPos += 15;
  
  // Client greeting
  const firstName = quote.clientName.split(' ')[0];
  doc.text(`Dear ${firstName},`, marginLeft, yPos);
  yPos += 15;
  
  // Project reference
  doc.setFont('helvetica', 'bold');
  const projectRef = quote.projectAddress || quote.projectDescription;
  doc.text(`RE: ${projectRef}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 20;
  
  // Scope of works
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  quote.items.forEach((item) => {
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = 30;
    }
    
    doc.text('-', marginLeft, yPos);
    
    const lines = doc.splitTextToSize(item.description, contentWidth - 10);
    lines.forEach((line: string, lineIndex: number) => {
      if (lineIndex > 0 && yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 30;
      }
      doc.text(line, marginLeft + 8, yPos + (lineIndex * 5));
    });
    yPos += Math.max(lines.length * 5, 8) + 4;
  });
  
  yPos += 15;
  
  // Estimate quotation
  if (yPos > pageHeight - 100) {
    doc.addPage();
    yPos = 30;
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  
  const subtotal = parseFloat(quote.subtotal) || 0;
  const total = parseFloat(quote.totalAmount) || 0;
  const gst = parseFloat(quote.gstAmount) || 0;
  
  const formattedTotal = `$${total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  doc.text(`Estimate Quotation of: ${formattedTotal} + GST`, marginLeft, yPos);
  
  yPos += 20;
  
  // Notes
  if (quote.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(`Note: ${quote.notes}`, contentWidth);
    noteLines.forEach((line: string, index: number) => {
      doc.text(line, marginLeft, yPos + (index * 5));
    });
    yPos += noteLines.length * 5 + 10;
  }
  
  // Validity
  if (quote.validUntil) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const validDate = formatDateTime(quote.validUntil);
    if (validDate) {
      doc.text(`This quote is valid until: ${validDate}`, marginLeft, yPos);
      yPos += 15;
    }
  }
  
  // Kind Regards & Signature
  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = 30;
  }
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Kind Regards,', marginLeft, yPos);
  yPos += 25;
  
  // Signature line
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPos, marginLeft + 60, yPos);
  yPos += 8;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Director', marginLeft, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  const directorName = (quote as any).director || 'Will Scott';
  doc.text(directorName, marginLeft, yPos);
  
  // Client acceptance section if signed - positioned in right column for better layout
  if (quote.signature) {
    // Draw a separator line before acceptance section
    yPos += 15;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
    yPos += 15;
    
    // Check if we need a new page for the acceptance section
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = 30;
    }
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENT ACCEPTANCE', marginLeft, yPos);
    yPos += 12;
    
    // Add signature image first for visual prominence
    if (quote.signature.signatureData && quote.signature.signatureData.startsWith('data:image')) {
      try {
        doc.addImage(quote.signature.signatureData, 'PNG', marginLeft, yPos, 70, 25);
        yPos += 30;
      } catch (e) {
        console.error('Failed to add signature image to PDF:', e);
      }
    }
    
    // Signature line under the signature
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, yPos, marginLeft + 70, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Signed by: ${quote.signature.signerName}`, marginLeft, yPos);
    yPos += 6;
    
    const signedDate = formatDateTime(quote.signature.signedAt);
    if (signedDate) {
      doc.text(`Date: ${signedDate}`, marginLeft, yPos);
    }
  }
  
  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  
  doc.text('MJR-Builders Pty Limited   A.C.N 674 122 866', marginLeft, footerY);
  doc.text('Builders License no: cc6163t', pageWidth - marginRight, footerY, { align: 'right' });
  
  doc.setTextColor(0, 0, 0);
  
  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export async function generateQuotePDFBase64(quote: QuoteForPDF): Promise<string> {
  const buffer = await generateQuotePDFBuffer(quote);
  return buffer.toString('base64');
}
