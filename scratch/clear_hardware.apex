delete [SELECT Id FROM Ticket__c LIMIT 10000];
delete [SELECT Id FROM Hardware_Request__c LIMIT 10000];
delete [SELECT Id FROM Hardware__c LIMIT 10000];
System.debug('Cleared all hardware, ticket, and request records.');
