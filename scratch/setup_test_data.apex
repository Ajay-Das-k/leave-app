Contact employee = [SELECT Id FROM Contact WHERE Employee_ID__c = 'CT100' LIMIT 1];

Hardware__c hw = new Hardware__c(
    Name = 'MacBook Pro 16 M2',
    Type__c = 'Laptop',
    Status__c = 'Assigned',
    Location__c = 'Office',
    Serial_Number__c = 'SN12345678',
    Assigned_To__c = employee.Id,
    Date_Assigned__c = Date.today(),
    Expected_Life_Span_Years__c = 4,
    Year_of_Manufacture__c = 2023,
    OS__c = 'macOS Sonoma'
);
insert hw;
System.debug('Created test hardware MacBook Pro 16 M2 for CT100: ' + hw.Id);
