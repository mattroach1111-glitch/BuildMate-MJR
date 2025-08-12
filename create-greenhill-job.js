// Script to create the 21 Greenhill Dr job with all data from PDF
const fetch = require('node-fetch');

const baseUrl = 'http://localhost:5000';

async function createGreenhillJob() {
  try {
    console.log('Creating 21 Greenhill Dr job...');
    
    // First create the job
    const jobResponse = await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobNumber: "21GH001",
        address: "21 Greenhill Dr",
        client: "Private Client",
        projectManager: "Matt",
        builderMargin: 15,
        defaultHourlyRate: 64,
        status: "completed"
      })
    });

    if (!jobResponse.ok) {
      console.error('Failed to create job:', await jobResponse.text());
      return;
    }

    const job = await jobResponse.json();
    console.log('Job created:', job.id);

    // Get employees to find their IDs
    const employeesResponse = await fetch(`${baseUrl}/api/employees`);
    const employees = await employeesResponse.json();
    
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.name] = emp.id;
    });

    // Add labor entries
    const laborEntries = [
      { name: "Matt", hours: 5 },
      { name: "Mark", hours: 21 },
      { name: "Greg", hours: 24 },
      { name: "Jesse", hours: 28 },
      { name: "Tim", hours: 4 }
    ];

    for (const entry of laborEntries) {
      if (employeeMap[entry.name]) {
        await fetch(`${baseUrl}/api/jobs/${job.id}/labor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employeeId: employeeMap[entry.name],
            hours: entry.hours,
            hourlyRate: 64,
            date: "2024-07-25" // Using a date from the materials list
          })
        });
        console.log(`Added labor entry: ${entry.name} - ${entry.hours} hours`);
      }
    }

    // Add materials
    const materials = [
      { description: "Ply brace", amount: 71, vendor: "Clennetts", date: "2024-07-09" },
      { description: "Coveralls", amount: 13, vendor: "Bunnings", date: "2024-07-08" },
      { description: "Surface protection, gloves", amount: 105, vendor: "Bunnings", date: "2024-07-09" },
      { description: "Insulation batts", amount: 77, vendor: "Bunnings", date: "2024-07-09" },
      { description: "Plaster gear, plastic, trims", amount: 244, vendor: "Bunnings", date: "2024-07-10" },
      { description: "Joint compound, filler, plaster gear", amount: 217, vendor: "Bunnings", date: "2024-07-14" },
      { description: "Pine, flooring, sikka, mouldings", amount: 195, vendor: "Bunnings", date: "2024-07-23" },
      { description: "Nails, filler", amount: 82, vendor: "Bunnings", date: "2024-07-24" },
      { description: "Mould killer, pine mouldings", amount: 41, vendor: "Bunnings", date: "2024-07-25" },
      { description: "Plastering - Knauf", amount: 7192, vendor: "Knauf", date: "2024-07-22" }
    ];

    for (const material of materials) {
      await fetch(`${baseUrl}/api/jobs/${job.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: material.description,
          amount: material.amount,
          vendor: material.vendor,
          invoiceDate: material.date
        })
      });
      console.log(`Added material: ${material.description} - $${material.amount}`);
    }

    // Add tip fees
    await fetch(`${baseUrl}/api/jobs/${job.id}/tip-fees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: "Tip and cartage",
        baseAmount: 237.50, // Base amount before 20% cartage
        date: "2024-07-25"
      })
    });
    console.log('Added tip fees: $285.00 total');

    console.log('✅ 21 Greenhill Dr job created successfully with all data!');
    
  } catch (error) {
    console.error('Error creating job:', error);
  }
}

createGreenhillJob();