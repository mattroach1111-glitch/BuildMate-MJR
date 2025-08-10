import jsPDF from 'jspdf';

type JobWithRelations = {
  id: string;
  jobAddress: string;
  clientName: string;
  projectName: string;
  status: string;
  builderMargin: string;
  defaultHourlyRate: string;
  laborEntries: Array<{
    id: string;
    hourlyRate: string;
    hoursLogged: string;
    staff?: {
      name: string;
    };
  }>;
  materials: Array<{
    id: string;
    description: string;
    supplier: string;
    amount: string;
    invoiceDate: string | null;
  }>;
  subTrades: Array<{
    id: string;
    trade: string;
    contractor: string;
    amount: string;
    invoiceDate: string | null;
  }>;
  otherCosts: Array<{
    id: string;
    description: string;
    amount: string;
  }>;
};

export async function generateJobPDF(job: JobWithRelations) {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const marginBottom = 20;
  
  // Function to check if we need a new page
  const checkPageBreak = (requiredSpace: number = 20) => {
    if (yPos + requiredSpace > pageHeight - marginBottom) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };
  
  // Header - centered like Excel
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB COST SHEET', 105, 20, { align: 'center' });
  
  // Job details - top left
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Job: ${job.jobAddress}`, 20, 35);
  doc.text(`Client: ${job.clientName}`, 20, 42);
  doc.text(`Project Manager: ${job.projectName}`, 20, 49);
  doc.text(`Status: ${job.status.replace(/_/g, ' ').toUpperCase()}`, 20, 56);
  doc.text(`Date: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`, 150, 35);

  let yPos = 75;

  // LABOR SECTION - Excel style table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('LABOR', 20, yPos);
  yPos += 8;

  // Table headers
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Name', 25, yPos);
  doc.text('Hourly Rate', 80, yPos);
  doc.text('Hours', 130, yPos);
  doc.text('Total', 160, yPos);
  yPos += 3;
  
  // Header underline
  doc.line(20, yPos, 190, yPos);
  yPos += 8;

  // Labor entries
  doc.setFont('helvetica', 'normal');
  let laborTotal = 0;
  job.laborEntries.forEach((entry) => {
    checkPageBreak(10);
    
    const employeeName = entry.staff?.name || 'Unknown Staff';
    const rate = parseFloat(entry.hourlyRate);
    const hours = parseFloat(entry.hoursLogged);
    const entryTotal = rate * hours;
    laborTotal += entryTotal;

    doc.text(employeeName, 25, yPos);
    doc.text(`$${rate.toFixed(2)}`, 80, yPos);
    doc.text(hours.toFixed(1), 130, yPos);
    doc.text(`$${entryTotal.toFixed(2)}`, 160, yPos);
    yPos += 8;
  });

  // Labor total
  yPos += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('Total', 120, yPos);
  doc.text(`$${laborTotal.toFixed(2)}`, 160, yPos);
  yPos += 20;

  // MATERIALS SECTION
  if (job.materials.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.text('MATERIALS', 20, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.text('Description', 25, yPos);
    doc.text('Supplier', 100, yPos);
    doc.text('Date', 130, yPos);
    doc.text('Amount', 160, yPos);
    yPos += 3;
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    let materialsTotal = 0;
    job.materials.forEach((material) => {
      checkPageBreak(10);
      
      const amount = parseFloat(material.amount);
      materialsTotal += amount;
      
      doc.text(material.description || 'Material Item', 25, yPos);
      doc.text(material.supplier || '-', 100, yPos);
      doc.text(material.invoiceDate || '-', 130, yPos);
      doc.text(`$${amount.toFixed(2)}`, 160, yPos);
      yPos += 8;
    });

    yPos += 3;
    doc.setFont('helvetica', 'bold');
    doc.text('Total', 120, yPos);
    doc.text(`$${materialsTotal.toFixed(2)}`, 160, yPos);
    yPos += 20;
  }

  // SUB TRADES SECTION
  if (job.subTrades.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.text('SUB TRADES', 20, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.text('Trade', 25, yPos);
    doc.text('Contractor', 80, yPos);
    doc.text('Date', 130, yPos);
    doc.text('Amount', 160, yPos);
    yPos += 3;
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    let subTradesTotal = 0;
    job.subTrades.forEach((subTrade) => {
      checkPageBreak(10);
      
      const amount = parseFloat(subTrade.amount);
      subTradesTotal += amount;
      
      doc.text(subTrade.trade || 'Sub Trade', 25, yPos);
      doc.text(subTrade.contractor || '-', 80, yPos);
      doc.text(subTrade.invoiceDate || '-', 130, yPos);
      doc.text(`$${amount.toFixed(2)}`, 160, yPos);
      yPos += 8;
    });

    yPos += 3;
    doc.setFont('helvetica', 'bold');
    doc.text('Total', 120, yPos);
    doc.text(`$${subTradesTotal.toFixed(2)}`, 160, yPos);
    yPos += 20;
  }

  // OTHER COSTS SECTION
  if (job.otherCosts.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.text('OTHER COSTS', 20, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.text('Description', 25, yPos);
    doc.text('Amount', 160, yPos);
    yPos += 3;
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    job.otherCosts.forEach((cost) => {
      checkPageBreak(10);
      
      const amount = parseFloat(cost.amount);
      
      doc.text(cost.description, 25, yPos);
      doc.text(`$${amount.toFixed(2)}`, 160, yPos);
      yPos += 8;
    });
    yPos += 10;
  }

  // SUMMARY SECTION - Enhanced with detailed breakdown
  checkPageBreak(100); // Ensure summary stays together
  yPos += 20;
  doc.line(20, yPos, 190, yPos);
  yPos += 15;

  // Calculate all totals
  const materialsTotal = job.materials.reduce((sum, material) => sum + parseFloat(material.amount), 0);
  const subTradesTotal = job.subTrades.reduce((sum, subTrade) => sum + parseFloat(subTrade.amount), 0);
  const otherCostsTotal = job.otherCosts.reduce((sum, cost) => sum + parseFloat(cost.amount), 0);
  const subtotal = laborTotal + materialsTotal + subTradesTotal + otherCostsTotal;
  
  const marginPercent = parseFloat(job.builderMargin) / 100;
  const marginAmount = subtotal * marginPercent;
  const subtotalWithMargin = subtotal + marginAmount;
  const gstAmount = subtotalWithMargin * 0.10;
  const finalTotal = subtotalWithMargin + gstAmount;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB COST SUMMARY', 20, yPos);
  yPos += 15;

  // Individual subtotals
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text('Labour Total:', 25, yPos);
  doc.text(`$${laborTotal.toFixed(2)}`, 160, yPos, { align: 'right' });
  yPos += 8;
  
  doc.text('Materials Total:', 25, yPos);
  doc.text(`$${materialsTotal.toFixed(2)}`, 160, yPos, { align: 'right' });
  yPos += 8;
  
  doc.text('Sub Trades Total:', 25, yPos);
  doc.text(`$${subTradesTotal.toFixed(2)}`, 160, yPos, { align: 'right' });
  yPos += 8;
  
  if (otherCostsTotal > 0) {
    doc.text('Other Costs Total:', 25, yPos);
    doc.text(`$${otherCostsTotal.toFixed(2)}`, 160, yPos, { align: 'right' });
    yPos += 8;
  }
  
  // Subtotal line
  yPos += 5;
  doc.line(25, yPos, 190, yPos);
  yPos += 10;
  
  doc.setFont('helvetica', 'bold');
  doc.text('SUBTOTAL:', 25, yPos);
  doc.text(`$${subtotal.toFixed(2)}`, 160, yPos, { align: 'right' });
  yPos += 12;

  // Builder margin if applicable
  if (marginPercent > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Builder Margin (${job.builderMargin}%):`, 25, yPos);
    doc.text(`$${marginAmount.toFixed(2)}`, 160, yPos, { align: 'right' });
    yPos += 8;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal with Margin:', 25, yPos);
    doc.text(`$${subtotalWithMargin.toFixed(2)}`, 160, yPos, { align: 'right' });
    yPos += 12;
  }

  // GST
  doc.setFont('helvetica', 'normal');
  doc.text('GST (10%):', 25, yPos);
  doc.text(`$${gstAmount.toFixed(2)}`, 160, yPos, { align: 'right' });
  yPos += 12;

  // Final total line
  doc.line(25, yPos, 190, yPos);
  yPos += 12;

  // Final total - highlighted
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 20, 60); // Deep red
  doc.text('TOTAL (inc GST):', 25, yPos);
  doc.text(`$${finalTotal.toFixed(2)}`, 160, yPos, { align: 'right' });
  
  // Reset color
  doc.setTextColor(0, 0, 0);
  
  // Save the PDF
  doc.save(`${job.jobAddress.replace(/[^a-zA-Z0-9]/g, '-')}-job-sheet.pdf`);
}
