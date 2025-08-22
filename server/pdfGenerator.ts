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

interface JobSheetData {
  id: string;
  jobAddress: string;
  clientName: string;
  projectName: string;
  projectManager?: string;
  status: string;
  totalCost: number;
  createdAt: string;
  laborEntries: Array<{
    id: string;
    date: string;
    hours: number;
    description: string;
    hourlyRate: number;
    employee: { name: string };
  }>;
  materials: Array<{
    id: string;
    name: string;
    cost: number;
    quantity: number;
    supplier?: string;
  }>;
  subTrades: Array<{
    id: string;
    name: string;
    cost: number;
    description?: string;
  }>;
  otherCosts: Array<{
    id: string;
    name: string;
    cost: number;
    description?: string;
  }>;
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

  generateJobSheetPDF(jobData: JobSheetData): Buffer {
    console.log('Generating Job Sheet PDF for:', jobData.jobAddress);
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPos = 25;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('BuildFlow Pro - Job Sheet', pageWidth / 2, yPos, { align: 'center' });
    yPos += 20;

    // Job Information
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Job Information', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Job Address: ${jobData.jobAddress}`, 20, yPos);
    yPos += 8;
    doc.text(`Client: ${jobData.clientName}`, 20, yPos);
    yPos += 8;
    doc.text(`Project: ${jobData.projectName}`, 20, yPos);
    yPos += 8;
    if (jobData.projectManager) {
      doc.text(`Project Manager: ${jobData.projectManager}`, 20, yPos);
      yPos += 8;
    }
    doc.text(`Status: ${jobData.status}`, 20, yPos);
    yPos += 8;
    doc.text(`Created: ${format(parseISO(jobData.createdAt), 'dd/MM/yyyy')}`, 20, yPos);
    yPos += 15;

    // Labor Section
    if (jobData.laborEntries.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Labor Entries', 20, yPos);
      yPos += 10;

      // Labor table headers
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Date', 20, yPos);
      doc.text('Employee', 55, yPos);
      doc.text('Hours', 100, yPos);
      doc.text('Rate', 125, yPos);
      doc.text('Cost', 150, yPos);
      doc.text('Description', 175, yPos);
      
      doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);
      yPos += 8;

      doc.setFont('helvetica', 'normal');
      let totalLaborCost = 0;

      for (const entry of jobData.laborEntries) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 30;
        }

        const cost = entry.hours * entry.hourlyRate;
        totalLaborCost += cost;

        doc.text(format(parseISO(entry.date), 'dd/MM'), 20, yPos);
        doc.text(entry.employee.name.substring(0, 15), 55, yPos);
        doc.text(entry.hours.toString(), 100, yPos);
        doc.text(`$${entry.hourlyRate}`, 125, yPos);
        doc.text(`$${cost.toFixed(2)}`, 150, yPos);
        doc.text(entry.description.substring(0, 25), 175, yPos);
        yPos += 7;
      }

      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Labor: $${totalLaborCost.toFixed(2)}`, 150, yPos);
      yPos += 15;
    }

    // Materials Section
    if (jobData.materials.length > 0) {
      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 30;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Materials', 20, yPos);
      yPos += 10;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Item', 20, yPos);
      doc.text('Qty', 100, yPos);
      doc.text('Unit Cost', 125, yPos);
      doc.text('Total', 155, yPos);
      doc.text('Supplier', 180, yPos);
      
      doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);
      yPos += 8;

      doc.setFont('helvetica', 'normal');
      let totalMaterialsCost = 0;

      for (const material of jobData.materials) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 30;
        }

        totalMaterialsCost += material.cost;
        
        doc.text(material.name.substring(0, 30), 20, yPos);
        doc.text(material.quantity.toString(), 100, yPos);
        doc.text(`$${(material.cost / material.quantity).toFixed(2)}`, 125, yPos);
        doc.text(`$${material.cost.toFixed(2)}`, 155, yPos);
        doc.text((material.supplier || 'N/A').substring(0, 15), 180, yPos);
        yPos += 7;
      }

      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Materials: $${totalMaterialsCost.toFixed(2)}`, 155, yPos);
      yPos += 15;
    }

    // Sub-Trades Section
    if (jobData.subTrades.length > 0) {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 30;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Sub-Trades', 20, yPos);
      yPos += 10;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Trade', 20, yPos);
      doc.text('Cost', 150, yPos);
      doc.text('Description', 180, yPos);
      
      doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);
      yPos += 8;

      doc.setFont('helvetica', 'normal');
      let totalSubTradesCost = 0;

      for (const subTrade of jobData.subTrades) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 30;
        }

        totalSubTradesCost += subTrade.cost;
        
        doc.text(subTrade.name.substring(0, 40), 20, yPos);
        doc.text(`$${subTrade.cost.toFixed(2)}`, 150, yPos);
        doc.text((subTrade.description || '').substring(0, 20), 180, yPos);
        yPos += 7;
      }

      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Sub-Trades: $${totalSubTradesCost.toFixed(2)}`, 150, yPos);
      yPos += 15;
    }

    // Other Costs Section
    if (jobData.otherCosts.length > 0) {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 30;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Other Costs', 20, yPos);
      yPos += 10;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Item', 20, yPos);
      doc.text('Cost', 150, yPos);
      doc.text('Description', 180, yPos);
      
      doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);
      yPos += 8;

      doc.setFont('helvetica', 'normal');
      let totalOtherCosts = 0;

      for (const otherCost of jobData.otherCosts) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 30;
        }

        totalOtherCosts += otherCost.cost;
        
        doc.text(otherCost.name.substring(0, 40), 20, yPos);
        doc.text(`$${otherCost.cost.toFixed(2)}`, 150, yPos);
        doc.text((otherCost.description || '').substring(0, 20), 180, yPos);
        yPos += 7;
      }

      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Other Costs: $${totalOtherCosts.toFixed(2)}`, 150, yPos);
      yPos += 15;
    }

    // Final Summary
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 30;
    }

    yPos += 10;
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 15;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL JOB COST: $${jobData.totalCost.toFixed(2)}`, pageWidth / 2, yPos, { align: 'center' });

    // Footer
    yPos += 25;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')} by BuildFlow Pro`, 20, yPos);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return pdfBuffer;
  }
}