// Enhanced Script: Populate Industry table AND link to startups
// Instructions:
// 1. Create a new table called "Industry" with these fields:
//    - "Industry Name" (single line text - this is the primary field)
//    - "Startups" (linked record field, linking to the "master" table)
// 2. Go to Extensions > Scripting in Airtable
// 3. Copy and paste this script
// 4. Click "Run"

let masterTable = base.getTable("master");
let industryTable = base.getTable("industry");

output.text("🔄 Step 1: Getting all records from master table...");

// Get all records from master table
let masterQuery = await masterTable.selectRecordsAsync({
    fields: ["Industry"]
});

// Group startups by industry
let industriesMap = new Map();

for (let record of masterQuery.records) {
    let industry = record.getCellValue("Industry");
    if (industry && industry.name) {
        let industryName = industry.name;
        
        if (!industriesMap.has(industryName)) {
            industriesMap.set(industryName, []);
        }
        
        industriesMap.get(industryName).push(record.id);
    }
}

output.text(`✅ Found ${industriesMap.size} unique industries`);

// Convert to sorted array
let industries = Array.from(industriesMap.keys()).sort();

output.text("🔄 Step 2: Creating industry records with linked startups...");

// Create records in Industry table with links
let recordsToCreate = [];

for (let industryName of industries) {
    let startupIds = industriesMap.get(industryName);
    
    recordsToCreate.push({
        fields: {
            "Industry": industryName,
            "Startups": startupIds.map(id => ({ id: id }))
        }
    });
}

// Airtable allows max 50 records per batch
let totalCreated = 0;
while (recordsToCreate.length > 0) {
    let batch = recordsToCreate.splice(0, 50);
    await industryTable.createRecordsAsync(batch);
    totalCreated += batch.length;
    output.text(`  ✓ Created ${totalCreated} of ${industries.length} industry records`);
}

output.text("\n✅ Done! All industries have been created and linked to their startups.");
output.text(`\nSummary:`);
output.text(`  • ${industries.length} industries created`);
output.text(`  • ${masterQuery.records.length} startups processed`);