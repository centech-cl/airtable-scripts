// LinkedIn Company Logo Extractor for Airtable
// Processes all records with valid LinkedIn URLs

// Prompt user for LinkedIn cookie using config
let settings = input.config({
    title: '🔑 LinkedIn Authentication',
    description: 'Enter your LinkedIn session cookie to extract company logo',
    items: [
        input.config.text('linkedinCookie', {
            label: 'LinkedIn Cookie (li_at)',
            description: 'Go to linkedin.com → F12 → Application → Cookies → Copy "li_at" value'
        })
    ]
});

const linkedinCookie = settings.linkedinCookie;

if (!linkedinCookie) {
    console.log('❌ Error: LinkedIn cookie is required.');
    throw new Error('LinkedIn cookie not provided');
}

// Get the table and all records
let table = base.getTable('master');
let records = await table.selectRecordsAsync({
    fields: ['URL LinkedIn Company', 'Logo']
});

console.log(`📊 Found ${records.records.length} total records`);
console.log('---');

let processedCount = 0;
let successCount = 0;
let errorCount = 0;
let skippedCount = 0;

// Process each record
for (let record of records.records) {
    let linkedinUrl = record.getCellValue('URL LinkedIn Company');
    let existingLogo = record.getCellValue('Logo');
    
    // Skip if no LinkedIn URL
    if (!linkedinUrl) {
        console.log(`⏭️ Skipping record ${record.id}: No LinkedIn URL`);
        skippedCount++;
        continue;
    }
    
    // Skip if logo already exists
    if (existingLogo && existingLogo.length > 0) {
        console.log(`⏭️ Skipping record ${record.id}: Logo already exists`);
        skippedCount++;
        continue;
    }
    
    try {
        processedCount++;
        console.log(`\n📊 Processing record ${processedCount}: ${linkedinUrl}`);
        
        // Fetch the LinkedIn company page
        let response = await remoteFetchAsync(linkedinUrl, {
            headers: {
                'Cookie': `li_at=${linkedinCookie}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        let html = await response.text();
        
        // Extract logo URL from JSON-LD structured data
        let jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        
        if (!jsonLdMatch) {
            throw new Error('JSON-LD script tag not found in HTML');
        }
        
        let jsonData = JSON.parse(jsonLdMatch[1]);
        
        // Navigate to the logo contentUrl
        let logoUrl = null;
        
        if (jsonData['@graph'] && Array.isArray(jsonData['@graph'])) {
            // Look for Organization type in the graph
            let orgData = jsonData['@graph'].find(item => item['@type'] === 'Organization');
            if (orgData && orgData.logo && orgData.logo.contentUrl) {
                logoUrl = orgData.logo.contentUrl;
            }
        } else if (jsonData.logo && jsonData.logo.contentUrl) {
            logoUrl = jsonData.logo.contentUrl;
        }
        
        if (!logoUrl) {
            throw new Error('Logo URL not found in JSON-LD data');
        }
        
        console.log(`✅ Found logo: ${logoUrl.substring(0, 80)}...`);
        
        // Extract company name for filename
        let companyName = linkedinUrl.split('/company/')[1]?.split('/')[0] || 'company';
        
        // Update the record with the logo
        await table.updateRecordAsync(record.id, {
            'logo': [{ url: logoUrl, filename: `${companyName}_logo.jpg` }]
        });
        
        console.log(`💾 Logo saved successfully!`);
        successCount++;
        
        // Add a delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        errorCount++;
    }
}

// Summary
console.log('\n---');
console.log('📈 Summary:');
console.log(`- Total records: ${records.records.length}`);
console.log(`- Processed: ${processedCount}`);
console.log(`- Success: ${successCount} ✅`);
console.log(`- Errors: ${errorCount} ❌`);
console.log(`- Skipped: ${skippedCount} ⏭️`);
console.log('\n✨ Done!');