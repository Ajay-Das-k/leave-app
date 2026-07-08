List<Hardware_Ticket__c> tickets = [SELECT Id, Status__c FROM Hardware_Ticket__c WHERE Name = 'HT-00012' LIMIT 1];
if(!tickets.isEmpty()) {
    tickets[0].Status__c = 'Forwarded to HR/Manager';
    tickets[0].Admin_Notes__c = 'Forwarded for manager approval/review.';
    update tickets[0];
    System.debug('Successfully escalated HT-00012');
} else {
    System.debug('Ticket HT-00012 not found.');
}
