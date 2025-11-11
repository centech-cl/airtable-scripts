// Configuration - Update these with your actual table and field names
const TABLE_NAME = 'Merck';
const MASTER_TABLE_NAME = 'master';
const LINK_FIELD_NAME = 'master'; // The linked record field name in Servier table
const MEMBRE_CORPORATIF_FIELD = 'Membre Corporatif';
const TAG1_VALUE = 'Merck';

// Get tables
let servierTable = base.getTable(TABLE_NAME);
let masterTable = base.getTable(MASTER_TABLE_NAME);

// Get all records from Servier table
let servierRecords = await servierTable.selectRecordsAsync({fields: servierTable.fields});

// Collect all unique Master record IDs that need to be updated
let masterRecordIds = new Set();

for (let record of servierRecords.records) {
    let linkedRecords = record.getCellValue(LINK_FIELD_NAME);
    if (linkedRecords) {
        for (let linkedRecord of linkedRecords) {
            masterRecordIds.add(linkedRecord.id);
        }
    }
}

console.log(`Found ${masterRecordIds.size} unique Master records to update`);

// Fetch the Master records to get their current values
let recordIdsArray = Array.from(masterRecordIds);
let masterRecords = await masterTable.selectRecordsAsync({
    fields: [MEMBRE_CORPORATIF_FIELD]
});

// Create a map of record IDs to their current Membre Corporatif values
let recordMap = new Map();
for (let record of masterRecords.records) {
    if (recordIdsArray.includes(record.id)) {
        recordMap.set(record.id, record.getCellValue(MEMBRE_CORPORATIF_FIELD) || []);
    }
}

// Update records in batches of 50 (Airtable limit)
let updates = [];
for (let recordId of recordIdsArray) {
    let currentTags = recordMap.get(recordId) || [];
    
    // Check if TAG1_VALUE already exists
    let tagExists = currentTags.some(tag => tag.name === TAG1_VALUE);
    
    // Only add if it doesn't already exist
    if (!tagExists) {
        let newTags = [...currentTags, {name: TAG1_VALUE}];
        updates.push({
            id: recordId,
            fields: {
                [MEMBRE_CORPORATIF_FIELD]: newTags
            }
        });
    } else {
        console.log(`Skipping record ${recordId} - already has ${TAG1_VALUE}`);
    }
}

console.log(`Updating ${updates.length} records`);

// Process updates in batches
while (updates.length > 0) {
    let batch = updates.slice(0, 50);
    await masterTable.updateRecordsAsync(batch);
    updates = updates.slice(50);
    console.log(`Updated ${batch.length} records`);
}

console.log('✅ Update complete!');