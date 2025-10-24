let settings = input.config({
    title: 'Claude API Configuration',
    items: [
        input.config.text('apiKey', {
            label: 'Anthropic API Key',
            description: 'Your Anthropic API key'
        })
    ]
});

let table = base.getTable("master");
let queryResult = await table.selectRecordsAsync({fields: ["Description - EN", "Description - FR"]}); 

console.log(`Found ${queryResult.records.length} total records`);

// Filter records that need processing
let recordsToProcess = queryResult.records.filter(record => {
    let descEN = record.getCellValue("Description - EN");
    let descFR = record.getCellValue("Description - FR");
    
    // Skip if both are empty
    if ((!descEN || !descEN.trim()) && (!descFR || !descFR.trim())) {
        return false;
    }
    
    // Skip if both are populated (assume they're correct)
    if (descEN && descEN.trim() && descFR && descFR.trim()) {
        return false;
    }
    
    return true;
});

console.log(`Processing ${recordsToProcess.length} records (skipping records with both fields populated)`);

for (let i = 0; i < recordsToProcess.length; i++) {
    let record = recordsToProcess[i];
    let recordId = record.id;
    let descEN = record.getCellValue("Description - EN");
    let descFR = record.getCellValue("Description - FR");
    
    console.log(`\n--- Processing record ${i + 1}/${recordsToProcess.length} (ID: ${recordId}) ---`);
    
    // Prepare content strings (handle null values)
    let enContent = descEN ? descEN.trim() : "";
    let frContent = descFR ? descFR.trim() : "";
    
    let prompt = `You are helping to maintain a bilingual database. Analyze these description fields and fix any issues.

EN Field: ${enContent || "(empty)"}
FR Field: ${frContent || "(empty)"}

Rules:
- Content should ONLY be in English or French (no other languages)
- EN field must contain English text
- FR field must contain French text
- If a field contains text in the wrong language, it needs to be moved to the correct field
- Provide translations for empty fields

Actions explained:
- translate_en_to_fr: EN has English, FR is empty → translate EN to French
- translate_fr_to_en: FR has French, EN is empty → translate FR to English  
- swap_and_translate_en: EN has French → move to FR field, translate to English for EN
- swap_and_translate_fr: FR has English → move to EN field, translate to French for FR
- skip: no action needed`;

    try {
        let response = await remoteFetchAsync('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': settings.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 2048,
                tools: [
                    {
                        name: "analyze_translations",
                        description: "Analyze and fix language mismatches in bilingual description fields",
                        input_schema: {
                            type: "object",
                            properties: {
                                en_detected_language: {
                                    type: "string",
                                    enum: ["english", "french", "empty"],
                                    description: "The actual language detected in the EN field"
                                },
                                fr_detected_language: {
                                    type: "string",
                                    enum: ["english", "french", "empty"],
                                    description: "The actual language detected in the FR field"
                                },
                                action: {
                                    type: "string",
                                    enum: ["translate_en_to_fr", "translate_fr_to_en", "swap_and_translate_en", "swap_and_translate_fr", "skip"],
                                    description: "The action to take to fix the fields"
                                },
                                new_en: {
                                    type: "string",
                                    description: "The corrected or translated English text for the EN field"
                                },
                                new_fr: {
                                    type: "string",
                                    description: "The corrected or translated French text for the FR field"
                                },
                                explanation: {
                                    type: "string",
                                    description: "Brief explanation of what was done"
                                }
                            },
                            required: ["en_detected_language", "fr_detected_language", "action", "new_en", "new_fr", "explanation"]
                        }
                    }
                ],
                tool_choice: {
                    type: "tool",
                    name: "analyze_translations"
                },
                messages: [
                    { role: 'user', content: prompt }
                ]
            })
        });

        let result = await response.json();
        
        console.log("API Response:", JSON.stringify(result, null, 2));
        
        // Extract tool use from response
        if (result.content) {
            let toolUse = result.content.find(block => block.type === "tool_use");
            
            if (toolUse && toolUse.input) {
                let analysis = toolUse.input;
                
                console.log(`Detected - EN: ${analysis.en_detected_language}, FR: ${analysis.fr_detected_language}`);
                console.log(`Action: ${analysis.action}`);
                console.log(`Explanation: ${analysis.explanation}`);
                
                // Prepare update object
                let updateFields = {};
                
                // Determine what to update based on Claude's analysis
                if (analysis.action !== "skip") {
                    // Always update both fields to ensure consistency
                    if (analysis.new_en) {
                        updateFields["Description - EN"] = analysis.new_en;
                    }
                    
                    if (analysis.new_fr) {
                        updateFields["Description - FR"] = analysis.new_fr;
                    }
                }
                
                // Update the record if needed
                if (Object.keys(updateFields).length > 0) {
                    await table.updateRecordAsync(recordId, updateFields);
                    console.log("✓ Record updated successfully");
                    if (updateFields["Description - EN"]) {
                        console.log(`  EN: ${updateFields["Description - EN"].substring(0, 80)}...`);
                    }
                    if (updateFields["Description - FR"]) {
                        console.log(`  FR: ${updateFields["Description - FR"].substring(0, 80)}...`);
                    }
                } else {
                    console.log("○ No updates needed");
                }
            }
        }
        
        // Rate limiting delay (1 second between requests)
        if (i < recordsToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
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