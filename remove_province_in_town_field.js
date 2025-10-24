// Airtable script to detect Canadian provinces in "ville" field
// Moves provinces to "Province" field if empty

let table = base.getTable("master"); // Replace with your actual table name
let query = await table.selectRecordsAsync({fields: ["Ville", "Province"]});

// Comprehensive list of Canadian provinces and their variations
const CANADIAN_PROVINCES = {
    // Quebec variations
    'quebec': 'Quebec',
    'québec': 'Quebec',
    'qc': 'Quebec',
    'que': 'Quebec',
    'pq': 'Quebec',
    
    // Ontario variations
    'ontario': 'Ontario',
    'on': 'Ontario',
    'ont': 'Ontario',
    
    // British Columbia variations
    'british columbia': 'British Columbia',
    'colombie-britannique': 'British Columbia',
    'colombie britannique': 'British Columbia',
    'bc': 'British Columbia',
    'cb': 'British Columbia',
    'b.c.': 'British Columbia',
    
    // Alberta variations
    'alberta': 'Alberta',
    'ab': 'Alberta',
    'alta': 'Alberta',
    'alb': 'Alberta',
    
    // Manitoba variations
    'manitoba': 'Manitoba',
    'mb': 'Manitoba',
    'man': 'Manitoba',
    
    // Saskatchewan variations
    'saskatchewan': 'Saskatchewan',
    'sk': 'Saskatchewan',
    'sask': 'Saskatchewan',
    
    // Nova Scotia variations
    'nova scotia': 'Nova Scotia',
    'nouvelle-écosse': 'Nova Scotia',
    'nouvelle ecosse': 'Nova Scotia',
    'ns': 'Nova Scotia',
    'n.s.': 'Nova Scotia',
    'ne': 'Nova Scotia',
    
    // New Brunswick variations
    'new brunswick': 'New Brunswick',
    'nouveau-brunswick': 'New Brunswick',
    'nouveau brunswick': 'New Brunswick',
    'nb': 'New Brunswick',
    'n.b.': 'New Brunswick',
    
    // Prince Edward Island variations
    'prince edward island': 'Prince Edward Island',
    'île-du-prince-édouard': 'Prince Edward Island',
    'ile-du-prince-edouard': 'Prince Edward Island',
    'pei': 'Prince Edward Island',
    'pe': 'Prince Edward Island',
    'p.e.i.': 'Prince Edward Island',
    'ipe': 'Prince Edward Island',
    
    // Newfoundland and Labrador variations
    'newfoundland and labrador': 'Newfoundland and Labrador',
    'newfoundland': 'Newfoundland and Labrador',
    'terre-neuve-et-labrador': 'Newfoundland and Labrador',
    'terre-neuve': 'Newfoundland and Labrador',
    'nl': 'Newfoundland and Labrador',
    'nf': 'Newfoundland and Labrador',
    'nfld': 'Newfoundland and Labrador',
    
    // Territories
    'yukon': 'Yukon',
    'yt': 'Yukon',
    'northwest territories': 'Northwest Territories',
    'territoires du nord-ouest': 'Northwest Territories',
    'nt': 'Northwest Territories',
    'nwt': 'Northwest Territories',
    'tno': 'Northwest Territories',
    'nunavut': 'Nunavut',
    'nu': 'Nunavut'
};

// Function to check if a string is a Canadian province
function detectProvince(text) {
    if (!text) return null;
    
    let normalized = text.toLowerCase().trim();
    
    // Direct match
    if (CANADIAN_PROVINCES[normalized]) {
        return CANADIAN_PROVINCES[normalized];
    }
    
    return null;
}

// Array to store updates
let updates = [];
let stats = {
    provincesMoved: 0,
    provincesSkipped: 0, // Province field already had a value
    noChanges: 0
};

// Process each record
for (let record of query.records) {
    let villeValue = record.getCellValue("Ville");
    let provinceValue = record.getCellValue("Province");
    
    if (!villeValue || typeof villeValue !== 'string') {
        stats.noChanges++;
        continue;
    }
    
    // Check if the ville field contains a province
    let detectedProvince = detectProvince(villeValue);
    
    if (detectedProvince) {
        // The ville field contains a province
        if (!provinceValue) {
            // Province field is empty, so we can move it
            updates.push({
                id: record.id,
                fields: {
                    "Province": detectedProvince,
                    "Ville": "" // Clear the ville field
                }
            });
            stats.provincesMoved++;
        } else {
            // Province field already has a value, just clear ville field
            updates.push({
                id: record.id,
                fields: {
                    "Ville": "" // Clear the ville field only
                }
            });
            stats.provincesSkipped++;
        }
    } else {
        stats.noChanges++;
    }
}

// Update records in batches of 50 (Airtable's limit)
if (updates.length > 0) {
    console.log(`Processing ${updates.length} records...`);
    
    while (updates.length > 0) {
        let batch = updates.slice(0, 50);
        await table.updateRecordsAsync(batch);
        updates = updates.slice(50);
    }
    
    console.log("\n=== Update Complete ===");
    console.log(`✓ Provinces moved from Ville to Province field: ${stats.provincesMoved}`);
    console.log(`✓ Provinces cleared from Ville (Province field already had value): ${stats.provincesSkipped}`);
    console.log(`- Records with no changes (not provinces): ${stats.noChanges}`);
} else {
    console.log("No records needed updating");
    console.log(`Records checked: ${query.records.length}`);
}