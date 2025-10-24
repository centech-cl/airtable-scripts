// Airtable script to normalize Province field to French single select values
// Converts all province variations to standardized French names

let table = base.getTable("master");
let query = await table.selectRecordsAsync({fields: ["Province"]});

// Comprehensive mapping of all province variations to French names
const PROVINCE_TO_FRENCH = {
    // Quebec variations → Québec
    'quebec': 'Québec',
    'québec': 'Québec',
    'qc': 'Québec',
    'que': 'Québec',
    'pq': 'Québec',
    
    // Ontario variations → Ontario (same in French)
    'ontario': 'Ontario',
    'on': 'Ontario',
    'ont': 'Ontario',
    
    // British Columbia variations → Colombie-Britannique
    'british columbia': 'Colombie-Britannique',
    'colombie-britannique': 'Colombie-Britannique',
    'colombie britannique': 'Colombie-Britannique',
    'bc': 'Colombie-Britannique',
    'cb': 'Colombie-Britannique',
    'b.c.': 'Colombie-Britannique',
    
    // Alberta variations → Alberta (same in French)
    'alberta': 'Alberta',
    'ab': 'Alberta',
    'alta': 'Alberta',
    'alb': 'Alberta',
    
    // Manitoba variations → Manitoba (same in French)
    'manitoba': 'Manitoba',
    'mb': 'Manitoba',
    'man': 'Manitoba',
    
    // Saskatchewan variations → Saskatchewan (same in French)
    'saskatchewan': 'Saskatchewan',
    'sk': 'Saskatchewan',
    'sask': 'Saskatchewan',
    
    // Nova Scotia variations → Nouvelle-Écosse
    'nova scotia': 'Nouvelle-Écosse',
    'nouvelle-écosse': 'Nouvelle-Écosse',
    'nouvelle-ecosse': 'Nouvelle-Écosse',
    'nouvelle ecosse': 'Nouvelle-Écosse',
    'ns': 'Nouvelle-Écosse',
    'n.s.': 'Nouvelle-Écosse',
    'ne': 'Nouvelle-Écosse',
    
    // New Brunswick variations → Nouveau-Brunswick
    'new brunswick': 'Nouveau-Brunswick',
    'nouveau-brunswick': 'Nouveau-Brunswick',
    'nouveau brunswick': 'Nouveau-Brunswick',
    'nb': 'Nouveau-Brunswick',
    'n.b.': 'Nouveau-Brunswick',
    
    // Prince Edward Island variations → Île-du-Prince-Édouard
    'prince edward island': 'Île-du-Prince-Édouard',
    'île-du-prince-édouard': 'Île-du-Prince-Édouard',
    'ile-du-prince-edouard': 'Île-du-Prince-Édouard',
    'ile du prince edouard': 'Île-du-Prince-Édouard',
    'pei': 'Île-du-Prince-Édouard',
    'pe': 'Île-du-Prince-Édouard',
    'p.e.i.': 'Île-du-Prince-Édouard',
    'ipe': 'Île-du-Prince-Édouard',
    'i.p.e.': 'Île-du-Prince-Édouard',
    
    // Newfoundland and Labrador variations → Terre-Neuve-et-Labrador
    'newfoundland and labrador': 'Terre-Neuve-et-Labrador',
    'newfoundland': 'Terre-Neuve-et-Labrador',
    'terre-neuve-et-labrador': 'Terre-Neuve-et-Labrador',
    'terre-neuve': 'Terre-Neuve-et-Labrador',
    'terre neuve et labrador': 'Terre-Neuve-et-Labrador',
    'terre neuve': 'Terre-Neuve-et-Labrador',
    'nl': 'Terre-Neuve-et-Labrador',
    'nf': 'Terre-Neuve-et-Labrador',
    'nfld': 'Terre-Neuve-et-Labrador',
    't.n.l.': 'Terre-Neuve-et-Labrador',
    
    // Yukon variations → Yukon (same in French)
    'yukon': 'Yukon',
    'yt': 'Yukon',
    
    // Northwest Territories variations → Territoires du Nord-Ouest
    'northwest territories': 'Territoires du Nord-Ouest',
    'territoires du nord-ouest': 'Territoires du Nord-Ouest',
    'territoires du nord ouest': 'Territoires du Nord-Ouest',
    'nt': 'Territoires du Nord-Ouest',
    'nwt': 'Territoires du Nord-Ouest',
    'tno': 'Territoires du Nord-Ouest',
    't.n.o.': 'Territoires du Nord-Ouest',
    
    // Nunavut variations → Nunavut (same in French)
    'nunavut': 'Nunavut',
    'nu': 'Nunavut'
};

// Function to normalize province to French
function normalizeToFrench(text) {
    if (!text) return null;
    
    let normalized = text.toLowerCase().trim();
    
    // Direct match
    if (PROVINCE_TO_FRENCH[normalized]) {
        return PROVINCE_TO_FRENCH[normalized];
    }
    
    return null;
}

// Array to store updates
let updates = [];
let stats = {
    normalized: 0,
    alreadyCorrect: 0,
    unrecognized: 0,
    empty: 0
};

let unrecognizedValues = new Set();

// Process each record
for (let record of query.records) {
    let provinceValue = record.getCellValue("Province");
    
    if (!provinceValue) {
        stats.empty++;
        continue;
    }
    
    if (typeof provinceValue !== 'string') {
        stats.empty++;
        continue;
    }
    
    // Try to normalize to French
    let frenchProvince = normalizeToFrench(provinceValue);
    
    if (frenchProvince) {
        // Check if it's already the correct French value
        if (provinceValue === frenchProvince) {
            stats.alreadyCorrect++;
        } else {
            // Needs normalization
            updates.push({
                id: record.id,
                fields: {
                    "Province": frenchProvince
                }
            });
            stats.normalized++;
        }
    } else {
        // Unrecognized value
        stats.unrecognized++;
        unrecognizedValues.add(provinceValue);
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
    console.log(`✓ Provinces normalized to French: ${stats.normalized}`);
    console.log(`✓ Already in correct format: ${stats.alreadyCorrect}`);
    console.log(`- Empty Province fields: ${stats.empty}`);
    console.log(`⚠ Unrecognized values: ${stats.unrecognized}`);
    
    if (unrecognizedValues.size > 0) {
        console.log("\nUnrecognized province values found:");
        unrecognizedValues.forEach(value => {
            console.log(`  - "${value}"`);
        });
    }
    
    console.log("\n=== French Province Names for Single Select ===");
    console.log("Use these values when creating your single select field:");
    console.log("1. Québec");
    console.log("2. Ontario");
    console.log("3. Colombie-Britannique");
    console.log("4. Alberta");
    console.log("5. Manitoba");
    console.log("6. Saskatchewan");
    console.log("7. Nouvelle-Écosse");
    console.log("8. Nouveau-Brunswick");
    console.log("9. Île-du-Prince-Édouard");
    console.log("10. Terre-Neuve-et-Labrador");
    console.log("11. Yukon");
    console.log("12. Territoires du Nord-Ouest");
    console.log("13. Nunavut");
    
} else {
    console.log("No records needed updating");
    console.log(`\nRecords checked: ${query.records.length}`);
    console.log(`✓ Already in correct format: ${stats.alreadyCorrect}`);
    console.log(`- Empty Province fields: ${stats.empty}`);
    
    if (stats.unrecognized > 0) {
        console.log(`⚠ Unrecognized values: ${stats.unrecognized}`);
        console.log("\nUnrecognized province values found:");
        unrecognizedValues.forEach(value => {
            console.log(`  - "${value}"`);
        });
    }
}