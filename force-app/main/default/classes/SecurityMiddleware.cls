public without sharing class SecurityMiddleware {
    
    public class SecurityException extends Exception {}

    // Verify if the contactId corresponds to a Manager
    public static void verifyManager(String contactId) {
        Contact c = getContact(contactId);
        if (c == null || c.Portal_Access_Type__c == null || !c.Portal_Access_Type__c.contains('Manager')) {
            throw new SecurityException('Access Denied: You do not have Manager permissions.');
        }
    }

    // Verify if the contactId corresponds to an HR
    public static void verifyHR(String contactId) {
        Contact c = getContact(contactId);
        if (c == null || c.Portal_Access_Type__c == null || !c.Portal_Access_Type__c.contains('HR')) {
            throw new SecurityException('Access Denied: You do not have HR permissions.');
        }
    }

    // Verify if the contactId corresponds to an Admin
    public static void verifyAdmin(String contactId) {
        Contact c = getContact(contactId);
        if (c == null || (!c.Is_Technical_System_Admin__c && (c.Portal_Access_Type__c == null || !c.Portal_Access_Type__c.contains('Admin')))) {
            throw new SecurityException('Access Denied: You do not have Admin permissions.');
        }
    }

    // Verify if the contactId corresponds to Admin or HR
    public static void verifyAdminOrHR(String contactId) {
        Contact c = getContact(contactId);
        Boolean isAdmin = c != null && (c.Is_Technical_System_Admin__c || (c.Portal_Access_Type__c != null && c.Portal_Access_Type__c.contains('Admin')));
        Boolean isHR = c != null && c.Portal_Access_Type__c != null && c.Portal_Access_Type__c.contains('HR');
        if (!isAdmin && !isHR) {
            throw new SecurityException('Access Denied: You do not have Admin or HR permissions.');
        }
    }

    // Verify if the contactId corresponds to Admin, HR, or Manager
    public static void verifyAdminOrHROrManager(String contactId) {
        Contact c = getContact(contactId);
        Boolean isAdmin = c != null && (c.Is_Technical_System_Admin__c || (c.Portal_Access_Type__c != null && c.Portal_Access_Type__c.contains('Admin')));
        Boolean isHR = c != null && c.Portal_Access_Type__c != null && c.Portal_Access_Type__c.contains('HR');
        Boolean isManager = c != null && c.Portal_Access_Type__c != null && c.Portal_Access_Type__c.contains('Manager');
        if (!isAdmin && !isHR && !isManager) {
            throw new SecurityException('Access Denied: You do not have elevated permissions.');
        }
    }

    private static Contact getContact(String contactId) {
        // Bypass if running user is System Administrator
        Id profileId = UserInfo.getProfileId();
        Profile p = [SELECT Name FROM Profile WHERE Id = :profileId LIMIT 1];
        if (p.Name == 'System Administrator') {
            return new Contact(
                LastName = 'System Admin',
                Portal_Access_Type__c = 'Admin;HR;Manager;Employee',
                Is_Technical_System_Admin__c = true
            );
        }

        if (String.isBlank(contactId)) {
            throw new SecurityException('Authentication required. Missing Contact ID.');
        }
        try {
            return [SELECT Id, Portal_Access_Type__c, Is_Technical_System_Admin__c FROM Contact WHERE Id = :contactId LIMIT 1];
        } catch (Exception e) {
            throw new SecurityException('Authentication failed. Invalid Contact ID.');
        }
    }
}
