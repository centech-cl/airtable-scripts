let settings = input.config({
    title: 'Claude API Configuration',
    items: [
        input.config.text('apiKey', {
            label: 'Anthropic API Key',
            description: 'Your Anthropic API key for searching LinkedIn URLs'
        })
    ]
});

let table = base.getTable("master");
let queryResult = await table.selectRecordsAsync({
    fields: ["Name", "Site Web", "URL LinkedIn Company"]
}); 

console.log(`Found ${queryResult.records.length} total records`);

// Filter records that need LinkedIn URL
let recordsToProcess = queryResult.records.filter(record => {
    let name = record.getCellValue("Name");
    let website = record.getCellValue("Site Web");
    let linkedinUrl = record.getCellValue("URL LinkedIn Company");
    
    // Skip if LinkedIn URL already exists
    if (linkedinUrl && linkedinUrl.trim()) {
        return false;
    }
    
    // Only process if we have at least a name or website to search with
    if ((!name || !name.trim()) && (!website || !website.trim())) {
        return false;
    }
    
    return true;
});

console.log(`Processing ${recordsToProcess.length} records (searching for LinkedIn URLs)`);

for (let i = 0; i < recordsToProcess.length; i++) {
    let record = recordsToProcess[i];
    let recordId = record.id;
    let name = record.getCellValue("Name");
    let website = record.getCellValue("Site Web");
    
    console.log(`\n--- Processing record ${i + 1}/${recordsToProcess.length} (ID: ${recordId}) ---`);
    console.log(`Company: ${name || "(no name)"}`);
    console.log(`Website: ${website || "(no website)"}`);
    
    let nameContent = name ? name.trim() : "";
    let websiteContent = website ? website.trim() : "";
    
    let prompt = `Find the official LinkedIn company page for this organization. I need the exact LinkedIn URL in the format: https://www.linkedin.com/company/[company-slug]

Company Name: ${nameContent || "(not provided)"}
Company Website: ${websiteContent || "(not provided)"}

Please search for the company's LinkedIn page and return the official URL. The URL must:
- Be the company page (not a personal profile)
- Follow the format: https://www.linkedin.com/company/[slug]
- Be verified as the correct company by cross-referencing with the website and name

If you cannot find a valid LinkedIn company page with high confidence, indicate that no URL was found.`;

    try {
        let response = await remoteFetchAsync('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': settings.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 4096,
                tools: [
                    {
                        name: "web_search",
                        type: "web_search_20241018"
                    },
                    {
                        name: "report_linkedin_url",
                        description: "Report the found LinkedIn company URL or indicate none was found",
                        input_schema: {
                            type: "object",
                            properties: {
                                found: {
                                    type: "boolean",
                                    description: "Whether a valid LinkedIn company URL was found"
                                },
                                linkedin_url: {
                                    type: "string",
                                    description: "The LinkedIn company URL in format: https://www.linkedin.com/company/[slug]. Empty string if not found."
                                },
                                confidence: {
                                    type: "string",
                                    enum: ["high", "medium", "low"],
                                    description: "Confidence level that this is the correct company"
                                },
                                explanation: {
                                    type: "string",
                                    description: "Brief explanation of how the URL was found or why it wasn't found"
                                }
                            },
                            required: ["found", "linkedin_url", "confidence", "explanation"]
                        }
                    }
                ],
                messages: [
                    { role: 'user', content: prompt }
                ]
            })
        });

        let result = await response.json();
        
        console.log("API Response received");
        
        // Look for the report_linkedin_url tool use in the response
        if (result.content) {
            let reportTool = result.content.find(block => 
                block.type === "tool_use" && block.name === "report_linkedin_url"
            );
            
            if (reportTool && reportTool.input) {
                let analysis = reportTool.input;
                
                console.log(`Found: ${analysis.found}`);
                console.log(`Confidence: ${analysis.confidence}`);
                console.log(`Explanation: ${analysis.explanation}`);
                
                // Update record if a LinkedIn URL was found with high confidence
                if (analysis.found && analysis.linkedin_url && analysis.confidence === "high") {
                    // Validate the URL format
                    let urlPattern = /^https:\/\/www\.linkedin\.com\/company\/[a-zA-Z0-9-]+\/?$/;
                    
                    if (urlPattern.test(analysis.linkedin_url)) {
                        await table.updateRecordAsync(recordId, {
                            "URL LinkedIn Company": analysis.linkedin_url
                        });
                        console.log(`✓ LinkedIn URL added: ${analysis.linkedin_url}`);
                    } else {
                        console.log(`⚠ URL format invalid: ${analysis.linkedin_url}`);
                    }
                } else if (analysis.found && analysis.confidence === "medium") {
                    console.log(`⚠ Found URL but confidence is medium: ${analysis.linkedin_url}`);
                    console.log(`  Consider manual verification`);
                } else {
                    console.log(`○ No LinkedIn URL found for this company`);
                }
            } else {
                console.log("⚠ No report tool found in response");
            }
        }
        
        // Rate limiting delay (2 seconds between requests to avoid overwhelming the API)
        if (i < recordsToProcess.length - 1) {
            console.log("Waiting 2 seconds before next request...");
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
    } catch (error) {
        console.error(`✗ Error processing record ${recordId}:`, error);
        if (error.message) {
            console.error(`  Error details: ${error.message}`);
        }
        // Continue with next record
    }
}

console.log(`\n✓ Finished processing ${recordsToProcess.length} records`);