public without sharing class HardwareNotificationHandler {
    
    public static void handleStatusChange(List<Hardware_Request__c> newRecords, Map<Id, Hardware_Request__c> oldMap) {
        List<Hardware_Request__c> triggeredRecords = new List<Hardware_Request__c>();
        
        for (Hardware_Request__c req : newRecords) {
            if (oldMap == null) {
                // Insert event: notify
                triggeredRecords.add(req);
            } else {
                // Update event: notify if status changed
                Hardware_Request__c oldReq = oldMap.get(req.Id);
                if (req.Status__c != oldReq.Status__c) {
                    triggeredRecords.add(req);
                }
            }
        }
        
        if (triggeredRecords.isEmpty()) return;
        
        // Re-query records with all lookup details
        List<Hardware_Request__c> records = [
            SELECT Id, Name, Employee__c, Employee__r.Name, Employee__r.Email, 
                   Employee__r.Reporting_Manager__c, Employee__r.Reporting_Manager__r.Email, 
                   Hardware__c, Hardware__r.Name, Hardware_Type__c, Description__c, Notes__c, 
                   Status__c, Is_Ticket__c, Admin_Comment__c, HR_Manager_Comment__c
            FROM Hardware_Request__c 
            WHERE Id IN :triggeredRecords
        ];
        
        // Get Admin & HR emails
        List<String> adminEmails = new List<String>();
        List<String> hrEmails = new List<String>();
        
        for (Contact c : [SELECT Email, Portal_Access_Type__c FROM Contact WHERE Portal_Access_Type__c IN ('Admin', 'HR') AND Email != null]) {
            if (c.Portal_Access_Type__c == 'Admin') {
                adminEmails.add(c.Email);
            } else if (c.Portal_Access_Type__c == 'HR') {
                hrEmails.add(c.Email);
            }
        }
        
        List<Messaging.SingleEmailMessage> emailsToSend = new List<Messaging.SingleEmailMessage>();
        
        for (Hardware_Request__c req : records) {
            Hardware_Request__c oldReq = (oldMap != null) ? oldMap.get(req.Id) : null;
            
            // Build recipient list: Employee, Manager, HRs, Admins
            Set<String> recipientSet = new Set<String>();
            if (String.isNotBlank(req.Employee__r.Email)) {
                recipientSet.add(req.Employee__r.Email);
            }
            if (req.Employee__r.Reporting_Manager__c != null && String.isNotBlank(req.Employee__r.Reporting_Manager__r.Email)) {
                recipientSet.add(req.Employee__r.Reporting_Manager__r.Email);
            }
            recipientSet.addAll(adminEmails);
            recipientSet.addAll(hrEmails);
            
            if (recipientSet.isEmpty()) continue;
            
            List<String> recipients = new List<String>(recipientSet);
            
            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            mail.setToAddresses(recipients);
            
            String subject = '';
            String body = '';
            
            String recordTypeLabel = req.Is_Ticket__c ? 'Hardware Ticket' : 'Hardware Request';
            
            if (oldReq == null) {
                // Insert: new request or ticket
                subject = 'New ' + recordTypeLabel + ' Created: ' + req.Name;
                body = 'Hello,\n\n';
                body += 'A new ' + recordTypeLabel.toLowerCase() + ' has been created on behalf of ' + req.Employee__r.Name + '.\n\n';
                body += 'Detail Summary:\n';
                body += '---------------------------------\n';
                body += 'ID: ' + req.Name + '\n';
                body += 'Status: ' + req.Status__c + '\n';
                if (req.Is_Ticket__c) {
                    body += 'Hardware: ' + (req.Hardware__c != null ? req.Hardware__r.Name : 'N/A') + '\n';
                    body += 'Notes / Issues: ' + (req.Notes__c != null ? req.Notes__c : '') + '\n';
                } else {
                    body += 'Hardware Type: ' + (req.Hardware_Type__c != null ? req.Hardware_Type__c : '') + '\n';
                    body += 'Reason: ' + (req.Description__c != null ? req.Description__c : '') + '\n';
                }
                body += '---------------------------------\n\n';
                body += 'Regards,\nLeave App Ticketing System';
            } else {
                // Update: status changed
                subject = recordTypeLabel + ' Status Updated: ' + req.Name;
                body = 'Hello,\n\n';
                body += 'The status of ' + recordTypeLabel.toLowerCase() + ' ' + req.Name + ' (Employee: ' + req.Employee__r.Name + ') has been updated.\n\n';
                body += 'Status Transition:\n';
                body += '---------------------------------\n';
                body += 'Previous Status: ' + oldReq.Status__c + '\n';
                body += 'New Status: ' + req.Status__c + '\n';
                if (req.Is_Ticket__c) {
                    body += 'Notes: ' + (req.Notes__c != null ? req.Notes__c : '') + '\n';
                } else {
                    body += 'Description: ' + (req.Description__c != null ? req.Description__c : '') + '\n';
                }
                if (String.isNotBlank(req.Admin_Comment__c)) {
                    body += 'Admin Comment: ' + req.Admin_Comment__c + '\n';
                }
                if (String.isNotBlank(req.HR_Manager_Comment__c)) {
                    body += 'HR/Manager Comment: ' + req.HR_Manager_Comment__c + '\n';
                }
                body += '---------------------------------\n\n';
                body += 'Regards,\nLeave App Ticketing System';
            }
            
            mail.setSubject(subject);
            mail.setPlainTextBody(body);
            emailsToSend.add(mail);
        }
        
        if (!emailsToSend.isEmpty()) {
            try {
                Messaging.sendEmail(emailsToSend);
                System.debug('Hardware emails sent successfully.');
            } catch (Exception e) {
                System.debug('Failed to send hardware emails: ' + e.getMessage());
            }
        }
    }
}
