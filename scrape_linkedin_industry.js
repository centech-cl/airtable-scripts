// LinkedIn Company Industry Extractor for Airtable - Enhanced Version
// Processes records and provides clear guidance on missing industry options

// Prompt user for LinkedIn cookie using config
let settings = input.config({
    title: '🔑 LinkedIn Authentication & Settings',
    description: 'Configure LinkedIn authentication and processing options',
    items: [
        input.config.text('linkedinCookie', {
            label: 'LinkedIn Cookie (li_at)',
            description: 'Go to linkedin.com → F12 → Application → Cookies → Copy "li_at" value'
        }),
        input.config.select('mode', {
            label: 'Processing Mode',
            description: 'Choose whether to process one or multiple records',
            options: [
                { label: 'Single Record (Test)', value: 'single' },
                { label: 'All Records', value: 'all' }
            ]
        })
    ]
});

const linkedinCookie = settings.linkedinCookie;
const processingMode = settings.mode;

if (!linkedinCookie) {
    console.log('❌ Error: LinkedIn cookie is required.');
    throw new Error('LinkedIn cookie not provided');
}

// Get the table and records
let table = base.getTable('master');
let records = await table.selectRecordsAsync({
    fields: ['URL LinkedIn Company', 'Industry']
});

console.log(`📊 Found ${records.records.length} total records`);
console.log('---');

// Get existing industry options
let industryField = table.getField('Industry');
let existingOptions = industryField.options.choices.map(choice => choice.name);
console.log(`📋 Existing industry options (${existingOptions.length}): ${existingOptions.join(', ')}`);
console.log('---\n');

let processedCount = 0;
let successCount = 0;
let errorCount = 0;
let skippedCount = 0;

// Find records to process
let recordsToProcess = [];
for (let record of records.records) {
    let linkedinUrl = record.getCellValue('URL LinkedIn Company');
    let existingIndustry = record.getCellValue('Industry');
    
    if (linkedinUrl && !existingIndustry) {
        recordsToProcess.push(record);
        if (processingMode === 'single') break; // Only one record in single mode
    }
}

if (recordsToProcess.length === 0) {
    console.log('⏭️ No records found that need industry extraction');
    console.log('All records either have no LinkedIn URL or already have an industry set.');
    console.log('\n✨ Done!');
    throw new Error('No suitable records found');
}

console.log(`🎯 Will process ${recordsToProcess.length} record(s)\n`);

// Process each record
for (let record of recordsToProcess) {
    let linkedinUrl = record.getCellValue('URL LinkedIn Company');
    
    try {
        processedCount++;
        console.log(`\n📊 Processing record ${processedCount}/${recordsToProcess.length}`);
        console.log(`🔗 URL: ${linkedinUrl}`);
        
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
        
        // Extract industry from h2 tag with class "top-card-layout__headline"
        // Example: <h2 class="top-card-layout__headline ...">Automation Machinery Manufacturing</h2>
        let industryMatch = html.match(/<h2[^>]*class="[^"]*top-card-layout__headline[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
        
        if (!industryMatch) {
            throw new Error('Industry h2 tag not found in HTML - page structure may have changed');
        }
        
        // Extract text content and clean up whitespace
        let industry = industryMatch[1]
            .replace(/<[^>]*>/g, '')  // Remove any nested HTML tags
            .replace(/\s+/g, ' ')      // Normalize whitespace
            .trim();                    // Remove leading/trailing spaces
        
        if (!industry) {
            throw new Error('Industry not found in LinkedIn page data');
        }
        
        console.log(`✅ Found industry: "${industry}"`);
        
        // Check if industry exists as an option
        let industryField = table.getField('Industry');
        let existingOptions = industryField.options.choices.map(choice => choice.name);
        
        if (!existingOptions.includes(industry)) {
            console.log(`📝 Adding new industry option: "${industry}"`);
            
            // Create updated choices array with the new industry
            let updatedChoices = [
                ...industryField.options.choices,
                { name: industry }
            ];
            
            // Update the field options
            await industryField.updateOptionsAsync({
                choices: updatedChoices
            });
            
            console.log(`✅ Industry option added!`);
            
            // Refresh the existing options list for next iteration
            existingOptions.push(industry);
        } else {
            console.log(`✓ Industry already exists in options`);
        }
        
        // Update the record
        await table.updateRecordAsync(record.id, {
            'Industry': { name: industry }
        });
        
        console.log(`💾 Industry saved to record!`);
        successCount++;
        
        // Add a delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        errorCount++;
    }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📈 SUMMARY:');
console.log('='.repeat(50));
console.log(`✅ Successfully processed: ${successCount}`);
console.log(`❌ Errors: ${errorCount}`);
console.log(`📊 Total processed: ${processedCount}`);

console.log('\n✨ Done!');