let settings = input.config({
    title: 'Claude API Configuration',
    items: [
        input.config.text('apiKey', {
            label: 'Anthropic API Key',
            description: 'Your Anthropic API key'
        })
    ]
});

// Show the ID of a table:
let table = base.getTable("master");
let queryResult = await table.selectRecordsAsync({fields: ["Description - EN"]}); 
let record = queryResult.records[1];
let recordId= record.id;
let description = record.getCellValue("Description - EN")

// Get the field object to access its options
let secteurField = table.getField("Secteur principal");
let secteurOptions = secteurField.options.choices.map(choice => choice.name);

// Create prompt for Claude with the available options
let prompt = `Based on the following description, determine which sector(s) it belongs to.

Description: ${description}

Available sectors:
${secteurOptions.map((option, index) => `${index + 1}. ${option}`).join('\n')}

Please respond with ONLY the sector name(s) that best fit, separated by commas if multiple apply. Use the exact names from the list above.`;


// await table.updateRecordAsync(recordId, {
//     "Secteur principal": [{name: "Aérospatiale et Défense"}]
// })

let response = await remoteFetchAsync('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': settings.apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: prompt }
    ]
  })
});

let result = await response.json();

if (result.content && result.content[0]) {
    let claudeResponse = result.content[0].text.trim();
    console.log("Claude's sector selection:", claudeResponse);
    
    // Parse Claude's response - split by comma and clean up
    let selectedSectors = claudeResponse
        .split(',')
        .map(sector => sector.trim())
        .filter(sector => secteurOptions.includes(sector));
    
    console.log("Parsed sectors:", selectedSectors);
    
    // Update the record with Claude's selection
    if (selectedSectors.length > 0) {
        await table.updateRecordAsync(recordId, {
            "Secteur principal": selectedSectors.map(name => ({name: name}))
        });
        console.log("✓ Record updated successfully with sectors:", selectedSectors);
    } else {
        console.warn("⚠ No valid sectors found in Claude's response");
    }
}