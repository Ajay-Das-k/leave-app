List<Contact> contacts = [SELECT Id, Name, Employee_ID__c, Is_Technical_System_Admin__c FROM Contact];
for (Contact c : contacts) {
    System.debug('Contact: ' + c.Name + ', TSA: ' + c.Is_Technical_System_Admin__c);
}
