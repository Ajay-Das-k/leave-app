List<Contact> contacts = [SELECT Id, Name, Employee_ID__c, ReportsToId, ReportsTo.Name FROM Contact];
for (Contact c : contacts) {
    System.debug('Contact: ' + c.Name + ' reports to: ' + c.ReportsTo.Name);
}
