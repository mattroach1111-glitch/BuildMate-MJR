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
  }>;
  materials: Array<{
    id: string;
    amount: string;
  }>;
  subTrades: Array<{
    id: string;
    amount: string;
  }>;
  otherCosts: Array<{
    id: string;
    description: string;
    amount: string;
  }>;
};

export async function generateJobPDF(job: JobWithRelations) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('BuildFlow Pro', 20, 20);
  doc.setFontSize(16);
  doc.text('Job Sheet', 20, 30);
  
  // Job Info
  doc.setFontSize(12);
  doc.text(`Job Address: ${job.jobAddress}`, 20, 50);
  doc.text(`Client: ${job.clientName}`, 20, 60);
  doc.text(`Project: ${job.projectName}`, 20, 70);
  doc.text(`Status: ${job.status}`, 20, 80);
  
  // Date
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 150, 50);
  
  // Calculate totals
  const laborTotal = job.laborEntries.reduce((sum, entry) => {
    return sum + (parseFloat(entry.hourlyRate) * parseFloat(entry.hoursLogged));
  }, 0);

  const materialsTotal = job.materials.reduce((sum, material) => {
    return sum + parseFloat(material.amount);
  }, 0);

  const subTradesTotal = job.subTrades.reduce((sum, subTrade) => {
    return sum + parseFloat(subTrade.amount);
  }, 0);

  const otherCostsTotal = job.otherCosts.reduce((sum, cost) => {
    return sum + parseFloat(cost.amount);
  }, 0);

  const subtotal = laborTotal + materialsTotal + subTradesTotal + otherCostsTotal;
  const marginPercent = parseFloat(job.builderMargin) / 100;
  const marginAmount = subtotal * marginPercent;
  const subtotalWithMargin = subtotal + marginAmount;
  
  // Australian GST is 10%
  const gstAmount = subtotalWithMargin * 0.10;
  const total = subtotalWithMargin + gstAmount;
  
  // Totals section
  let yPos = 100;
  doc.setFontSize(14);
  doc.text('Project Summary', 20, yPos);
  yPos += 15;
  
  doc.setFontSize(10);
  doc.text('Labour Total:', 20, yPos);
  doc.text(`$${laborTotal.toFixed(2)}`, 100, yPos);
  yPos += 10;
  
  doc.text('Materials Total:', 20, yPos);
  doc.text(`$${materialsTotal.toFixed(2)}`, 100, yPos);
  yPos += 10;
  
  doc.text('Sub Trades Total:', 20, yPos);
  doc.text(`$${subTradesTotal.toFixed(2)}`, 100, yPos);
  yPos += 10;
  
  doc.text('Other Costs Total:', 20, yPos);
  doc.text(`$${otherCostsTotal.toFixed(2)}`, 100, yPos);
  yPos += 15;
  
  doc.text('Subtotal:', 20, yPos);
  doc.text(`$${subtotal.toFixed(2)}`, 100, yPos);
  yPos += 10;
  
  doc.text(`Builder Margin (${job.builderMargin}%):`, 20, yPos);
  doc.text(`$${marginAmount.toFixed(2)}`, 100, yPos);
  yPos += 10;
  
  doc.text('Subtotal + Margin:', 20, yPos);
  doc.text(`$${subtotalWithMargin.toFixed(2)}`, 100, yPos);
  yPos += 10;
  
  doc.text('GST (10%):', 20, yPos);
  doc.text(`$${gstAmount.toFixed(2)}`, 100, yPos);
  yPos += 15;
  
  doc.setFontSize(12);
  doc.text('Total (inc. GST):', 20, yPos);
  doc.text(`$${total.toFixed(2)}`, 100, yPos);
  
  // Save the PDF
  doc.save(`${job.jobAddress.replace(/[^a-zA-Z0-9]/g, '-')}-job-sheet.pdf`);
}
