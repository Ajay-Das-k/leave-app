const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_DIR, 'extracted_data');

// Files to temporarily deactivate/modify
const FILES_TO_BYPASS = {
    trigger: {
        path: path.join(PROJECT_DIR, 'force-app', 'main', 'default', 'triggers', 'LeaveRequestTrigger.trigger'),
        target: 'LeaveNotificationHandler.handleNotifications(Trigger.new, Trigger.oldMap);',
        bypass: '// LeaveNotificationHandler.handleNotifications(Trigger.new, Trigger.oldMap);'
    },
    valJoiningDate: {
        path: path.join(PROJECT_DIR, 'force-app', 'main', 'default', 'objects', 'Contact', 'validationRules', 'Joining_Date_Not_Future.validationRule-meta.xml'),
        target: '<active>true</active>',
        bypass: '<active>false</active>'
    },
    valNoticeDays: {
        path: path.join(PROJECT_DIR, 'force-app', 'main', 'default', 'objects', 'Leave_Request__c', 'validationRules', 'Min_Notice_Days.validationRule-meta.xml'),
        target: '<active>true</active>',
        bypass: '<active>false</active>'
    },
    valConsecutiveDays: {
        path: path.join(PROJECT_DIR, 'force-app', 'main', 'default', 'objects', 'Leave_Request__c', 'validationRules', 'Max_Consecutive_Days.validationRule-meta.xml'),
        target: '<active>true</active>',
        bypass: '<active>false</active>'
    }
};

function log(msg) {
    console.log(`[MIGRATION] ${msg}`);
}

function runCommand(command) {
    try {
        const stdout = execSync(command, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf-8' });
        return stdout;
    } catch (error) {
        console.error(`Error running command: ${command}`);
        console.error(error.message);
        if (error.stdout) console.error(`stdout: ${error.stdout}`);
        if (error.stderr) console.error(`stderr: ${error.stderr}`);
        throw error;
    }
}

// Helper to construct FLS XML for a field, filtering out required/master-detail and making formulas read-only
function getFieldPermissionsXml(objectName, fieldName, fieldXmlPath) {
    if (!fs.existsSync(fieldXmlPath)) return '';
    const content = fs.readFileSync(fieldXmlPath, 'utf-8');
    
    // Master-Detail and Schema-Required fields do not allow FLS settings in Permsets
    if (content.includes('<type>MasterDetail</type>') || content.includes('<required>true</required>')) {
        return ''; 
    }
    
    const isFormula = content.includes('<formula>');
    const editable = isFormula ? 'false' : 'true';
    
    return `    <fieldPermissions>\n        <editable>${editable}</editable>\n        <field>${objectName}.${fieldName}</field>\n        <readable>true</readable>\n    </fieldPermissions>\n`;
}

// Generate a Permission Set containing FLS for all custom fields
function generatePermissionSet() {
    log('Scanning custom fields to generate Leave_App_Migration permission set...');
    
    let fieldPermsXml = '';
    
    // Helper to process directory of fields
    const processFields = (objectName, fieldsDir) => {
        if (!fs.existsSync(fieldsDir)) return;
        const files = fs.readdirSync(fieldsDir).filter(f => f.endsWith('.field-meta.xml'));
        for (const file of files) {
            const fieldName = file.split('.')[0];
            if (fieldName.endsWith('__c')) {
                const xmlPath = path.join(fieldsDir, file);
                fieldPermsXml += getFieldPermissionsXml(objectName, fieldName, xmlPath);
            }
        }
    };

    // 1. Contact
    processFields('Contact', path.join(PROJECT_DIR, 'force-app', 'main', 'default', 'objects', 'Contact', 'fields'));

    // 2. Custom Objects
    const customObjects = ['Leave_Type__c', 'Leave_Balance__c', 'Leave_Request__c'];
    for (const obj of customObjects) {
        processFields(obj, path.join(PROJECT_DIR, 'force-app', 'main', 'default', 'objects', obj, 'fields'));
    }

    const objectPermsXml = `
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>true</modifyAllRecords>
        <object>Contact</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>true</modifyAllRecords>
        <object>Leave_Type__c</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>true</modifyAllRecords>
        <object>Leave_Balance__c</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>true</modifyAllRecords>
        <object>Leave_Request__c</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    `;

    const permsetXml = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <hasActivationRequired>false</hasActivationRequired>
    <label>Leave App Migration</label>
${fieldPermsXml}
${objectPermsXml}
</PermissionSet>`;

    const permsetDir = path.join(PROJECT_DIR, 'force-app', 'main', 'default', 'permissionsets');
    if (!fs.existsSync(permsetDir)) {
        fs.mkdirSync(permsetDir, { recursive: true });
    }
    
    const permsetPath = path.join(permsetDir, 'Leave_App_Migration.permissionset-meta.xml');
    fs.writeFileSync(permsetPath, permsetXml, 'utf-8');
    log(`Permission Set generated and written to ${permsetPath}`);
}

// REST Client for Salesforce API using native fetch
async function callSalesforceAPI(method, endpoint, body, accessToken, instanceUrl) {
    const url = `${instanceUrl}${endpoint}`;
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Sforce-Duplicate-Rule-Header': 'allowSave=true'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errText}`);
    }
    return await response.json();
}

async function main() {
    log('Starting full data migration script with automated Permission Set assignment...');

    // Generate FLS permission set
    generatePermissionSet();

    // Save backups of metadata files
    const backups = {};
    for (const [key, config] of Object.entries(FILES_TO_BYPASS)) {
        if (fs.existsSync(config.path)) {
            backups[key] = fs.readFileSync(config.path, 'utf-8');
        } else {
            log(`Warning: metadata file not found: ${config.path}`);
        }
    }

    let bypassDeployed = false;

    try {
        // Step 1: Apply bypass modifications
        log('Modifying metadata to bypass triggers and validation rules...');
        for (const [key, config] of Object.entries(FILES_TO_BYPASS)) {
            if (backups[key]) {
                const originalContent = backups[key];
                if (originalContent.includes(config.target)) {
                    const modifiedContent = originalContent.replace(config.target, config.bypass);
                    fs.writeFileSync(config.path, modifiedContent, 'utf-8');
                    log(`Disabled ${key}`);
                } else {
                    log(`Warning: Target pattern not found in ${key}, might already be modified.`);
                }
            }
        }

        // Step 2: Deploy bypassed metadata & new Permission Set to target org
        log('Deploying bypassed metadata and Permission Set to target org...');
        runCommand('sf project deploy start');
        bypassDeployed = true;
        log('Bypassed metadata and Permission Set deployed successfully.');

        // Step 3: Assign the Permission Set to the running user
        log('Assigning Leave_App_Migration permission set to default user...');
        try {
            runCommand('sf org assign permset --name Leave_App_Migration');
            log('Permission Set assigned successfully.');
        } catch (permsetError) {
            if (permsetError.message && (permsetError.message.includes('Duplicate PermissionSetAssignment') || permsetError.stdout.includes('Duplicate PermissionSetAssignment'))) {
                log('Permission Set was already assigned.');
            } else {
                throw permsetError;
            }
        }

        // Step 4: Get Org Auth details and running User ID
        log('Retrieving connection info and running User ID from target org...');
        const orgInfoRaw = runCommand('sf org display --json');
        const orgInfo = JSON.parse(orgInfoRaw);
        const { accessToken, instanceUrl } = orgInfo.result;
        log(`Connected to target org: ${orgInfo.result.username} (${instanceUrl})`);

        const userQueryRaw = runCommand(`sf data query -q "SELECT Id FROM User WHERE Username = '${orgInfo.result.username}'" --json`);
        const userQueryResult = JSON.parse(userQueryRaw);
        if (!userQueryResult.result || !userQueryResult.result.records || userQueryResult.result.records.length === 0) {
            throw new Error(`Failed to find user ID for ${orgInfo.result.username} in target org.`);
        }
        const runningUserId = userQueryResult.result.records[0].Id;
        log(`Running User ID is: ${runningUserId}`);

        // Step 5: Load JSON files
        log('Loading extracted JSON data...');
        const rawTypes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'Leave_Type__c.json'), 'utf-8'));
        const rawContacts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'Employee_Contact.json'), 'utf-8'));
        const rawBalances = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'Leave_Balance__c.json'), 'utf-8'));
        const rawRequests = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'Leave_Request__c.json'), 'utf-8'));

        log(`Loaded counts: Leave Types: ${rawTypes.length}, Contacts: ${rawContacts.length}, Balances: ${rawBalances.length}, Requests: ${rawRequests.length}`);

        // ID Mapping Dictionary: old_id -> new_id
        const idMap = {};

        // Helper to get writeable/createable fields for an SObject, excluding OwnerId
        const getCreateableFields = (sobject) => {
            log(`Describing ${sobject} to fetch createable fields...`);
            const descRaw = runCommand(`sf sobject describe --sobject ${sobject} --json`);
            const desc = JSON.parse(descRaw);
            return desc.result.fields
                .filter(f => f.createable && f.name !== 'OwnerId')
                .map(f => f.name);
        };

        // Helper to copy values, replacing old User IDs with running User ID
        const cleanFields = (rawRec, createableFields) => {
            const rec = {};
            createableFields.forEach(f => {
                let val = rawRec[f];
                if (val !== undefined && val !== null) {
                    if (typeof val === 'string' && val.startsWith('005')) {
                        val = runningUserId;
                    }
                    rec[f] = val;
                }
            });
            return rec;
        };

        // Step 6: Migrate Leave_Type__c
        log('\n=== Migrating Leave_Type__c ===');
        const typeFields = getCreateableFields('Leave_Type__c');
        const typeRecordsToInsert = rawTypes.map(t => {
            return {
                attributes: { type: 'Leave_Type__c' },
                ...cleanFields(t, typeFields)
            };
        });

        log(`Inserting ${typeRecordsToInsert.length} Leave Types...`);
        const typeResponse = await callSalesforceAPI(
            'POST',
            '/services/data/v60.0/composite/sobjects',
            { allOrNone: true, records: typeRecordsToInsert },
            accessToken,
            instanceUrl
        );

        typeResponse.forEach((res, index) => {
            if (!res.success) throw new Error(`Failed to insert Leave Type: ${JSON.stringify(res.errors)}`);
            const oldId = rawTypes[index].Id;
            idMap[oldId] = res.id;
        });
        log('Leave_Type__c migrated successfully.');

        // Step 7: Migrate Contacts
        log('\n=== Migrating Contact (Employee Contacts) ===');
        const contactFields = getCreateableFields('Contact');
        
        // Remove self-references on initial insert to prevent circular references and order issues
        const contactRecordsToInsert = rawContacts.map(c => {
            const rec = {
                attributes: { type: 'Contact' },
                ...cleanFields(c, contactFields)
            };
            // Clear lookups temporarily
            rec.ReportsToId = null;
            rec.Reporting_Manager__c = null;
            return rec;
        });

        log(`Inserting ${contactRecordsToInsert.length} Employee Contacts...`);
        const contactResponse = await callSalesforceAPI(
            'POST',
            '/services/data/v60.0/composite/sobjects',
            { allOrNone: true, records: contactRecordsToInsert },
            accessToken,
            instanceUrl
        );

        contactResponse.forEach((res, index) => {
            if (!res.success) throw new Error(`Failed to insert Contact: ${JSON.stringify(res.errors)}`);
            const oldId = rawContacts[index].Id;
            idMap[oldId] = res.id;
        });
        log('Contacts inserted. Now preparing lookup updates...');

        // Step 8: Update Contact lookup self-references
        const contactsToUpdate = [];
        rawContacts.forEach((c, index) => {
            const newId = idMap[c.Id];
            const updates = { attributes: { type: 'Contact' }, id: newId };
            let hasUpdate = false;

            if (c.ReportsToId && idMap[c.ReportsToId]) {
                updates.ReportsToId = idMap[c.ReportsToId];
                hasUpdate = true;
            }
            if (c.Reporting_Manager__c && idMap[c.Reporting_Manager__c]) {
                updates.Reporting_Manager__c = idMap[c.Reporting_Manager__c];
                hasUpdate = true;
            }

            if (hasUpdate) {
                contactsToUpdate.push(updates);
            }
        });

        if (contactsToUpdate.length > 0) {
            log(`Updating ${contactsToUpdate.length} Contacts with ReportsToId and Reporting_Manager__c references...`);
            const contactUpdateResponse = await callSalesforceAPI(
                'PATCH',
                '/services/data/v60.0/composite/sobjects',
                { allOrNone: true, records: contactsToUpdate },
                accessToken,
                instanceUrl
            );
            contactUpdateResponse.forEach(res => {
                if (!res.success) throw new Error(`Failed to update Contact lookups: ${JSON.stringify(res.errors)}`);
            });
            log('Contact lookups updated successfully.');
        } else {
            log('No Contact lookups required updating.');
        }

        // Step 9: Migrate Leave_Balance__c
        log('\n=== Migrating Leave_Balance__c ===');
        const balanceFields = getCreateableFields('Leave_Balance__c');
        
        // Helper to chunk arrays
        const chunkArray = (arr, size) => {
            const chunks = [];
            for (let i = 0; i < arr.length; i += size) {
                chunks.push(arr.slice(i, i + size));
            }
            return chunks;
        };

        const balanceRecordsToInsert = rawBalances.map(b => {
            const rec = {
                attributes: { type: 'Leave_Balance__c' },
                ...cleanFields(b, balanceFields)
            };

            // Map lookups
            if (b.Employee__c && idMap[b.Employee__c]) rec.Employee__c = idMap[b.Employee__c];
            if (b.Leave_Type__c && idMap[b.Leave_Type__c]) rec.Leave_Type__c = idMap[b.Leave_Type__c];
            
            return rec;
        });

        const balanceChunks = chunkArray(balanceRecordsToInsert, 200);
        log(`Inserting ${balanceRecordsToInsert.length} Leave Balances in ${balanceChunks.length} chunk(s)...`);

        let balanceIndexOffset = 0;
        for (let i = 0; i < balanceChunks.length; i++) {
            const chunk = balanceChunks[i];
            log(`Processing Balance Chunk ${i + 1}/${balanceChunks.length} (${chunk.length} records)...`);
            const balanceResponse = await callSalesforceAPI(
                'POST',
                '/services/data/v60.0/composite/sobjects',
                { allOrNone: true, records: chunk },
                accessToken,
                instanceUrl
            );

            balanceResponse.forEach((res, index) => {
                if (!res.success) throw new Error(`Failed to insert Leave Balance: ${JSON.stringify(res.errors)}`);
                const oldId = rawBalances[balanceIndexOffset + index].Id;
                idMap[oldId] = res.id;
            });
            balanceIndexOffset += chunk.length;
        }
        log('Leave_Balance__c migrated successfully.');

        // Step 10: Migrate Leave_Request__c
        log('\n=== Migrating Leave_Request__c ===');
        const requestFields = getCreateableFields('Leave_Request__c');

        const requestRecordsToInsert = rawRequests.map(r => {
            const rec = {
                attributes: { type: 'Leave_Request__c' },
                ...cleanFields(r, requestFields)
            };

            // Map lookups
            if (r.Employee__c && idMap[r.Employee__c]) rec.Employee__c = idMap[r.Employee__c];
            if (r.Leave_Type__c && idMap[r.Leave_Type__c]) rec.Leave_Type__c = idMap[r.Leave_Type__c];
            if (r.Leave_Balance__c && idMap[r.Leave_Balance__c]) rec.Leave_Balance__c = idMap[r.Leave_Balance__c];
            if (r.Reporting_Manager__c && idMap[r.Reporting_Manager__c]) rec.Reporting_Manager__c = idMap[r.Reporting_Manager__c];
            if (r.HR_Approver__c && idMap[r.HR_Approver__c]) rec.HR_Approver__c = idMap[r.HR_Approver__c];

            return rec;
        });

        const requestChunks = chunkArray(requestRecordsToInsert, 200);
        log(`Inserting ${requestRecordsToInsert.length} Leave Requests in ${requestChunks.length} chunk(s)...`);

        let requestIndexOffset = 0;
        for (let i = 0; i < requestChunks.length; i++) {
            const chunk = requestChunks[i];
            log(`Processing Request Chunk ${i + 1}/${requestChunks.length} (${chunk.length} records)...`);
            const requestResponse = await callSalesforceAPI(
                'POST',
                '/services/data/v60.0/composite/sobjects',
                { allOrNone: true, records: chunk },
                accessToken,
                instanceUrl
            );

            requestResponse.forEach((res, index) => {
                if (!res.success) throw new Error(`Failed to insert Leave Request: ${JSON.stringify(res.errors)}`);
                const oldId = rawRequests[requestIndexOffset + index].Id;
                idMap[oldId] = res.id;
            });
            requestIndexOffset += chunk.length;
        }
        log('Leave_Request__c migrated successfully.');

        log('\nAll data migrated successfully!');
    } catch (e) {
        console.error('Migration failed during execution:', e);
        throw e;
    } finally {
        // Step 11: Revert bypass modifications & Redeploy metadata
        log('\n=== Restoring original active metadata ===');
        for (const [key, config] of Object.entries(FILES_TO_BYPASS)) {
            if (backups[key]) {
                fs.writeFileSync(config.path, backups[key], 'utf-8');
                log(`Restored ${key}`);
            }
        }

        if (bypassDeployed) {
            log('Redeploying original metadata to reactivate triggers and validation rules...');
            try {
                runCommand('sf project deploy start');
                log('Metadata restored in target org successfully.');
            } catch (deployErr) {
                console.error('Failed to redeploy original metadata in cleanup phase:', deployErr);
            }
        }
    }
}

main().catch(err => {
    console.error('Fatal error in main execution:', err);
    process.exit(1);
});
