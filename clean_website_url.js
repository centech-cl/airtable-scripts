// Airtable script to clean and standardize the "Site Web" field
// Ensures consistent format: https://domain.com (no www, no trailing slash, no paths)

let table = base.getTable("master");
let query = await table.selectRecordsAsync({fields: ["Name", "Site Web"]});

// Helper function to clean and standardize URL
function cleanUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    let cleaned = url.trim();
    
    // Skip if empty
    if (cleaned === '') return null;
    
    // Remove common prefixes that aren't part of the URL
    cleaned = cleaned.replace(/^(url:|website:|site:|web:)/i, '').trim();
    
    // Add https:// if no protocol
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
        cleaned = 'https://' + cleaned;
    }
    
    // Force https (convert http to https)
    cleaned = cleaned.replace(/^http:\/\//i, 'https://');
    
    try {
        let urlObj = new URL(cleaned);
        
        // Remove www. subdomain
        let hostname = urlObj.hostname.toLowerCase();
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }
        
        // Keep only protocol and hostname (remove paths, query params, fragments)
        // This gives us the clean domain: https://domain.com
        let cleanedUrl = `https://${hostname}`;
        
        // Remove trailing slash
        cleanedUrl = cleanedUrl.replace(/\/$/, '');
        
        return cleanedUrl;
        
    } catch (e) {
        // If URL parsing fails, return null
        console.log(`   ⚠️ Invalid URL format: "${cleaned}"`);
        return null;
    }
}

// Helper function to validate if URL looks reasonable
function isValidUrl(url) {
    if (!url) return false;
    
    try {
        let urlObj = new URL(url);
        let hostname = urlObj.hostname;
        
        // Must have at least one dot (domain.extension)
        if (!hostname.includes('.')) return false;
        
        // Must have a valid TLD (at least 2 characters after last dot)
        let parts = hostname.split('.');
        let tld = parts[parts.length - 1];
        if (tld.length < 2) return false;
        
        // Should not be localhost or IP address patterns
        if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            return false;
        }
        
        return true;
        
    } catch (e) {
        return false;
    }
}

// Main processing
let updates = [];
let stats = {
    cleaned: 0,
    alreadyClean: 0,
    invalid: 0,
    empty: 0
};

let invalidUrls = [];

console.log("Starting Site Web field cleaning...\n");
console.log("Standard format: https://domain.com");
console.log("- Force HTTPS");
console.log("- Remove www");
console.log("- Remove paths/query params");
console.log("- Remove trailing slash\n");

for (let [index, record] of query.records.entries()) {
    let nameValue = record.getCellValue("Name");
    let siteWebValue = record.getCellValue("Site Web");
    
    // Extract values
    // Name might be Single Select or text
    let companyName = (nameValue && typeof nameValue === 'object' && nameValue.name) ? nameValue.name : nameValue;
    // Site Web is a URL field, which returns a string directly
    let websiteUrl = siteWebValue;
    
    console.log(`\n[${index + 1}/${query.records.length}] ${companyName || 'Unknown'}`);
    
    // Skip if empty
    if (!websiteUrl || websiteUrl.trim() === '') {
        stats.empty++;
        console.log(`   - Empty Site Web field`);
        continue;
    }
    
    console.log(`   Original: ${websiteUrl}`);
    
    // Clean the URL
    let cleanedUrl = cleanUrl(websiteUrl);
    
    if (!cleanedUrl || !isValidUrl(cleanedUrl)) {
        stats.invalid++;
        console.log(`   ✗ Invalid URL - needs manual review`);
        invalidUrls.push({
            company: companyName || 'Unknown',
            original: websiteUrl,
            recordId: record.id
        });
        continue;
    }
    
    console.log(`   Cleaned:  ${cleanedUrl}`);
    
    // Check if it needs updating
    if (websiteUrl === cleanedUrl) {
        stats.alreadyClean++;
        console.log(`   ✓ Already in correct format`);
    } else {
        updates.push({
            id: record.id,
            fields: {
                "Site Web": cleanedUrl
            }
        });
        stats.cleaned++;
        console.log(`   ✓ Will be cleaned`);
    }
}

// Update records in batches of 50
if (updates.length > 0) {
    console.log(`\n\nUpdating ${updates.length} records...`);
    
    while (updates.length > 0) {
        let batch = updates.slice(0, 50);
        await table.updateRecordsAsync(batch);
        updates = updates.slice(50);
    }
    
    console.log("\n=== Update Complete ===");
    console.log(`✓ URLs cleaned and standardized: ${stats.cleaned}`);
    console.log(`✓ Already in correct format: ${stats.alreadyClean}`);
    console.log(`- Empty Site Web fields: ${stats.empty}`);
    console.log(`⚠ Invalid URLs (need manual review): ${stats.invalid}`);
    
    if (invalidUrls.length > 0) {
        console.log("\n=== Invalid URLs - Manual Review Needed ===");
        invalidUrls.forEach(item => {
            console.log(`⚠ ${item.company}`);
            console.log(`  Original: "${item.original}"`);
            console.log(`  Record ID: ${item.recordId}`);
        });
    }
    
} else {
    console.log("\n=== No Updates Needed ===");
    console.log(`✓ Already in correct format: ${stats.alreadyClean}`);
    console.log(`- Empty Site Web fields: ${stats.empty}`);
    
    if (stats.invalid > 0) {
        console.log(`⚠ Invalid URLs (need manual review): ${stats.invalid}`);
        console.log("\n=== Invalid URLs - Manual Review Needed ===");
        invalidUrls.forEach(item => {
            console.log(`⚠ ${item.company}`);
            console.log(`  Original: "${item.original}"`);
            console.log(`  Record ID: ${item.recordId}`);
        });
    }
}

console.log("\n=== Recommended Format ===");
console.log("✓ https://domain.com");
console.log("✓ https://subdomain.domain.com");
console.log("✗ http://domain.com (will be converted to https)");
console.log("✗ www.domain.com (www will be removed)");
console.log("✗ https://domain.com/about (path will be removed)");
console.log("✗ https://domain.com/ (trailing slash will be removed)");