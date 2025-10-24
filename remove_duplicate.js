let table = base.getTable("master");

// Get all records with all fields
let queryResult = await table.selectRecordsAsync({fields:table.fields});

console.log(`Found ${queryResult.records.length} total records`);

// Filter for records marked as "Doublon sûr"
let doublonRecords = queryResult.records.filter(record => {
    let doublonValue = record.getCellValue("Doublon");
    return doublonValue === "Doublon sûr";
});

console.log(`Found ${doublonRecords.length} records marked as "Doublon sûr"`);

// Track which records have been processed to avoid duplicates
let processedRecords = new Set();
let recordsToDelete = [];

// Group duplicates together
for (let record of doublonRecords) {
    if (processedRecords.has(record.id)) {
        continue; // Already processed as part of another group
    }
    
    // Get linked duplicate records
    let linkedRecords = record.getCellValue("From field: Lien au doublon");
    
    if (!linkedRecords || linkedRecords.length === 0) {
        console.log(`⚠ Record ${record.id} marked as doublon but has no linked records, skipping`);
        continue;
    }
    
    // Create group of all duplicates (including current record)
    let duplicateGroup = [record];
    let duplicateIds = [record.id];
    
    // Add all linked records to the group
    for (let link of linkedRecords) {
        let linkedRecord = queryResult.records.find(r => r.id === link.id);
        if (linkedRecord && !processedRecords.has(linkedRecord.id)) {
            duplicateGroup.push(linkedRecord);
            duplicateIds.push(linkedRecord.id);
        }
    }
    
    // Mark all records in this group as processed
    duplicateIds.forEach(id => processedRecords.add(id));
    
    console.log(`\n--- Processing duplicate group (${duplicateGroup.length} records) ---`);
    console.log(`Record IDs: ${duplicateIds.join(', ')}`);
    
    // Merge logic: keep the first record, merge data into it
    let masterRecord = duplicateGroup[0];
    let mergedData = {};
    
    // Get all field names from the table
    let fields = table.fields;
    
    for (let field of fields) {
        let fieldName = field.name;
                
        if (fieldName === "Contact principal") {
            // Special logic: prioritize contact with email
            let contactWithEmail = null;
            let anyContact = null;
            
            for (let rec of duplicateGroup) {
                let contact = rec.getCellValue(fieldName);
                if (contact && typeof contact === 'string' && contact.trim()) {
                    anyContact = contact;
                    // Check if contact contains @ symbol (email)
                    if (contact.includes('@')) {
                        contactWithEmail = contact;
                        break;
                    }
                }
            }
            
            let finalContact = contactWithEmail || anyContact;
            let masterValue = masterRecord.getCellValue(fieldName);
            
            if (finalContact && finalContact !== masterValue) {
                mergedData[fieldName] = finalContact;
                console.log(`  Updated ${fieldName} (prioritized email)`);
            }
            
        } else if (fieldName === "Mandats scouting") {
            // Special logic: aggregate all options from multi-select
            let allOptions = new Set();
            
            for (let rec of duplicateGroup) {
                let mandats = rec.getCellValue(fieldName);
                if (mandats && Array.isArray(mandats)) {
                    mandats.forEach(option => {
                        if (option.name) {
                            allOptions.add(option.name);
                        }
                    });
                }
            }
            
            if (allOptions.size > 0) {
                let aggregatedMandats = Array.from(allOptions).map(name => ({name: name}));
                let masterValue = masterRecord.getCellValue(fieldName);
                
                // Only update if different from master
                let masterMandats = Array.isArray(masterValue) ? masterValue : [];
                if (JSON.stringify(aggregatedMandats.sort()) !== JSON.stringify(masterMandats.sort())) {
                    mergedData[fieldName] = aggregatedMandats;
                    console.log(`  Aggregated ${fieldName}: ${Array.from(allOptions).join(', ')}`);
                }
            }
            
        } else {
            // Default logic: take first non-empty value
            let masterValue = masterRecord.getCellValue(fieldName);
            
            // Check if master value is empty
            let isEmpty = !masterValue || 
                         (typeof masterValue === 'string' && !masterValue.trim()) ||
                         (Array.isArray(masterValue) && masterValue.length === 0);
            
            if (isEmpty) {
                // Master record field is empty, look for a value in duplicates
                for (let rec of duplicateGroup) {
                    let value = rec.getCellValue(fieldName);
                    
                    // Check if this value is non-empty
                    let valueIsEmpty = !value || 
                                      (typeof value === 'string' && !value.trim()) ||
                                      (Array.isArray(value) && value.length === 0);
                    
                    if (!valueIsEmpty) {
                        mergedData[fieldName] = value;
                        console.log(`  Filled ${fieldName} from duplicate record`);
                        break;
                    }
                }
            }
        }
    }
    
    // Set doublon field to "Aucun doublon"
    mergedData["Doublon"] = "Aucun doublon";
    
    // Clear the doublon link field
    mergedData["From field: Lien au doublon"] = [];
    
    // Update the master record with merged data
    if (Object.keys(mergedData).length > 0) {
        try {
            await table.updateRecordAsync(masterRecord.id, mergedData);
            console.log(`✓ Updated master record ${masterRecord.id}`);
            console.log(`  Fields updated: ${Object.keys(mergedData).join(', ')}`);
        } catch (error) {
            console.error(`✗ Error updating master record ${masterRecord.id}:`, error);
            console.error(`  Error details:`, error.message);
            continue;
        }
    }
    
    // Mark other records in group for deletion
    for (let i = 1; i < duplicateGroup.length; i++) {
        recordsToDelete.push(duplicateGroup[i].id);
        console.log(`  Marked record ${duplicateGroup[i].id} for deletion`);
    }
}

// Delete duplicate records in batches of 50 (Airtable API limit)
console.log(`\n--- Deleting ${recordsToDelete.length} duplicate records ---`);

const BATCH_SIZE = 50;
for (let i = 0; i < recordsToDelete.length; i += BATCH_SIZE) {
    let batch = recordsToDelete.slice(i, i + BATCH_SIZE);
    
    try {
        await table.deleteRecordsAsync(batch);
        console.log(`✓ Deleted batch of ${batch.length} records`);
    } catch (error) {
        console.error(`✗ Error deleting batch:`, error);
    }
}

console.log(`\n✓ Merge complete!`);
console.log(`  Processed ${processedRecords.size} records`);
console.log(`  Deleted ${recordsToDelete.length} duplicate records`);