import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';

interface TimesheetEntry {
  id: string;
  date: string;
  hours: number;
  materials: string;
  jobId: string | null;
  staffId: string;
  approved: boolean;
  job?: {
    jobNumber: string;
    address: string;
    clientName: string;
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
    
    // Sort entries by date
    const sortedEntries = entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    doc.setFont('helvetica', 'normal');
    let totalHours = 0;
    
    // Table rows
    for (const entry of sortedEntries) {
      // Check if we need a new page
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 30;
      }
      
      const dateStr = format(parseISO(entry.date), 'dd/MM/yyyy');
      const hoursStr = entry.hours.toString();
      const jobStr = entry.job ? `${entry.job.jobNumber} - ${entry.job.address}` : 'No Job';
      const materialsStr = entry.materials || '-';
      
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