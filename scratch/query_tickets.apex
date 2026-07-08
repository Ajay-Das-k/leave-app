List<Hardware_Ticket__c> tickets = [SELECT Id, Name, Employee__c, Hardware__c, Status__c, Description__c FROM Hardware_Ticket__c];
System.debug('Total tickets: ' + tickets.size());
for(Hardware_Ticket__c t : tickets) {
    System.debug('Ticket: ' + t.Name + ', Hardware: ' + t.Hardware__c + ', Status: ' + t.Status__c + ', Description: ' + t.Description__c);
}
