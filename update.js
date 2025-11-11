// ===================================
// LinkedIn Company Data Scraper
// ===================================

// Step 1: Configuration - Authentication & Field Selection
let settings = input.config({
    title: '⚙️ LinkedIn Company Data Scraper Configuration',
    description: 'Configure authentication and select which fields to update',
    items: [
        input.config.text('linkedinCookie', {
            label: '🔑 LinkedIn Cookie (li_at)',
            description: 'Go to linkedin.com → F12 → Application → Cookies → Copy "li_at" value'
        }),
        input.config.select('updateLogo', {
            label: 'Update Logo',
            options: [
                {label: 'No', value: 'no'},
                {label: 'Yes', value: 'yes'}
            ],
            description: 'Extract and update company logo URL'
        }),
        input.config.select('updateWebsite', {
            label: 'Update Website',
            options: [
                {label: 'No', value: 'no'},
                {label: 'Yes', value: 'yes'}
            ],
            description: 'Extract and update company website'
        }),
        input.config.select('updateDescription', {
            label: 'Update Description',
            options: [
                {label: 'No', value: 'no'},
                {label: 'Yes', value: 'yes'}
            ],
            description: 'Extract and update company description'
        }),
        input.config.select('updateIndustry', {
            label: 'Update Industry',
            options: [
                {label: 'No', value: 'no'},
                {label: 'Yes', value: 'yes'}
            ],
            description: 'Extract and update company industry'
        }),
        input.config.select('updateSpecialties', {
            label: 'Update Specialties',
            options: [
                {label: 'No', value: 'no'},
                {label: 'Yes', value: 'yes'}
            ],
            description: 'Extract and update company specialties'
        }),
        input.config.select('updateCompanySize', {
            label: 'Update company size',
            options: [
                {label: 'No', value: 'no'},
                {label: 'Yes', value: 'yes'}
            ],
            description: 'Extract and update company size'
        }),
        input.config.select('updateFoundedDate', {
            label: 'Update founded date',
            options: [
                {label: 'No', value: 'no'},
                {label: 'Yes', value: 'yes'}
            ],
            description: 'Extract and update founded date'
        }),
        input.config.select('updateLocation', {
            label: 'Update Location (Town & Province)',
            options: [
                {label: 'No', value: 'no'},
                {label: 'Yes', value: 'yes'}
            ],
            description: 'Extract and update town and province location'
        })
    ]
});

const linkedinCookie = settings.linkedinCookie;

if (!linkedinCookie) {
    output.text('❌ LinkedIn cookie is required to proceed');
    throw new Error('Missing LinkedIn cookie');
}

const updateConfig = {
    logo: settings.updateLogo === 'yes',
    website: settings.updateWebsite === 'yes',
    description: settings.updateDescription === 'yes',
    industry: settings.updateIndustry === 'yes',
    specialties: settings.updateSpecialties === 'yes',
    companySize: settings.updateCompanySize === 'yes',
    foundedDate: settings.updateFoundedDate === 'yes',
    location: settings.updateLocation === 'yes'
};

// Check if at least one field is selected
if (!Object.values(updateConfig).some(v => v)) {
    output.text('⚠️ No fields selected for update. Please select at least one field.');
    throw new Error('No fields selected');
}

output.text('✅ Configuration complete! Starting to process records...\n');

// Step 2: Select Table and Fields
let table = base.getTable('master'); // Change to your table name
let linkedinUrlField = table.getField('url linkedin company'); // Field with LinkedIn URLs

// Step 3: Fetch records with LinkedIn URLs
let query = await table.selectRecordsAsync({
    fields: [
        linkedinUrlField,
        ...(updateConfig.logo ? [table.getField('logo')] : []),
        ...(updateConfig.website ? [table.getField('website')] : []),
        ...(updateConfig.description ? [table.getField('description')] : []),
        ...(updateConfig.industry ? [table.getField('industry')] : []),
        ...(updateConfig.specialties ? [table.getField('specialties')] : []),
        ...(updateConfig.companySize ? [table.getField('company size')] : []),
        ...(updateConfig.foundedDate ? [table.getField('founded date')] : []),
        ...(updateConfig.location ? [table.getField('town')] : []),
        ...(updateConfig.location ? [table.getField('province')] : [])
    ]
});

let recordsToProcess = query.records.filter(record => {
    return record.getCellValue(linkedinUrlField);
});

output.text(`📊 Found ${recordsToProcess.length} records with LinkedIn URLs\n`);

// Helper function to ensure single select option exists
async function ensureSingleSelectOption(field, optionName) {
    let fieldConfig = field.options;
    let existingChoice = fieldConfig.choices.find(choice => choice.name === optionName);
    
    if (!existingChoice) {
        // Add the new choice
        let newChoices = [...fieldConfig.choices, { name: optionName }];
        await field.updateOptionsAsync({ choices: newChoices });
        output.text(`   ➕ Added new industry option: "${optionName}"`);
    }
    
    return optionName;
}

// Helper function to ensure multi-select options exist
async function ensureMultiSelectOptions(field, optionNames) {
    let fieldConfig = field.options;
    let existingChoiceNames = fieldConfig.choices.map(choice => choice.name);
    let newChoices = [...fieldConfig.choices];
    let addedCount = 0;
    
    for (let optionName of optionNames) {
        if (!existingChoiceNames.includes(optionName)) {
            newChoices.push({ name: optionName });
            existingChoiceNames.push(optionName);
            addedCount++;
        }
    }
    
    if (addedCount > 0) {
        await field.updateOptionsAsync({ choices: newChoices });
        output.text(`   ➕ Added ${addedCount} new specialty option(s)`);
    }
    
    return optionNames;
}

// Step 4: Process each record
for (let record of recordsToProcess) {
    let linkedinUrl = record.getCellValueAsString(linkedinUrlField);
    output.text(`\n🔍 Processing: ${linkedinUrl}`);
    
    try {
        // Fetch LinkedIn page with cookie authentication
        let response = await remoteFetchAsync(linkedinUrl, {
            headers: {
                'Cookie': `li_at=${linkedinCookie}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            output.text(`   ❌ Failed to fetch: ${response.status}`);
            continue;
        }
        
        let html = await response.text();
        
        // Extract data from HTML
        let extractedData = {};
        
        // Extract JSON-LD data
        let jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
        if (jsonLdMatch) {
            try {
                let jsonData = JSON.parse(jsonLdMatch[1]);
                let orgData = null;

                // If there's a @graph array, find the Organization with company details
                if (jsonData['@graph']) {
                    orgData = jsonData['@graph'].find(item => 
                        item['@type'] === 'Organization' && 
                        (item.address || item.numberOfEmployees || item.logo)
                    );
                } else if (jsonData['@type'] === 'Organization') {
                    // Direct Organization object (no @graph)
                    orgData = jsonData;
                }
                
                if (orgData) {
                    // Logo - extract from logo.contentUrl
                    if (updateConfig.logo && orgData.logo) {
                        if (typeof orgData.logo === 'string') {
                            extractedData.logo = orgData.logo;
                        } else if (orgData.logo.contentUrl) {
                            extractedData.logo = orgData.logo.contentUrl;
                        }
                    }
                    
                    // Website - extract from sameAs
                    if (updateConfig.website && orgData.sameAs) {
                        extractedData.website = orgData.sameAs;
                    }
                    
                    // Description
                    if (updateConfig.description && orgData.description) {
                        extractedData.description = orgData.description;
                    }
                    
                    // Location - extract town and province separately
                    if (updateConfig.location && orgData.address) {
                        let addr = orgData.address;
                        if (addr.addressLocality) {
                            extractedData.town = addr.addressLocality;
                        }
                        if (addr.addressRegion) {
                            extractedData.province = addr.addressRegion;
                        }
                    }
                    
                    // company size
                    if (updateConfig.companySize && orgData.numberOfEmployees) {
                        if (typeof orgData.numberOfEmployees === 'object' && orgData.numberOfEmployees.value) {
                            extractedData.companySize = orgData.numberOfEmployees.value;
                        } else if (typeof orgData.numberOfEmployees === 'number') {
                            extractedData.companySize = orgData.numberOfEmployees;
                        }
                    }
                }
            } catch (e) {
                output.text(`   ⚠️ Error parsing JSON-LD: ${e.message}`);
            }
        }
        
        // Extract from HTML (fallback/additional extraction)
        if (updateConfig.website && !extractedData.website) {
            // Try to extract the visible link text instead of the redirect URL
            let websiteMatch = html.match(/data-test-id="about-us__website"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/s);
            if (websiteMatch) {
                extractedData.website = websiteMatch[1].trim();
            }
        }
        
        if (updateConfig.industry && !extractedData.industry) {
            let industryMatch = html.match(/data-test-id="about-us__industry"[^>]*>.*?<dd[^>]*>([^<]+)</s);
            if (industryMatch) {
                extractedData.industry = industryMatch[1].trim();
            }
        }
        
        if (updateConfig.specialties && !extractedData.specialties) {
            let specialtiesMatch = html.match(/data-test-id="about-us__specialties"[^>]*>.*?<dd[^>]*>([^<]+)</s);
            if (specialtiesMatch) {
                let specialtiesText = specialtiesMatch[1].trim();
                // Parse specialties: split by comma, "and", and "&"
                let specialtiesArray = specialtiesText
                    .split(/,|\sand\s|\s&\s/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0);
                extractedData.specialties = specialtiesArray;
            }
        }
        
        if (updateConfig.companySize && !extractedData.companySize) {
            let sizeMatch = html.match(/data-test-id="about-us__size"[^>]*>.*?<dd[^>]*>([^<]+)</s);
            if (sizeMatch) {
                let sizeText = sizeMatch[1].trim();
                // Extract first number from text like "142 employees" or "100-500 employees"
                let numberMatch = sizeText.match(/(\d+)/);
                if (numberMatch) {
                    extractedData.companySize = parseInt(numberMatch[1]);
                }
            }
        }
        
        if (updateConfig.location && (!extractedData.town || !extractedData.province)) {
            let hqMatch = html.match(/data-test-id="about-us__headquarters"[^>]*>.*?<dd[^>]*>([^<]+)</s);
            if (hqMatch) {
                let hqText = hqMatch[1].trim();
                // Try to split headquarters text (e.g., "Burnaby, British Columbia")
                let parts = hqText.split(',').map(p => p.trim());
                if (parts.length >= 2) {
                    if (!extractedData.town) extractedData.town = parts[0];
                    if (!extractedData.province) extractedData.province = parts[1];
                } else if (parts.length === 1) {
                    if (!extractedData.town) extractedData.town = parts[0];
                }
            }
        }
        
        if (updateConfig.foundedDate && !extractedData.foundedDate) {
            let foundedMatch = html.match(/data-test-id="about-us__foundedOn"[^>]*>.*?<dd[^>]*>([^<]+)</s);
            if (foundedMatch) {
                let foundedText = foundedMatch[1].trim();
                // Extract year as number
                let yearMatch = foundedText.match(/(\d{4})/);
                if (yearMatch) {
                    extractedData.foundedDate = parseInt(yearMatch[1]);
                }
            }
        }
        
        if (updateConfig.description && !extractedData.description) {
            let descMatch = html.match(/data-test-id="about-us__description"[^>]*>\s*<p[^>]*>([^<]+)</s);
            if (descMatch) {
                extractedData.description = descMatch[1].trim();
            }
        }
        
        // Step 5: Update only empty fields
        let updateData = {};
        
        if (updateConfig.logo && extractedData.logo) {
            let currentLogo = record.getCellValue('logo');
            if (!currentLogo || currentLogo.length === 0) {
                // Extract company name from LinkedIn URL (e.g., /company/company-name)
                let companyName = linkedinUrl.split('/company/')[1]?.split('/')[0] || 'company';
                updateData['logo'] = [{ url: extractedData.logo, filename: `${companyName}_logo.jpg` }];
                output.text(`   ✅ Logo: ${extractedData.logo.substring(0, 50)}...`);
            }
        }
        
        if (updateConfig.website && extractedData.website) {
            let currentWebsite = record.getCellValue('website');
            if (!currentWebsite) {
                updateData['website'] = extractedData.website;
                output.text(`   ✅ Website: ${extractedData.website}`);
            }
        }
        
        if (updateConfig.description && extractedData.description) {
            let currentDesc = record.getCellValue('description');
            if (!currentDesc) {
                updateData['description'] = extractedData.description;
                output.text(`   ✅ Description: ${extractedData.description.substring(0, 50)}...`);
            }
        }
        
        if (updateConfig.industry && extractedData.industry) {
            let currentIndustry = record.getCellValue('industry');
            if (!currentIndustry) {
                let industryField = table.getField('industry');
                await ensureSingleSelectOption(industryField, extractedData.industry);
                updateData['industry'] = { name: extractedData.industry };
                output.text(`   ✅ Industry: ${extractedData.industry}`);
            }
        }
        
        if (updateConfig.specialties && extractedData.specialties && extractedData.specialties.length > 0) {
            let currentSpec = record.getCellValue('specialties');
            if (!currentSpec || currentSpec.length === 0) {
                let specialtiesField = table.getField('specialties');
                await ensureMultiSelectOptions(specialtiesField, extractedData.specialties);
                updateData['specialties'] = extractedData.specialties.map(name => ({ name }));
                output.text(`   ✅ Specialties: ${extractedData.specialties.join(', ')}`);
            }
        }
        
        if (updateConfig.companySize && extractedData.companySize) {
            let currentSize = record.getCellValue('company size');
            if (!currentSize) {
                updateData['company size'] = extractedData.companySize;
                output.text(`   ✅ company size: ${extractedData.companySize}`);
            }
        }
        
        if (updateConfig.foundedDate && extractedData.foundedDate) {
            let currentFounded = record.getCellValue('founded date');
            if (!currentFounded) {
                updateData['founded date'] = extractedData.foundedDate;
                output.text(`   ✅ founded date: ${extractedData.foundedDate}`);
            }
        }
        
        if (updateConfig.location && extractedData.town) {
            let currentTown = record.getCellValue('town');
            if (!currentTown) {
                updateData['town'] = extractedData.town;
                output.text(`   ✅ Town: ${extractedData.town}`);
            }
        }
        
        if (updateConfig.location && extractedData.province) {
            let currentProvince = record.getCellValue('province');
            if (!currentProvince) {
                let provinceField = table.getField('province');
                await ensureSingleSelectOption(provinceField, extractedData.province);
                updateData['province'] = { name: extractedData.province };
                output.text(`   ✅ Province: ${extractedData.province}`);
            }
        }
        
        // Update record if there's data to update
        if (Object.keys(updateData).length > 0) {
            await table.updateRecordAsync(record.id, updateData);
            output.text(`   💾 Record updated successfully`);
        } else {
            output.text(`   ℹ️ All selected fields already have data - no updates needed`);
        }
        
    } catch (error) {
        output.text(`   ❌ Error: ${error.message}`);
    }
}

output.text('\n\n🎉 Processing complete!');