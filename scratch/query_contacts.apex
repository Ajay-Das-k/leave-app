List<Contact> contacts = [SELECT Id, Name, Employee_ID__c, Password_Hash__c, Email, Portal_Access_Type__c FROM Contact];
System.debug('Total contacts: ' + contacts.size());
for (Contact c : contacts) {
    System.debug('Contact: ' + c.Name + ', Emp ID: ' + c.Employee_ID__c + ', Pass: ' + c.Password_Hash__c + ', Email: ' + c.Email + ', Access: ' + c.Portal_Access_Type__c);
}
