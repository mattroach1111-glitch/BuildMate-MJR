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
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Job Address', 20, yPos);
  doc.text('Client', 80, yPos);
  doc.text('Status', 130, yPos);
  doc.text('Rate', 160, yPos);
  doc.text('Margin', 180, yPos);
  yPos += 3;
  
  // Header underline
  doc.line(20, yPos, 190, yPos);
  yPos += 10;
  
  // Job entries
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  jobs.forEach((job, index) => {
    checkPageBreak(15);
    
    // Alternate row background (simulated with lighter text for odd rows)
    if (index % 2 === 1) {
      doc.setTextColor(100, 100, 100);
    } else {
      doc.setTextColor(0, 0, 0);
    }
    
    // Job address (truncate if too long)
    const address = job.jobAddress.length > 25 ? 
      job.jobAddress.substring(0, 22) + '...' : job.jobAddress;
    doc.text(address, 20, yPos);
    
    // Client name (truncate if too long)
    const client = job.clientName.length > 20 ? 
      job.clientName.substring(0, 17) + '...' : job.clientName;
    doc.text(client, 80, yPos);
    
    // Status
    const status = job.status.replace(/_/g, ' ').toUpperCase();
    doc.text(status, 130, yPos);
    
    // Hourly rate
    doc.text(`$${parseFloat(job.defaultHourlyRate).toFixed(0)}`, 160, yPos);
    
    // Builder margin
    doc.text(`${job.builderMargin}%`, 180, yPos);
    
    yPos += 12;
  });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Summary section
  yPos += 10;
  checkPageBreak(30);
  
  doc.line(20, yPos, 190, yPos);
  yPos += 15;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', 20, yPos);
  yPos += 15;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Status breakdown
  const statusCounts = jobs.reduce((acc, job) => {
    const status = job.status.replace(/_/g, ' ').toUpperCase();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(statusCounts).forEach(([status, count]) => {
    doc.text(`${status}: ${count} jobs`, 25, yPos);
    yPos += 8;
  });
  
  // Average rates
  yPos += 5;
  const avgRate = jobs.reduce((sum, job) => sum + parseFloat(job.defaultHourlyRate), 0) / jobs.length;
  const avgMargin = jobs.reduce((sum, job) => sum + parseFloat(job.builderMargin), 0) / jobs.length;
  
  doc.text(`Average Hourly Rate: $${avgRate.toFixed(2)}`, 25, yPos);
  yPos += 8;
  doc.text(`Average Builder Margin: ${avgMargin.toFixed(1)}%`, 25, yPos);
  
  // Save the PDF
  const fileName = `${managerName.replace(/[^a-zA-Z0-9]/g, '-')}-job-list-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
