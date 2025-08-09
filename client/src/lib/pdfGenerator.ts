import jsPDF from 'jspdf';
import type { Job } from "@shared/schema";

export async function generateJobPDF(job: Job) {
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
  
  // Costs section
  let yPos = 100;
  doc.setFontSize(14);
  doc.text('Project Costs', 20, yPos);
  yPos += 10;
  
  doc.setFontSize(10);
  doc.text('Tip Fees:', 20, yPos);
  doc.text(`$${parseFloat(job.tipFees).toFixed(2)}`, 100, yPos);
  yPos += 10;
  
  doc.text('Permits & Fees:', 20, yPos);
  doc.text(`$${parseFloat(job.permits).toFixed(2)}`, 100, yPos);
  yPos += 10;
  
  doc.text('Equipment Rental:', 20, yPos);
  doc.text(`$${parseFloat(job.equipment).toFixed(2)}`, 100, yPos);
  yPos += 10;
  
  doc.text('Miscellaneous:', 20, yPos);
  doc.text(`$${parseFloat(job.miscellaneous).toFixed(2)}`, 100, yPos);
  yPos += 20;
  
  // Builder margin
  doc.text(`Builder Margin: ${job.builderMargin}%`, 20, yPos);
  
  // Save the PDF
  doc.save(`${job.jobAddress.replace(/[^a-zA-Z0-9]/g, '-')}-job-sheet.pdf`);
}
