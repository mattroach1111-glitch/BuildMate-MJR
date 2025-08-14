import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib';

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
  timesheets?: Array<{
    id: string;
    date: string;
    hours: string;
    materials: string;
    description: string;
    approved: boolean;
    staffName: string;
    staffEmail: string;
  }>;
};

export async function generateJobPDF(job: JobWithRelations, attachedFiles?: Array<{id: string, originalName: string, objectPath: string | null, googleDriveLink?: string | null}>) {
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

  // TIMESHEET ENTRIES SECTION - On new page after totals
  if (job.timesheets && job.timesheets.length > 0) {
    // Start new page for timesheet entries
    doc.addPage();
    yPos = 30;

    // Header for timesheet page
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TIMESHEET ENTRIES', 105, yPos, { align: 'center' });
    yPos += 10;

    // Job info on timesheet page
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Job: ${job.jobAddress}`, 20, yPos);
    doc.text(`Client: ${job.clientName}`, 20, yPos + 7);
    yPos += 25;

    // Table headers
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 25, yPos);
    doc.text('Staff Member', 55, yPos);
    doc.text('Hours', 100, yPos);
    doc.text('Materials/Notes', 120, yPos);
    doc.text('Status', 160, yPos);
    yPos += 3;
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    // Sort timesheets by date (newest first)
    const sortedTimesheets = [...job.timesheets].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    doc.setFont('helvetica', 'normal');
    let totalTimesheetHours = 0;
    let approvedHours = 0;

    sortedTimesheets.forEach((entry) => {
      checkPageBreak(10);
      
      const hours = parseFloat(entry.hours);
      totalTimesheetHours += hours;
      if (entry.approved) {
        approvedHours += hours;
      }

      // Format date
      const date = new Date(entry.date).toLocaleDateString('en-AU', { 
        day: '2-digit', 
        month: '2-digit',
        year: '2-digit'
      });
      
      // Handle staff names and materials
      const staffName = entry.staffName || entry.staffEmail?.split('@')[0] || 'Unknown';
      const truncatedStaff = staffName.length > 18 ? staffName.substring(0, 15) + '...' : staffName;
      const materials = entry.materials || entry.description || '-';
      const truncatedMaterials = materials.length > 22 ? materials.substring(0, 19) + '...' : materials;

      doc.text(date, 25, yPos);
      doc.text(truncatedStaff, 55, yPos);
      doc.text(`${hours.toFixed(1)}h`, 100, yPos);
      doc.text(truncatedMaterials, 120, yPos);
      doc.text(entry.approved ? 'Approved' : 'Pending', 160, yPos);
      yPos += 8;
    });

    // Timesheet summary section
    yPos += 10;
    doc.line(20, yPos, 190, yPos);
    yPos += 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TIMESHEET SUMMARY', 20, yPos);
    yPos += 15;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Hours Logged:', 25, yPos);
    doc.text(`${totalTimesheetHours.toFixed(1)} hours`, 160, yPos, { align: 'right' });
    yPos += 8;
    
    doc.text('Approved Hours:', 25, yPos);
    doc.text(`${approvedHours.toFixed(1)} hours`, 160, yPos, { align: 'right' });
    yPos += 8;

    doc.text('Pending Hours:', 25, yPos);
    doc.text(`${(totalTimesheetHours - approvedHours).toFixed(1)} hours`, 160, yPos, { align: 'right' });
    yPos += 15;

    // Additional notes section
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES:', 20, yPos);
    yPos += 10;

    // Add lines for notes
    doc.setDrawColor(200, 200, 200);
    for (let i = 0; i < 5; i++) {
      doc.line(20, yPos + (i * 10), 190, yPos + (i * 10));
    }
  }

  // Add compact attached files section if any
  if (attachedFiles && attachedFiles.length > 0) {
    // Force new page for attachments
    doc.addPage();
    yPos = 20;
    
    // Attachments header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ATTACHED DOCUMENTS', 20, yPos);
    yPos += 12;
    
    // List of attached files with better readability
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    attachedFiles.forEach((file, index) => {
      checkPageBreak(20);
      
      if (file.googleDriveLink) {
        // Google Drive file - larger, more readable clickable link
        doc.setTextColor(0, 100, 200); // Darker blue for better readability
        const linkText = `• ${file.originalName}`;
        doc.text(linkText, 25, yPos);
        doc.link(25, yPos - 4, doc.getTextWidth(linkText), 10, { url: file.googleDriveLink });
        doc.setTextColor(100, 100, 100);
        doc.text('(Click to open in Google Drive)', 25, yPos + 8);
        doc.setTextColor(0, 0, 0);
        yPos += 18;
      } else {
        // Internal storage file - show as available internally
        doc.setTextColor(80, 80, 80);
        doc.text(`• ${file.originalName}`, 25, yPos);
        doc.setTextColor(100, 100, 100);
        doc.text('(Available in system)', 25, yPos + 8);
        doc.setTextColor(0, 0, 0);
        yPos += 18;
      }
    });
    
    yPos += 10; // Add some space after attachments
  }
  
  // Save the PDF
  doc.save(`${job.jobAddress.replace(/[^a-zA-Z0-9]/g, '-')}-job-sheet.pdf`);
}

// Function to generate PDF as base64 string for email attachments
export async function generateJobPDFBase64(job: JobWithRelations, attachedFiles?: Array<{id: string, originalName: string, objectPath: string | null, googleDriveLink?: string | null}>): Promise<string> {
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
  
  let yPos = 30;

  // Header - centered like Excel
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB COST SHEET', 105, 20, { align: 'center' });
  
  // Job details - top left
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Job: ${job.jobAddress}`, 20, 35);
  doc.text(`Client: ${job.clientName}`, 20, 42);
  doc.text(`Project: ${job.projectName || 'N/A'}`, 20, 49);
  doc.text(`Status: ${job.status}`, 20, 56);
  
  yPos = 70;

  // LABOUR SECTION
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('LABOUR', 20, yPos);
  yPos += 15;

  if (job.laborEntries && job.laborEntries.length > 0) {
    // Table headers
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Staff Member', 25, yPos);
    doc.text('Rate', 90, yPos);
    doc.text('Hours', 120, yPos);
    doc.text('Total', 150, yPos);
    yPos += 3;
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    let laborTotal = 0;
    
    job.laborEntries.forEach((entry) => {
      checkPageBreak();
      
      const rate = parseFloat(entry.hourlyRate);
      const hours = parseFloat(entry.hoursLogged);
      const total = rate * hours;
      laborTotal += total;

      const staffName = entry.staff?.name || 'Unassigned Staff';
      doc.text(staffName, 25, yPos);
      doc.text(`$${rate.toFixed(2)}`, 90, yPos);
      doc.text(`${hours.toFixed(1)}h`, 120, yPos);
      doc.text(`$${total.toFixed(2)}`, 150, yPos);
      yPos += 8;
    });

    yPos += 5;
    doc.line(140, yPos, 180, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Labour Total:', 105, yPos);
    doc.text(`$${laborTotal.toFixed(2)}`, 150, yPos);
    yPos += 20;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('No labour entries', 25, yPos);
    yPos += 20;
  }

  // MATERIALS SECTION
  checkPageBreak(50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('MATERIALS', 20, yPos);
  yPos += 15;

  if (job.materials && job.materials.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 25, yPos);
    doc.text('Supplier', 90, yPos);
    doc.text('Date', 130, yPos);
    doc.text('Amount', 160, yPos);
    yPos += 3;
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    let materialsTotal = 0;
    
    job.materials.forEach((material) => {
      checkPageBreak();
      
      const amount = parseFloat(material.amount);
      materialsTotal += amount;

      const description = material.description.length > 30 ? material.description.substring(0, 27) + '...' : material.description;
      const supplier = material.supplier.length > 18 ? material.supplier.substring(0, 15) + '...' : material.supplier;
      const date = material.invoiceDate || 'N/A';

      doc.text(description, 25, yPos);
      doc.text(supplier, 90, yPos);
      doc.text(date, 130, yPos);
      doc.text(`$${amount.toFixed(2)}`, 160, yPos);
      yPos += 8;
    });

    yPos += 5;
    doc.line(140, yPos, 180, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Materials Total:', 105, yPos);
    doc.text(`$${materialsTotal.toFixed(2)}`, 160, yPos);
    yPos += 20;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('No materials', 25, yPos);
    yPos += 20;
  }

  // SUB TRADES SECTION
  checkPageBreak(50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SUB TRADES', 20, yPos);
  yPos += 15;

  if (job.subTrades && job.subTrades.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Trade', 25, yPos);
    doc.text('Contractor', 70, yPos);
    doc.text('Date', 130, yPos);
    doc.text('Amount', 160, yPos);
    yPos += 3;
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    let subTradesTotal = 0;
    
    job.subTrades.forEach((subTrade) => {
      checkPageBreak();
      
      const amount = parseFloat(subTrade.amount);
      subTradesTotal += amount;

      const trade = subTrade.trade.length > 20 ? subTrade.trade.substring(0, 17) + '...' : subTrade.trade;
      const contractor = subTrade.contractor.length > 25 ? subTrade.contractor.substring(0, 22) + '...' : subTrade.contractor;
      const date = subTrade.invoiceDate || 'N/A';

      doc.text(trade, 25, yPos);
      doc.text(contractor, 70, yPos);
      doc.text(date, 130, yPos);
      doc.text(`$${amount.toFixed(2)}`, 160, yPos);
      yPos += 8;
    });

    yPos += 5;
    doc.line(140, yPos, 180, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Sub Trades Total:', 105, yPos);
    doc.text(`$${subTradesTotal.toFixed(2)}`, 160, yPos);
    yPos += 20;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('No sub trades', 25, yPos);
    yPos += 20;
  }

  // OTHER COSTS SECTION
  checkPageBreak(50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('OTHER COSTS', 20, yPos);
  yPos += 15;

  if (job.otherCosts && job.otherCosts.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 25, yPos);
    doc.text('Amount', 160, yPos);
    yPos += 3;
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    let otherCostsTotal = 0;
    
    job.otherCosts.forEach((cost) => {
      checkPageBreak();
      
      const amount = parseFloat(cost.amount);
      otherCostsTotal += amount;

      const description = cost.description.length > 50 ? cost.description.substring(0, 47) + '...' : cost.description;

      doc.text(description, 25, yPos);
      doc.text(`$${amount.toFixed(2)}`, 160, yPos);
      yPos += 8;
    });

    yPos += 5;
    doc.line(140, yPos, 180, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Other Costs Total:', 105, yPos);
    doc.text(`$${otherCostsTotal.toFixed(2)}`, 160, yPos);
    yPos += 20;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('No other costs', 25, yPos);
    yPos += 20;
  }

  // Calculate totals
  let subtotal = 0;
  if (job.laborEntries) subtotal += job.laborEntries.reduce((sum, entry) => sum + (parseFloat(entry.hourlyRate) * parseFloat(entry.hoursLogged)), 0);
  if (job.materials) subtotal += job.materials.reduce((sum, material) => sum + parseFloat(material.amount), 0);
  if (job.subTrades) subtotal += job.subTrades.reduce((sum, subTrade) => sum + parseFloat(subTrade.amount), 0);
  if (job.otherCosts) subtotal += job.otherCosts.reduce((sum, cost) => sum + parseFloat(cost.amount), 0);

  const marginPercent = parseFloat(job.builderMargin || "0");
  const marginAmount = subtotal * (marginPercent / 100);
  const subtotalWithMargin = subtotal + marginAmount;
  const gstAmount = subtotalWithMargin * 0.1;
  const finalTotal = subtotalWithMargin + gstAmount;

  // TOTALS SECTION
  checkPageBreak(100);
  yPos += 10;
  
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

  // Add compact attached files section if any
  if (attachedFiles && attachedFiles.length > 0) {
    // Force new page for attachments
    doc.addPage();
    yPos = 20;
    
    // Attachments header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ATTACHED DOCUMENTS', 20, yPos);
    yPos += 12;
    
    // List of attached files with better readability
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    attachedFiles.forEach((file, index) => {
      checkPageBreak(20);
      
      if (file.googleDriveLink) {
        // Google Drive file - larger, more readable clickable link
        doc.setTextColor(0, 100, 200); // Darker blue for better readability
        const linkText = `• ${file.originalName}`;
        doc.text(linkText, 25, yPos);
        doc.link(25, yPos - 4, doc.getTextWidth(linkText), 10, { url: file.googleDriveLink });
        doc.setTextColor(100, 100, 100);
        doc.text('(Click to open in Google Drive)', 25, yPos + 8);
        doc.setTextColor(0, 0, 0);
        yPos += 18;
      } else {
        // Internal storage file - show as available internally
        doc.setTextColor(80, 80, 80);
        doc.text(`• ${file.originalName}`, 25, yPos);
        doc.setTextColor(100, 100, 100);
        doc.text('(Available in system)', 25, yPos + 8);
        doc.setTextColor(0, 0, 0);
        yPos += 18;
      }
    });
    
    yPos += 10; // Add some space after attachments
  }

  // Return PDF as base64 string instead of saving
  return doc.output('datauristring').split(',')[1]; // Remove data:application/pdf;filename=generated.pdf;base64, prefix
}

type JobListItem = {
  id: string;
  jobAddress: string;
  clientName: string;
  projectName: string;
  status: string;
  builderMargin: string;
  defaultHourlyRate: string;
  isDeleted?: boolean | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export async function generateJobListPDF(jobs: JobListItem[], managerName: string) {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const marginBottom = 20;
  let yPos = 20;
  
  // Function to check if we need a new page
  const checkPageBreak = (requiredSpace: number = 20) => {
    if (yPos + requiredSpace > pageHeight - marginBottom) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };
  
  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB LIST REPORT', 105, yPos, { align: 'center' });
  yPos += 15;
  
  // Manager and date info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project Manager: ${managerName}`, 20, yPos);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-AU', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })}`, 20, yPos + 7);
  doc.text(`Total Jobs: ${jobs.length}`, 20, yPos + 14);
  yPos += 30;
  
  // Table headers
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Job Address', 20, yPos);
  doc.text('Client', 90, yPos);
  doc.text('Notes', 140, yPos);
  yPos += 5;
  
  // Header underline
  doc.line(20, yPos, 190, yPos);
  yPos += 15;
  
  // Job entries with notes space
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  jobs.forEach((job, index) => {
    checkPageBreak(25); // More space needed for notes area
    
    // Job address (allow more space)
    const address = job.jobAddress.length > 30 ? 
      job.jobAddress.substring(0, 27) + '...' : job.jobAddress;
    doc.text(address, 20, yPos);
    
    // Client name
    const client = job.clientName.length > 22 ? 
      job.clientName.substring(0, 19) + '...' : job.clientName;
    doc.text(client, 90, yPos);
    
    // Notes area - draw a line for writing
    doc.setDrawColor(200, 200, 200); // Light gray
    doc.line(140, yPos + 2, 190, yPos + 2); // Notes line
    
    // Add some extra space between entries for better readability
    yPos += 20;
  });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Simple footer with space for additional notes
  yPos += 20;
  checkPageBreak(40);
  
  doc.line(20, yPos, 190, yPos);
  yPos += 15;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ADDITIONAL NOTES', 20, yPos);
  yPos += 15;
  
  // Add several lines for additional notes
  doc.setDrawColor(200, 200, 200); // Light gray
  for (let i = 0; i < 6; i++) {
    doc.line(20, yPos + (i * 15), 190, yPos + (i * 15));
  }
  
  // Save the PDF
  const fileName = `${managerName.replace(/[^a-zA-Z0-9]/g, '-')}-job-list-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
