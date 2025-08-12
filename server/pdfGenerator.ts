import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';

interface TimesheetEntry {
  id: string;
  date: string;
  hours: number;
  materials: string;
  description?: string;
  jobId: string | null;
  staffId: string;
  approved: boolean;
  job?: {
    id: string;
    jobAddress: string;
    clientName: string;
    projectName: string;
  };
}

interface Employee {
  id: string;
  name: string;
  hourlyRate: number;
}

export class TimesheetPDFGenerator {
  generateTimesheetPDF(
    employee: Employee,
    entries: TimesheetEntry[],
    fortnightStart: string,
    fortnightEnd: string
  ): Buffer {
    // Debug logging to understand the data structure
    console.log('PDF Generator - Employee:', employee);
    console.log('PDF Generator - Total entries received:', entries.length);
    console.log('PDF Generator - Sample entry:', entries[0] || 'No entries');
    console.log('PDF Generator - Period:', fortnightStart, 'to', fortnightEnd);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('BuildFlow Pro - Timesheet', pageWidth / 2, 25, { align: 'center' });
    
    // Employee and period info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Employee: ${employee.name}`, 20, 45);
    doc.text(`Period: ${format(parseISO(fortnightStart), 'dd/MM/yyyy')} - ${format(parseISO(fortnightEnd), 'dd/MM/yyyy')}`, 20, 55);
    doc.text(`Hourly Rate: $${employee.hourlyRate}/hr`, 20, 65);
    
    // Table headers
    let yPos = 85;
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 20, yPos);
    doc.text('Hours', 60, yPos);
    doc.text('Job/Description', 100, yPos);
    doc.text('Materials/Leave', 160, yPos);
    
    // Draw header line
    doc.line(20, yPos + 3, pageWidth - 20, yPos + 3);
    yPos += 15;
    
    // Filter out entries with zero hours and sort by date
    const workedEntries = entries.filter(entry => entry.hours > 0);
    const sortedEntries = workedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    doc.setFont('helvetica', 'normal');
    let totalHours = 0;
    
    // Table rows (only show days worked)
    for (const entry of sortedEntries) {
      // Check if we need a new page
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 30;
      }
      
      const dateStr = format(parseISO(entry.date), 'dd/MM/yyyy');
      const hoursStr = entry.hours.toString();
      
      // Handle job information properly
      let jobStr = 'No Job';
      if (entry.job && entry.job.projectName && entry.job.clientName) {
        jobStr = `${entry.job.projectName} - ${entry.job.clientName}`;
      } else if (entry.job && entry.job.jobAddress) {
        jobStr = entry.job.jobAddress;
      } else if (entry.jobId) {
        jobStr = `Job ${entry.jobId.substring(0, 8)}...`;
      }
      
      // Handle custom addresses from description
      if (entry.description && entry.description.startsWith('CUSTOM_ADDRESS:')) {
        jobStr = entry.description.replace('CUSTOM_ADDRESS: ', '');
      }
      
      // Handle materials and leave types
      const materialsStr = entry.materials || (entry.description || '-');
      
      doc.text(dateStr, 20, yPos);
      doc.text(hoursStr, 60, yPos);
      doc.text(jobStr, 100, yPos);
      doc.text(materialsStr, 160, yPos);
      
      totalHours += entry.hours;
      yPos += 12;
    }
    
    // Summary
    yPos += 10;
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 15;
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Hours: ${totalHours}`, 20, yPos);
    doc.text(`Total Pay: $${(totalHours * employee.hourlyRate).toFixed(2)}`, 20, yPos + 12);
    
    // Approval section
    yPos += 35;
    doc.setFont('helvetica', 'normal');
    doc.text('Employee Signature: ________________________', 20, yPos);
    doc.text('Date: ___________', 20, yPos + 15);
    
    doc.text('Supervisor Signature: ______________________', 20, yPos + 35);
    doc.text('Date: ___________', 20, yPos + 50);
    
    // Convert to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return pdfBuffer;
  }
}