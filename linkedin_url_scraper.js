// Airtable script to scrape LinkedIn URLs from company websites
// Fetches the "Site Web" URL and looks for LinkedIn links in the HTML

let table = base.getTable("MDSS - CAN");
let query = await table.selectRecordsAsync({fields: ["Name", "website", "linkedin"]});

// Configuration
const REQUEST_DELAY = 15; // 1.5 second delay between requests to be respectful

// Helper function to delay execution
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to normalize URLs
function normalizeUrl(url) {
    if (!url) return null;
    
    try {
        // Ensure URL has protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        return url;
    } catch (e) {
        return null;
    }
}

// Helper function to extract LinkedIn URLs from HTML
function extractLinkedInUrls(html) {
    if (!html) return [];
    
    let linkedInUrls = new Set();
    
    // Regex patterns to find LinkedIn company URLs
    const patterns = [
        // Standard LinkedIn company URLs
        /https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9\-_]+/gi,
        // LinkedIn URLs with additional paths
        /https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9\-_]+\/[^"\s<>]*/gi,
        // Relative or shortened versions
        /linkedin\.com\/company\/[a-zA-Z0-9\-_]+/gi
    ];
    
    // Apply each pattern
    patterns.forEach(pattern => {
        let matches = html.match(pattern);
        if (matches) {
            matches.forEach(match => {
                // Normalize the URL
                let url = match;
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                
                // Clean up the URL (remove trailing punctuation, quotes, etc.)
                url = url.replace(/["'>]+$/, '');
                url = url.split('?')[0]; // Remove query parameters
                url = url.replace(/\/$/, ''); // Remove trailing slash
                
                // Only add if it's a company page (not personal profile)
                if (url.includes('/company/')) {
                    linkedInUrls.add(url);
                }
            });
        }
    });
    
    return Array.from(linkedInUrls);
}

// Function to fetch website and extract LinkedIn URLs
async function fetchLinkedInFromWebsite(websiteUrl) {
    if (!websiteUrl) return null;
    
    let normalizedUrl = normalizeUrl(websiteUrl);
    if (!normalizedUrl) return null;
    
    // Try fetching the URL, and if it fails, try with www
    let urlsToTry = [normalizedUrl];
    
    // If URL doesn't have www, also try with www
    if (!normalizedUrl.includes('://www.')) {
        let withWww = normalizedUrl.replace('://', '://www.');
        urlsToTry.push(withWww);
    }
    
    for (let tryUrl of urlsToTry) {
        try {
            // Fetch the website - Airtable's remoteFetchAsync doesn't follow redirects automatically
            let response = await remoteFetchAsync(tryUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            // Check if it's a redirect (301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                // Try to get the Location header for the redirect
                let location = response.headers.get('location');
                if (location) {
                    console.log(`   🔄 Redirect to: ${location}`);
                    // Make location absolute if it's relative
                    if (location.startsWith('/')) {
                        let urlObj = new URL(tryUrl);
                        location = `${urlObj.protocol}//${urlObj.host}${location}`;
                    }
                    // Try fetching the redirect location
                    try {
                        let redirectResponse = await remoteFetchAsync(location, {
                            method: 'GET',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        });
                        
                        if (redirectResponse.ok) {
                            let html = await redirectResponse.text();
                            let linkedInUrls = extractLinkedInUrls(html);
                            if (linkedInUrls.length > 0) {
                                console.log(`   ✓ Found LinkedIn after redirect`);
                                return linkedInUrls[0];
                            }
                        }
                    } catch (redirectError) {
                        console.log(`   ⚠️ Error following redirect: ${redirectError.message}`);
                    }
                }
                // Continue to next URL variant if redirect handling failed
                continue;
            }
            
            if (!response.ok) {
                console.log(`   ⚠️ Failed to fetch ${tryUrl}: HTTP ${response.status}`);
                continue; // Try next URL
            }
            
            // Get HTML content
            let html = await response.text();
            
            // Extract LinkedIn URLs
            let linkedInUrls = extractLinkedInUrls(html);
            
            if (linkedInUrls.length > 0) {
                // Return the first LinkedIn URL found
                console.log(`   ✓ Found LinkedIn URL`);
                return linkedInUrls[0];
            }
            
            // Found no LinkedIn URLs but page loaded successfully
            return null;
            
        } catch (error) {
            console.log(`   ⚠️ Error fetching ${tryUrl}: ${error.message}`);
            // Continue to try next URL variant
        }
    }
    
    return null;
}

// Main processing
let updates = [];
let stats = {
    found: 0,
    notFound: 0,
    alreadyHasLinkedIn: 0,
    skipped: 0,
    errors: 0
};

let results = [];

console.log("Starting LinkedIn URL scraping from websites...\n");

// Process all records (or limit for testing)
let recordsToProcess = query.records; // Change to .slice(0, 10) to test with 10 records

for (let [index, record] of recordsToProcess.entries()) {
    let nameValue = record.getCellValue("Name");
    let siteWebValue = record.getCellValue("website");
    let linkedInValue = record.getCellValue("linkedin");
    
    // Extract values
    // Name might be Single Select or text
    let companyName = (nameValue && typeof nameValue === 'object' && nameValue.name) ? nameValue.name : nameValue;
    // Site Web and URL LinkedIn are URL fields, which return strings directly
    let websiteUrl = siteWebValue;
    let existingLinkedIn = linkedInValue;
    
    console.log(`\n[${index + 1}/${recordsToProcess.length}] Processing: ${companyName || 'Unknown'}`);
    
    // Skip if no website
    if (!websiteUrl || websiteUrl.trim() === '') {
        stats.skipped++;
        console.log(`   ⊘ Skipped - no website URL`);
        continue;
    }
    
    // Skip if already has LinkedIn URL
    if (existingLinkedIn && existingLinkedIn.trim() !== '') {
        stats.alreadyHasLinkedIn++;
        console.log(`   ⊘ Skipped - already has LinkedIn URL`);
        continue;
    }
    
    console.log(`   🔍 Scraping: ${websiteUrl}`);
    
    // Fetch and scrape for LinkedIn URL
    let foundLinkedIn = await fetchLinkedInFromWebsite(websiteUrl);
    
    if (foundLinkedIn) {
        console.log(`   ✓ Found: ${foundLinkedIn}`);
        
        updates.push({
            id: record.id,
            fields: {
                "linkedin": foundLinkedIn
            }
        });
        
        results.push({
            company: companyName || 'Unknown',
            website: websiteUrl,
            linkedIn: foundLinkedIn,
            status: "✓ Found"
        });
        
        stats.found++;
    } else {
        console.log(`   ✗ No LinkedIn URL found on website`);
        stats.notFound++;
        
        results.push({
            company: companyName || 'Unknown',
            website: websiteUrl,
            linkedIn: "Not found",
            status: "✗ Not found"
        });
    }
    
    // Delay between requests to be respectful to websites
    if (index < recordsToProcess.length - 1) {
        await delay(REQUEST_DELAY);
    }
}

// Update records in batches of 50
if (updates.length > 0) {
    console.log(`\n\nUpdating ${updates.length} records in Airtable...`);
    
    while (updates.length > 0) {
        let batch = updates.slice(0, 50);
        await table.updateRecordsAsync(batch);
        updates = updates.slice(50);
    }
    
    console.log("\n=== Update Complete ===");
    console.log(`✓ LinkedIn URLs found and added: ${stats.found}`);
    console.log(`✗ Not found on website: ${stats.notFound}`);
    console.log(`⊘ Already had LinkedIn URL: ${stats.alreadyHasLinkedIn}`);
    console.log(`- Skipped (no website): ${stats.skipped}`);
    
    console.log("\n=== Successfully Added LinkedIn URLs ===");
    results.filter(r => r.status === "✓ Found").forEach(r => {
        console.log(`✓ ${r.company}`);
        console.log(`  ${r.linkedIn}`);
    });
    
    if (stats.notFound > 0) {
        console.log("\n=== Companies Without LinkedIn on Website ===");
        results.filter(r => r.status === "✗ Not found").forEach(r => {
            console.log(`✗ ${r.company} (${r.website})`);
        });
    }
    
} else {
    console.log("\n=== No Updates Made ===");
    console.log(`⊘ Already had LinkedIn URL: ${stats.alreadyHasLinkedIn}`);
    console.log(`✗ Not found on website: ${stats.notFound}`);
    console.log(`- Skipped (no website): ${stats.skipped}`);
}