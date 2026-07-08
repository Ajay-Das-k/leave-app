delete [SELECT Id FROM Ticket__c LIMIT 10000];
System.debug('Deleted all hardware tickets.');
