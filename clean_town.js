// Airtable script to remove everything after the first comma in the "ville" field
// This will clean entries like "Montreal, Qc" to just "Montreal"

let table = base.getTable("master");
let query = await table.selectRecordsAsync({fields: ["Ville"]});

// Array to store updates
let updates = [];

// Process each record
for (let record of query.records) {
    let villeValue = record.getCellValue("Ville");
    
    // Only process if the field has a value and contains a comma
    if (villeValue && villeValue.includes(',')) {
        // Extract everything before the first comma and trim whitespace
        let cleanedValue = villeValue.split(',')[0].trim();
        
        updates.push({
            id: record.id,
            fields: {
                "Ville": cleanedValue
            }
        });
    }
}

// Update records in batches of 50 (Airtable's limit)
if (updates.length > 0) {
    console.log(`Found ${updates.length} records to update`);
    
    while (updates.length > 0) {
        let batch = updates.slice(0, 50);
        await table.updateRecordsAsync(batch);
        updates = updates.slice(50);
    }
    
    console.log("All records updated successfully!");
} else {
    console.log("No records found with commas in the ville field");
}